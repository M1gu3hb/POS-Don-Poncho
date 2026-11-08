import 'server-only';

import { ErrorDominio, PAQUETES_PORTAL } from '@morphiqpos/contracts';
import type { z } from 'zod';

import {
  MAXIMO_EN_EL_CARRITO,
  aperturaDeLaCuenta,
  carritoCaducado,
  entradaAgregarAlCarrito,
  entradaEnviarElCarrito,
  entradaQuitarDelCarrito,
  estadoDelCarrito,
  latir,
  ultimaDe,
  type EstadoDelCarrito,
} from './carrito.ts';
import {
  candadoDelCarrito,
  olvidarElCarritoDeLaMesa,
  resolverElAvisoDelPedido,
  resolverElAvisoSiQuedoVacio,
} from '../restaurante/carrito-del-salon.ts';
import { elegirLasOpciones, gruposDeLosPlatillos } from '../restaurante/opciones-de-la-linea.ts';
import { apartarLoQueYaNoSePide } from './carrito-disponibilidad.ts';
import { definirComandoPublico, type ContextoPortal } from './definicion-publica.ts';
import { abrirLaMesaDelPortal, exigirPedidosDesdeElTelefono } from './mesa.ts';
import { ordenAbiertaDeLaMesa, pedirEnLaMesa, type ResultadoPedido } from './pedido.ts';
import { exigirNoAgotados } from '../catalogo/agotado.ts';
import { cargarProductosDelMenu, valorarParaPedido } from './productos.ts';
import type { entradaAbrirMesa } from './esquemas.ts';
import { comensalEnvia, type ComoSeEnvia } from './quien-envia.ts';
import { huellaDelTelefono } from './telefono.ts';

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

/** DP-13.3 · La huella del teléfono, o `QR_TELEFONO_NO_RECONOCIDO` si el id no lo firmó el servidor. */
function huellaDe(ctx: ContextoPortal, dispositivo: string): string {
  return huellaDelTelefono(ctx.pimienta, dispositivo);
}

/** Sin los datos de la apertura (un teléfono anterior), la mesa se abre para una persona. */
const APERTURA_PARA_UNA_PERSONA: z.output<typeof entradaAbrirMesa> = {
  personas: 1,
  clienteNombre: '',
  notas: '',
  notasAlergias: '',
  celebracionEspecial: false,
  tipoCelebracion: '',
};

/** Por qué el comensal no manda a cocina desde su teléfono, con las palabras que ve. */
function porQueNoEnvia(como: ComoSeEnvia): ErrorDominio {
  if (como === 'cuenta_pedida') {
    return new ErrorDominio('QR_CUENTA_PEDIDA', 'Tu cuenta ya se pidió: tu mesero lo revisa.');
  }
  if (como === 'llamar_mesero') {
    return new ErrorDominio(
      'QR_SOLO_EL_MESERO_ENVIA',
      'Tu mesero confirma el pedido y lo manda a cocina: llámalo para confirmar.',
    );
  }
  return new ErrorDominio(
    'QR_PIDE_QUE_TE_ATIENDAN',
    'Pide a tu mesero que te atienda para enviar tu pedido.',
  );
}

