import 'server-only';

import { ErrorDominio, PAQUETES_RESTAURANTE } from '@morphiqpos/contracts';
import type { Transaccion } from '@morphiqpos/data';
import { z } from 'zod';

import { definirComando, type ContextoComando } from '../definicion.ts';
import type { EstadoDelCarrito } from '../portal/carrito.ts';
import { cantidadPedida } from '../portal/esquemas.ts';
import { cargarProductosDelMenu, valorarParaPedido } from '../portal/productos.ts';
import { resolverElAvisoDelPedido } from './carrito-del-salon.ts';
import {
  estadoDelCarritoParaElMesero,
  huellaDelPersonal,
  mesaDelCarritoParaElMesero,
  type MesaDelCarritoDelMesero,
} from './carrito-del-mesero-lectura.ts';
import { comandarLasLineas, type ResultadoEnviarPedido } from './pedido.ts';
import { quedarseConLaMesa } from './responsable-de-la-mesa.ts';

/**
 * EL CARRITO DEL PORTAL EN MODO MESERO (DP-12.2) · los cuatro poderes del mesero.
 *
 * Lo que los comensales arman en sus teléfonos lo confirma el mesero: cambia cantidades, quita
 * cualquier línea (no sólo «la suya»), borra el pedido entero cuando la mesa se fue sin pedir, y
 * lo manda a cocina A SU NOMBRE por el mismo camino que su propio pedido (`comandarLasLineas`).
 * Abrir la mesa es el `restaurante.abrir_mesa` de siempre.
 *
 * Todo dentro de su sesión: el rol y la sucursal los decide el servidor (`sucursal: { mesaId }` y
 * `mesaDelCarritoParaElMesero`), y cada cambio queda auditado con su empleo. Los cuatro toman la
 * fila de `carritos_mesa` con candado, la misma que toma el envío del comensal: un mesero y un
 * comensal que envían a la vez son UN pedido.
 */

/** Quien atiende la sala. La caja no: no ve las solicitudes del comensal (DP-D24). */
const ROLES_DEL_CARRITO = ['mesero', 'gerente', 'administrador', 'dueno'] as const;

const mesa = z.uuid();
const entradaCambiarEnElCarrito = z.object({
  mesaId: mesa,
  lineaId: z.uuid(),
  cantidad: cantidadPedida,
});
const entradaQuitarDelCarritoDeLaMesa = z.object({ mesaId: mesa, lineaId: z.uuid() });
const entradaVaciarElCarrito = z.object({ mesaId: mesa });
const entradaEnviarElCarritoDeLaMesa = z.object({
  mesaId: mesa,
  /** La nota para cocina de la comanda entera («todo junto»). */
  notaGeneral: z.string().trim().max(300).default(''),
});

type Ctx = ContextoComando<Transaccion>;

/** La mesa, ya resuelta y comprobada, con la fila de su carrito tomada con candado. */
async function tomarElCarrito(ctx: Ctx, mesaId: string): Promise<MesaDelCarritoDelMesero> {
  const delCarrito = await ctx.paso('cargar_mesa', () =>
    mesaDelCarritoParaElMesero(ctx.tx, ctx.ambito, { mesaId }),
  );
  await ctx.paso('tomar_el_carrito', async () => {
    await ctx.tx
      .insertInto('carritos_mesa')
      .values({ organizacion_id: ctx.ambito.organizacionId, mesa_id: delCarrito.id })
      .onConflict((oc) => oc.columns(['organizacion_id', 'mesa_id']).doNothing())
      .execute();
    await ctx.tx
      .selectFrom('carritos_mesa')
      .select('ronda')
      .where('organizacion_id', '=', ctx.ambito.organizacionId)
      .where('mesa_id', '=', delCarrito.id)
      .forUpdate()
      .executeTakeFirstOrThrow();
  });
  return delCarrito;
}

function lineaQueYaNoEsta(): ErrorDominio {
  return new ErrorDominio(
    'CARRITO_LINEA_NO_ENCONTRADA',
    'Eso ya no está en el pedido de la mesa: alguien lo quitó o ya salió a cocina.',
  );
}

export const cambiarEnElCarrito = definirComando<
  Transaccion,
  typeof entradaCambiarEnElCarrito,
  EstadoDelCarrito
