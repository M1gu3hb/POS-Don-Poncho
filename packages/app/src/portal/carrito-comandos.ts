import 'server-only';

import { ErrorDominio, PAQUETES_PORTAL } from '@morphiqpos/contracts';

import {
  MAXIMO_EN_EL_CARRITO,
  aperturaDeLaCuenta,
  entradaAgregarAlCarrito,
  entradaEnviarElCarrito,
  entradaQuitarDelCarrito,
  estadoDelCarrito,
  huellaDelDispositivo,
  latir,
  type EstadoDelCarrito,
} from './carrito.ts';
import { apartarLoQueYaNoSePide } from './carrito-disponibilidad.ts';
import { definirComandoPublico, type ContextoPortal } from './definicion-publica.ts';
import { abrirLaMesaDelPortal, exigirPedidosDesdeElTelefono } from './mesa.ts';
import { ordenAbiertaDeLaMesa, pedirEnLaMesa, type ResultadoPedido } from './pedido.ts';
import { cargarProductosDelMenu, valorarParaPedido } from './productos.ts';
import { comensalEnvia } from './quien-envia.ts';

/**
 * LOS TRES COMANDOS DEL CARRITO COMPARTIDO (DP-9.5): agregar, quitar lo propio y enviar.
 *
 * DP-12.2 · Agregar y quitar ya no exigen cuenta: los comensales arman su carrito con la mesa
 * cerrada y lo armado se conserva al abrirla. Enviar toma la fila de `carritos_mesa` con candado y
 * la cuenta con el suyo (`ordenAbiertaDeLaMesa`), como el pedido de siempre y el cobro: dos
 * «Enviar» a la vez se forman, el segundo espera al primero y encuentra el carrito vacío. Un
 * pedido, no dos (R10). Y sólo envía el comensal si el negocio lo eligió (`quien-envia.ts`); si no,
 * lo confirma el mesero (`restaurante/carrito-del-mesero.ts`).
 */

function huellaDe(ctx: ContextoPortal, dispositivo: string): string {
  return huellaDelDispositivo(ctx.pimienta, dispositivo);
}

async function lineasPendientes(ctx: ContextoPortal) {
  return ctx.tx
    .selectFrom('carrito_mesa_lineas')
    .select(['id', 'producto_id', 'cantidad', 'notas'])
    .where('organizacion_id', '=', ctx.ambito.organizacionId)
    .where('mesa_id', '=', ctx.ambito.mesaId)
    .orderBy('created_at')
    .orderBy('id')
    .execute();
}

async function estadoPara(ctx: ContextoPortal, huella: string): Promise<EstadoDelCarrito> {
  return estadoDelCarrito(ctx.tx, ctx.ambito, huella, {
    desde: await aperturaDeLaCuenta(ctx.tx, ctx.ambito),
    ahora: ctx.ahora,
    banderas: ctx.banderas,
  });
}

export const agregarAlCarrito = definirComandoPublico<
  typeof entradaAgregarAlCarrito,
  EstadoDelCarrito
>({
  nombre: 'portal.carrito_agregar',
  entidad: 'mesa',
  accion: 'carrito',
  paquetes: PAQUETES_PORTAL,
  entrada: entradaAgregarAlCarrito,
  async ejecutar(ctx, entrada) {
    exigirPedidosDesdeElTelefono(ctx);
    const huella = huellaDe(ctx, entrada.dispositivo);

    const productos = await ctx.paso('cargar_menu', () =>
      cargarProductosDelMenu(ctx.tx, ctx.ambito.organizacionId, [entrada.item.productoId]),
    );
    const producto = productos.get(entrada.item.productoId);
    if (producto === undefined) {
      throw new ErrorDominio(
        'PRODUCTO_NO_ENCONTRADO',
        'Ese producto ya no está disponible. Actualiza el menú y vuelve a intentar.',
      );
    }
    // La cantidad se valora aquí con las reglas del envío: media pieza no entra al carrito (si
    // entrara, trabaría el envío de toda la mesa). Lanza con el motivo exacto.
    valorarParaPedido(producto.paraVender, entrada.item.cantidad);

    const hay = await lineasPendientes(ctx);
    if (hay.length >= MAXIMO_EN_EL_CARRITO) {
      throw new ErrorDominio(
        'QR_CARRITO_LLENO',
        `El carrito de la mesa ya tiene ${String(MAXIMO_EN_EL_CARRITO)} cosas: envíenlo y sigan pidiendo.`,
      );
    }

    const linea = await ctx.paso('agregar', () =>
      ctx.tx
        .insertInto('carrito_mesa_lineas')
        .values({
          organizacion_id: ctx.ambito.organizacionId,
          mesa_id: ctx.ambito.mesaId,
          dispositivo_huella: huella,
          producto_id: entrada.item.productoId,
          cantidad: entrada.item.cantidad,
          notas: entrada.item.notas,
          created_at: ctx.ahora,
        })
        .returning('id')
        .executeTakeFirstOrThrow(),
    );
    await ctx.paso('latir', () => latir(ctx.tx, ctx.ambito, huella, ctx.ahora));

    ctx.auditar({
      entidadId: ctx.ambito.mesaId,
      payload: { lineaId: linea.id, productoId: entrada.item.productoId },
    });
    return estadoPara(ctx, huella);
  },
});