async function lineasPendientes(ctx: ContextoPortal) {
  return ctx.tx
    .selectFrom('carrito_mesa_lineas')
    .select(['id', 'producto_id', 'cantidad', 'notas', 'created_at'])
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
    // DP-15 · Agotado del día: sigue en el menú, pero no entra al carrito.
    exigirNoAgotados([producto], ctx.ahora);
    // La cantidad se valora aquí con las reglas del envío: media pieza no entra al carrito (si
    // entrara, trabaría el envío de toda la mesa). Lanza con el motivo exacto.
    valorarParaPedido(producto.paraVender, entrada.item.cantidad);
    // DP-14.6 · Y su opción obligatoria (en la nota, como la pliega el portal): sin ella no entra,
    // porque al enviar el servidor la exige (DP-D67). Lanza con el grupo que falta.
    const grupos = await ctx.paso('opciones_del_platillo', () =>
      gruposDeLosPlatillos(ctx.tx, ctx.ambito.organizacionId, [entrada.item.productoId]),
    );
    elegirLasOpciones(
      producto.nombre,
      grupos.get(entrada.item.productoId) ?? [],
      undefined,
      entrada.item.notas,
    );

    // Revisión de DP-13: el candado del carrito, como llamar y enviar: dos teléfonos que agregan a
    // la vez no se cruzan con la caducidad ni con el aviso.
    await ctx.paso('candado_del_carrito', () =>
      candadoDelCarrito(ctx.tx, ctx.ambito.organizacionId, ctx.ambito.mesaId),
    );
    let hay = await lineasPendientes(ctx);
    // DP-13.2: lo de una mesa sin cuenta que nadie tocó en horas caduca aquí, antes de lo nuevo (y
    // su aviso con él).
    const apertura = await aperturaDeLaCuenta(ctx.tx, ctx.ambito);
    if (carritoCaducado(ultimaDe(hay), apertura, ctx.ahora)) {
      await ctx.paso('caducar', () =>
        olvidarElCarritoDeLaMesa(ctx.tx, ctx.ambito.organizacionId, ctx.ambito.mesaId, ctx.ahora),
      );
      hay = [];
    }
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
    // Revisión de DP-13: con el candado del carrito, quitar no se cruza con «llamar».
    await ctx.paso('candado_del_carrito', () =>
      candadoDelCarrito(ctx.tx, ctx.ambito.organizacionId, ctx.ambito.mesaId),
    );

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
    // DP-13.2: si era lo último del carrito, su «Pedido listo para confirmar» ya no espera a nadie.
    await ctx.paso('resolver_el_aviso', () =>
      resolverElAvisoSiQuedoVacio(
        ctx.tx,
        ctx.ambito.organizacionId,
        ctx.ambito.mesaId,
        null,
        ctx.ahora,
      ),
    );

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

    let pendientes = await lineasPendientes(ctx);
    // Revisión de DP-13: lo caducado no sale a cocina; se borra, con su aviso.
    if (
      carritoCaducado(ultimaDe(pendientes), await aperturaDeLaCuenta(ctx.tx, ctx.ambito), ctx.ahora)
    ) {
      await ctx.paso('caducar', () =>
        olvidarElCarritoDeLaMesa(ctx.tx, organizacionId, mesaId, ctx.ahora),
      );
      pendientes = [];
    }
    if (pendientes.length === 0) {
      ctx.auditar({ entidadId: mesaId, payload: { enviado: false, ronda: antes.ronda } });
      return { enviado: false, ronda: antes.ronda, pedido: null, noDisponibles: [] };
    }

    const estado = await estadoPara(ctx, huella);
    // DP-12.2 · Quién manda a cocina, decidido aquí y no en la pantalla.
    if (!comensalEnvia(estado.envio)) throw porQueNoEnvia(estado.envio);
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

    // Con la mesa cerrada y el negocio dejando abrirla al enviar, se abre aquí, EN ESTA MISMA
    // transacción (DP-13.3): si el envío falla más abajo, la mesa no queda abierta. Las personas son
    // las que el comensal confirmó en el diálogo (`apertura`); sin ellas, UNA y el mesero lo corrige:
    // nunca los teléfonos conectados, que ya no son una cifra de fiar para esto.
    const abrio = estado.envio === 'abrir_y_enviar';
    const apertura = entrada.apertura ?? APERTURA_PARA_UNA_PERSONA;
    if (abrio) {
      await abrirLaMesaDelPortal(
        ctx,
        apertura,
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
    // DP-13.2: lo envió el comensal; el aviso que esperaba al mesero ya no espera a nadie.
    await ctx.paso('resolver_el_aviso', () =>
      resolverElAvisoDelPedido(ctx.tx, organizacionId, mesaId, null, ctx.ahora),
    );

    ctx.auditar({
      entidadId: orden.id,
      payload: {
        enviado: true,
        ronda,
        abrioLaMesa: abrio,
        ...(abrio ? { personasAlAbrir: apertura.personas } : {}),
        lineas: pedido.lineas,
        comandas: pedido.comandas,
        totalCentavos: pedido.totalCentavos,
        ...quitado,
      },
    });
    return { enviado: true, ronda, pedido, noDisponibles: nombres };
  },
});