>({
  nombre: 'restaurante.carrito_cambiar',
  entidad: 'mesa',
  escribe: true,
  roles: [...ROLES_DEL_CARRITO],
  paquetes: PAQUETES_RESTAURANTE,
  sucursal: { mesaId: 'mesas' },
  sinFrontera: {
    lineaId:
      'Una línea del carrito de ESA mesa: se busca con `mesa_id = mesaId`, y la mesa ya pasó la frontera.',
  },
  entrada: entradaCambiarEnElCarrito,
  async ejecutar(ctx, entrada) {
    const delCarrito = await tomarElCarrito(ctx, entrada.mesaId);
    const linea = await ctx.tx
      .selectFrom('carrito_mesa_lineas')
      .select('producto_id')
      .where('organizacion_id', '=', ctx.ambito.organizacionId)
      .where('mesa_id', '=', delCarrito.id)
      .where('id', '=', entrada.lineaId)
      .executeTakeFirst();
    if (linea === undefined) throw lineaQueYaNoEsta();
    // Con las reglas del producto, si sigue en el menú (media pieza no entra); si ya no, el envío
    // lo dirá con su nombre.
    const producto = (
      await cargarProductosDelMenu(ctx.tx, ctx.ambito.organizacionId, [linea.producto_id])
    ).get(linea.producto_id);
    if (producto !== undefined) valorarParaPedido(producto.paraVender, entrada.cantidad);
    await ctx.paso('cambiar', () =>
      ctx.tx
        .updateTable('carrito_mesa_lineas')
        .set({ cantidad: entrada.cantidad })
        .where('organizacion_id', '=', ctx.ambito.organizacionId)
        .where('id', '=', entrada.lineaId)
        .execute(),
    );
    ctx.auditar({
      entidadId: delCarrito.id,
      payload: { lineaId: entrada.lineaId, cantidad: entrada.cantidad },
    });
    return estadoDelCarritoParaElMesero(ctx.tx, ctx.ambito, delCarrito, ctx.ahora);
  },
});

export const quitarDelCarritoDeLaMesa = definirComando<
  Transaccion,
  typeof entradaQuitarDelCarritoDeLaMesa,
  EstadoDelCarrito
>({
  nombre: 'restaurante.carrito_quitar',
  entidad: 'mesa',
  escribe: true,
  roles: [...ROLES_DEL_CARRITO],
  paquetes: PAQUETES_RESTAURANTE,
  sucursal: { mesaId: 'mesas' },
  sinFrontera: {
    lineaId:
      'Una línea del carrito de ESA mesa: se busca con `mesa_id = mesaId`, y la mesa ya pasó la frontera.',
  },
  entrada: entradaQuitarDelCarritoDeLaMesa,
  async ejecutar(ctx, entrada) {
    const delCarrito = await tomarElCarrito(ctx, entrada.mesaId);
    const quitada = await ctx.paso('quitar', () =>
      ctx.tx
        .deleteFrom('carrito_mesa_lineas')
        .where('organizacion_id', '=', ctx.ambito.organizacionId)
        .where('mesa_id', '=', delCarrito.id)
        .where('id', '=', entrada.lineaId)
        .returning(['producto_id', 'cantidad'])
        .executeTakeFirst(),
    );
    if (quitada === undefined) throw lineaQueYaNoEsta();
    ctx.auditar({
      entidadId: delCarrito.id,
      payload: { lineaId: entrada.lineaId, productoId: quitada.producto_id },
    });
    return estadoDelCarritoParaElMesero(ctx.tx, ctx.ambito, delCarrito, ctx.ahora);
  },
});

export const vaciarElCarrito = definirComando<
  Transaccion,
  typeof entradaVaciarElCarrito,
  EstadoDelCarrito
>({
  nombre: 'restaurante.carrito_vaciar',
  entidad: 'mesa',
  escribe: true,
  roles: [...ROLES_DEL_CARRITO],
  paquetes: PAQUETES_RESTAURANTE,
  sucursal: { mesaId: 'mesas' },
  entrada: entradaVaciarElCarrito,
  async ejecutar(ctx, entrada) {
    const delCarrito = await tomarElCarrito(ctx, entrada.mesaId);
    const borradas = await ctx.paso('vaciar', () =>
      ctx.tx
        .deleteFrom('carrito_mesa_lineas')
        .where('organizacion_id', '=', ctx.ambito.organizacionId)
        .where('mesa_id', '=', delCarrito.id)
        .executeTakeFirst(),
    );
    // Los comensales se fueron: su «Pedido listo para confirmar» tampoco espera a nadie.
    await ctx.paso('resolver_el_aviso', () =>
      resolverElAvisoDelPedido(ctx.tx, ctx.ambito, delCarrito.id, ctx.ahora),
    );
    ctx.auditar({
      entidadId: delCarrito.id,
      payload: { lineasBorradas: Number(borradas.numDeletedRows) },
    });
    return estadoDelCarritoParaElMesero(ctx.tx, ctx.ambito, delCarrito, ctx.ahora);
  },
});