export const quitarDelCarrito = definirComandoPublico<
  typeof entradaQuitarDelCarrito,
  EstadoDelCarrito
>({
  nombre: 'portal.carrito_quitar',
  entidad: 'mesa',
  accion: 'carrito',
  paquetes: PAQUETES_PORTAL,
  entrada: entradaQuitarDelCarrito,
  async ejecutar(ctx, entrada) {
    exigirPedidosDesdeElTelefono(ctx);
    const huella = huellaDe(ctx, entrada.dispositivo);

    // Sólo la suya: la de otro teléfono responde igual que una que ya no está.
    const quitada = await ctx.paso('quitar', () =>
      ctx.tx
        .deleteFrom('carrito_mesa_lineas')
        .where('organizacion_id', '=', ctx.ambito.organizacionId)
        .where('mesa_id', '=', ctx.ambito.mesaId)
        .where('id', '=', entrada.lineaId)
        .where('dispositivo_huella', '=', huella)
        .returning('id')
        .executeTakeFirst(),
    );
    if (quitada === undefined) {
      throw new ErrorDominio(
        'QR_LINEA_AJENA',
        'Eso lo agregó otro teléfono (o ya no está): sólo quien lo agregó lo quita.',
      );
    }

    ctx.auditar({ entidadId: ctx.ambito.mesaId, payload: { lineaId: entrada.lineaId } });
    return estadoPara(ctx, huella);
  },
});

export interface ResultadoDelEnvio {
  /** `false`: otro teléfono lo mandó primero, o todo lo del carrito dejó de estar disponible. */
  readonly enviado: boolean;
  readonly ronda: number;
  readonly pedido: ResultadoPedido | null;
  /**
   * Lo que se quitó del carrito porque ya no se podía pedir (oculto, desactivado o con una
   * cantidad que el producto ya no admite): el pedido sale sin eso y el teléfono lo dice.
   */
  readonly noDisponibles: readonly string[];
}

export const enviarElCarrito = definirComandoPublico<
  typeof entradaEnviarElCarrito,
  ResultadoDelEnvio