export interface ResultadoDelEnvioDelMesero {
  readonly enviado: boolean;
  readonly ronda: number;
  readonly pedido: ResultadoEnviarPedido | null;
}

export const enviarElCarritoDeLaMesa = definirComando<
  Transaccion,
  typeof entradaEnviarElCarritoDeLaMesa,
  ResultadoDelEnvioDelMesero
>({
  nombre: 'restaurante.carrito_enviar',
  entidad: 'comanda',
  escribe: true,
  roles: [...ROLES_DEL_CARRITO],
  paquetes: PAQUETES_RESTAURANTE,
  sucursal: { mesaId: 'mesas' },
  entrada: entradaEnviarElCarritoDeLaMesa,
  async ejecutar(ctx, entrada) {
    const { organizacionId, empleoId } = ctx.ambito;
    const delCarrito = await tomarElCarrito(ctx, entrada.mesaId);
    const ordenId = delCarrito.ordenId;
    if (ordenId === null) {
      throw new ErrorDominio('CARRITO_SIN_CUENTA', 'Abre la mesa antes de mandar el pedido.');
    }
    const lineas = await ctx.tx
      .selectFrom('carrito_mesa_lineas')
      .select(['id', 'producto_id', 'cantidad', 'notas'])
      .where('organizacion_id', '=', organizacionId)
      .where('mesa_id', '=', delCarrito.id)
      .orderBy('created_at')
      .orderBy('id')
      .execute();
    const { ronda: antes } = await ctx.tx
      .selectFrom('carritos_mesa')
      .select('ronda')
      .where('organizacion_id', '=', organizacionId)
      .where('mesa_id', '=', delCarrito.id)
      .executeTakeFirstOrThrow();
    if (lineas.length === 0) {
      ctx.auditar({ entidadId: ordenId, payload: { enviado: false, ronda: antes } });
      return { enviado: false, ronda: antes, pedido: null };
    }

    const pedido = await comandarLasLineas(ctx, {
      ordenId,
      lineas: lineas.map((l) => ({
        productoId: l.producto_id,
        cantidad: l.cantidad,
        ...(l.notas === '' ? {} : { notas: l.notas }),
      })),
      ...(entrada.notaGeneral === '' ? {} : { notas: entrada.notaGeneral }),
    });
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
    const ronda = antes + 1;
    await ctx.paso('subir_la_ronda', () =>
      ctx.tx
        .updateTable('carritos_mesa')
        .set({ ronda, enviado_en: ctx.ahora, enviado_por_huella: huellaDelPersonal(empleoId) })
        .where('organizacion_id', '=', organizacionId)
        .where('mesa_id', '=', delCarrito.id)
        .execute(),
    );
    await ctx.paso('resolver_el_aviso', () =>
      resolverElAvisoDelPedido(ctx.tx, ctx.ambito, delCarrito.id, ctx.ahora),
    );
    // Como al atender un aviso (DP-9.2): el MESERO que confirma el pedido de una mesa sin
    // responsable se queda con ella y con su cuenta.
    const tomada =
      ctx.ambito.rol === 'mesero'
        ? await ctx.paso('quedarse_con_la_mesa', () =>
            quedarseConLaMesa(ctx.tx, organizacionId, delCarrito.id, empleoId),
          )
        : null;

    ctx.auditar({
      entidadId: ordenId,
      payload: {
        enviado: true,
        ronda,
        mesaId: delCarrito.id,
        lineas: pedido.lineas,
        comandas: pedido.comandas.length,
        estaciones: pedido.comandas.map((c) => c.estacionNombre),
        totalCentavos: pedido.totalCentavos,
        tomoLaMesa: tomada?.mesa ?? false,
      },
    });
    return { enviado: true, ronda, pedido };
  },
});