>({
  nombre: 'portal.carrito_enviar',
  entidad: 'orden',
  accion: 'enviar_pedido',
  paquetes: PAQUETES_PORTAL,
  entrada: entradaEnviarElCarrito,
  async ejecutar(ctx, entrada) {
    exigirPedidosDesdeElTelefono(ctx);
    const huella = huellaDe(ctx, entrada.dispositivo);
    const { organizacionId, mesaId } = ctx.ambito;

    await ctx.paso('fila_del_carrito', () =>
      ctx.tx
        .insertInto('carritos_mesa')
        .values({ organizacion_id: organizacionId, mesa_id: mesaId })
        .onConflict((oc) => oc.columns(['organizacion_id', 'mesa_id']).doNothing())
        .execute(),
    );
    // EL CANDADO del envío: el segundo «Enviar» espera aquí y, cuando pasa, el carrito ya está
    // vacío.
    const antes = await ctx.tx
      .selectFrom('carritos_mesa')
      .select('ronda')
      .where('organizacion_id', '=', organizacionId)
      .where('mesa_id', '=', mesaId)
      .forUpdate()
      .executeTakeFirstOrThrow();

    const pendientes = await lineasPendientes(ctx);
    if (pendientes.length === 0) {
      ctx.auditar({ entidadId: mesaId, payload: { enviado: false, ronda: antes.ronda } });
      return { enviado: false, ronda: antes.ronda, pedido: null, noDisponibles: [] };
    }

    const estado = await estadoPara(ctx, huella);
    // DP-12.2 · Quién manda a cocina, decidido aquí y no en la pantalla.
    if (!comensalEnvia(estado.envio)) {
      throw estado.envio === 'llamar_mesero'
        ? new ErrorDominio(
            'QR_SOLO_EL_MESERO_ENVIA',
            'Tu mesero confirma el pedido y lo manda a cocina: llámalo para confirmar.',
          )
        : new ErrorDominio(
            'QR_PIDE_QUE_TE_ATIENDAN',
            'Pide a tu mesero que te atienda para enviar tu pedido.',
          );
    }
    if (estado.esperarATodos && !entrada.confirmado) {
      throw new ErrorDominio(
        'QR_CARRITO_SIN_CONFIRMAR',
        '¿Ya pidieron todos? Confirma para mandar el pedido completo.',
      );
    }

    // Lo que el negocio ocultó, desactivó o cambió con la mesa a medio pedir trababa el envío
    // de TODOS y sólo el teléfono que lo agregó podía quitarlo. Ahora sale del carrito para
    // todos, el pedido va sin eso y el teléfono lo dice (`carrito-disponibilidad.ts`).
    const {
      quedan: lineas,
      fuera,
      nombres,
      menu,
    } = await apartarLoQueYaNoSePide(ctx, pendientes, estado);
    const quitado = {
      noDisponibles: nombres,
      lineasQuitadas: fuera.map((l) => l.id),
      productosQuitados: fuera.map((l) => l.producto_id),
    };
    if (fuera.length > 0) {
      await ctx.paso('quitar_no_disponibles', () =>
        ctx.tx
          .deleteFrom('carrito_mesa_lineas')
          .where('organizacion_id', '=', organizacionId)
          .where('id', 'in', quitado.lineasQuitadas)
          .execute(),
      );
    }
    if (lineas.length === 0) {
      ctx.auditar({
        entidadId: mesaId,
        payload: { enviado: false, ronda: antes.ronda, ...quitado },
      });
      return { enviado: false, ronda: antes.ronda, pedido: null, noDisponibles: nombres };
    }

    // Con la mesa cerrada y el negocio dejando abrirla al enviar, se abre aquí, para tantas personas
    // como teléfonos hay conectados (el mesero lo corrige al llegar).
    const abrio = estado.envio === 'abrir_y_enviar';
    if (abrio) {
      await abrirLaMesaDelPortal(
        ctx,
        {
          personas: Math.max(1, estado.conectados),
          clienteNombre: '',
          notas: '',
          notasAlergias: '',
          celebracionEspecial: false,
          tipoCelebracion: '',
        },
        ctx.ambito.empleadoAsignadoId ?? ctx.ambito.empleadoAtiendeId,
      );
    }
    // La cuenta, con su candado: si la caja la cierra mientras tanto, aquí se espera y se dice.
    const orden = await ctx.paso('cargar_venta', () => ordenAbiertaDeLaMesa(ctx));

    const pedido = await pedirEnLaMesa(
      ctx,
      orden,
      lineas.map((l) => ({ productoId: l.producto_id, cantidad: l.cantidad, notas: l.notas })),
      entrada.notaGeneral,
      menu,
    );

    await ctx.paso('vaciar', () =>
      ctx.tx
        .deleteFrom('carrito_mesa_lineas')
        .where('organizacion_id', '=', organizacionId)
        .where(
          'id',
          'in',
          lineas.map((l) => l.id),
        )
        .execute(),
    );
    const ronda = antes.ronda + 1;
    await ctx.paso('subir_la_ronda', () =>
      ctx.tx
        .updateTable('carritos_mesa')
        .set({ ronda, enviado_en: ctx.ahora, enviado_por_huella: huella })
        .where('organizacion_id', '=', organizacionId)
        .where('mesa_id', '=', mesaId)
        .execute(),
    );

    ctx.auditar({
      entidadId: orden.id,
      payload: {
        enviado: true,
        ronda,
        abrioLaMesa: abrio,
        lineas: pedido.lineas,
        comandas: pedido.comandas,
        totalCentavos: pedido.totalCentavos,
        ...quitado,
      },
    });
    return { enviado: true, ronda, pedido, noDisponibles: nombres };
  },
});
