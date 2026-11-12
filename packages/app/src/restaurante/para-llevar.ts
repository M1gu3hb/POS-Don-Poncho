import 'server-only';

import { ErrorDominio, PAQUETES_RESTAURANTE } from '@morphiqpos/contracts';
import type { Transaccion } from '@morphiqpos/data';
import { repoCaja, repoOrdenes } from '@morphiqpos/data';
import type { TotalesOrden } from '@morphiqpos/domain/venta';
import { z } from 'zod';

import { definirComando, type ContextoComando } from '../definicion.ts';
import { cotizar } from '../venta/cotizar.ts';
import { entradaEnviarPedido } from './esquemas.ts';
import { insertarLineas } from './lineas.ts';
import { prepararLasOpciones } from './opciones-de-la-linea.ts';
import { prepararTodas } from './pedido.ts';
import { lineaConLasOpciones } from './precio-de-las-opciones.ts';

/**
 * DP-16 · EL PEDIDO PARA LLEVAR, tomado en la Caja y cobrado ahí mismo.
 *
 * La cajera arma el pedido en la misma pantalla del mesero (categorías, opciones, notas,
 * barbacoa por peso, agotados), pero sin mesa. Al tocar «Cobrar», este comando escribe ese
 * pedido como el borrador de SU terminal —el mismo carrito del mostrador, con `canal = 'llevar'`
 * y el nombre opcional del cliente— con el precio del catálogo y las opciones validadas, y
 * devuelve la orden para abrir el diálogo de cobro de la Caja de siempre.
 *
 * ── Por qué NADA sale a cocina aquí ────────────────────────────────────────
 * Las comandas salen en `venta.cobrar` (`comandarLineasPendientes`), dentro de la transacción
 * del cobro: o hay venta y comanda, o no hay ninguna. Si la cajera cancela el cobro, la cocina no
 * se entera de nada, y `descartar_para_llevar` deja el borrador vacío.
 *
 * ── Por qué el borrador de la terminal y no una orden nueva cada vez ──────────
 * Hay un borrador por terminal (índice único). Volver a tocar «Cobrar» tras corregir el pedido
 * REEMPLAZA las líneas del mismo borrador: no quedan órdenes huérfanas ni líneas duplicadas.
 */

const ROLES_DE_CAJA = ['cajero', 'gerente', 'administrador', 'dueno'] as const;

export const entradaArmarParaLlevar = z.object({
  /** El nombre que se grita al entregar. Opcional; vacío es «sin nombre». */
  nombrePedido: z.string().trim().max(60).optional(),
  lineas: entradaEnviarPedido.shape.lineas,
});

export const entradaDescartarParaLlevar = z.object({ ordenId: z.uuid() });

export interface ResultadoArmarParaLlevar {
  readonly ordenId: string;
  readonly lineas: number;
  /** El total lo calcula el servidor sobre las líneas que acaba de escribir. */
  readonly totalCentavos: string;
}

export const armarParaLlevar = definirComando<
  Transaccion,
  typeof entradaArmarParaLlevar,
  ResultadoArmarParaLlevar
>({
  nombre: 'restaurante.armar_para_llevar',
  entidad: 'orden',
  escribe: true,
  roles: [...ROLES_DE_CAJA],
  paquetes: PAQUETES_RESTAURANTE,
  entrada: entradaArmarParaLlevar,
  async ejecutar(ctx, entrada) {
    const { organizacionId } = ctx.ambito;
    const ordenId = await borradorDeLaCaja(ctx);

    // DP-18 · M1: sólo los renglones de una cuenta que SIGUE en borrador (con su candado tomado en
    // `borradorDeLaCaja`, esto es la red: nunca se le borra un renglón a una cuenta cobrada).
    await ctx.paso('vaciar_borrador', () =>
      ctx.tx
        .deleteFrom('orden_lineas')
        .where('organizacion_id', '=', organizacionId)
        .where('orden_id', '=', ordenId)
        .where((eb) =>
          eb.exists(
            eb
              .selectFrom('ordenes')
              .select('ordenes.id')
              .where('ordenes.id', '=', ordenId)
              .where('ordenes.estado', '=', 'borrador'),
          ),
        )
        .execute(),
    );
    const nombre =
      entrada.nombrePedido === undefined || entrada.nombrePedido === ''
        ? null
        : entrada.nombrePedido;
    await ctx.paso('sellar_canal', () =>
      ctx.tx
        .updateTable('ordenes')
        .set({ canal: 'llevar', nombre_pedido: nombre })
        .where('organizacion_id', '=', organizacionId)
        .where('id', '=', ordenId)
        .where('estado', '=', 'borrador')
        .execute(),
    );

    // El precio, el agotado y la opción obligatoria: las mismas reglas que el pedido del mesero.
    const valoradas = await ctx.paso('valorar_lineas', () =>
      prepararTodas(ctx.tx, organizacionId, { ordenId, lineas: entrada.lineas }, ctx.ahora),
    );
    const elegidas = await ctx.paso('opciones', () =>
      prepararLasOpciones(
        ctx.tx,
        organizacionId,
        valoradas.map((l, i) => ({
          productoId: l.producto.id,
          productoNombre: l.producto.nombre,
          notas: l.notas,
          opciones: entrada.lineas[i]?.opciones,
        })),
      ),
    );
    // Para llevar no hay tiempos: todo sale junto al cobrar.
    const preparadas = valoradas.map((l, i) => ({
      ...lineaConLasOpciones(l, elegidas[i] ?? []),
      marchaEstado: 'inmediata' as const,
    }));
    await ctx.paso('escribir_lineas', () =>
      insertarLineas(ctx.tx, organizacionId, ordenId, preparadas),
    );

    const { totales } = await ctx.paso('cotizar', () => cotizar(ctx.tx, organizacionId, ordenId));
    await ctx.paso('sellar_totales', () => sellarTotales(ctx.tx, organizacionId, ordenId, totales));

    ctx.auditar({
      entidadId: ordenId,
      payload: {
        lineas: preparadas.length,
        conNombre: nombre !== null,
        totalCentavos: totales.totalCentavos.toString(),
      },
    });
    return {
      ordenId,
      lineas: preparadas.length,
      totalCentavos: totales.totalCentavos.toString(),
    };
  },
});

/**
 * El cobro se canceló: el borrador queda vacío y vuelve a ser el carrito de siempre. El pedido
 * sigue en la pantalla de la cajera (se guarda en el aparato), así que no se pierde nada.
 */
export const descartarParaLlevar = definirComando<
  Transaccion,
  typeof entradaDescartarParaLlevar,
  { quitadas: number }
>({
  nombre: 'restaurante.descartar_para_llevar',
  entidad: 'orden',
  escribe: true,
  roles: [...ROLES_DE_CAJA],
  paquetes: PAQUETES_RESTAURANTE,
  sucursal: { ordenId: 'ordenes' },
  entrada: entradaDescartarParaLlevar,
  async ejecutar(ctx, entrada) {
    const { organizacionId, terminalId } = ctx.ambito;
    const orden = await ctx.paso('cargar_orden', () =>
      ctx.tx
        .selectFrom('ordenes')
        .select(['estado', 'canal', 'terminal_id'])
        .where('organizacion_id', '=', organizacionId)
        .where('id', '=', entrada.ordenId)
        .forUpdate()
        .executeTakeFirst(),
    );
    // Lo cobrado no se descarta (su comanda ya está en la cocina), y el borrador de OTRA caja
    // tampoco: cada terminal vacía el suyo.
    if (
      orden?.estado !== 'borrador' ||
      orden.canal !== 'llevar' ||
      orden.terminal_id !== terminalId
    ) {
      ctx.auditar({ entidadId: entrada.ordenId, payload: { quitadas: 0 } });
      return { quitadas: 0 };
    }
    const resultado = await ctx.paso('vaciar', () =>
      ctx.tx
        .deleteFrom('orden_lineas')
        .where('organizacion_id', '=', organizacionId)
        .where('orden_id', '=', entrada.ordenId)
        .executeTakeFirst(),
    );
    await ctx.paso('volver_a_mostrador', () =>
      ctx.tx
        .updateTable('ordenes')
        .set({
          canal: 'aqui',
          nombre_pedido: null,
          subtotal_centavos: 0n,
          descuento_centavos: 0n,
          impuestos_centavos: 0n,
          total_centavos: 0n,
        })
        .where('organizacion_id', '=', organizacionId)
        .where('id', '=', entrada.ordenId)
        .where('estado', '=', 'borrador')
        .execute(),
    );
    const quitadas = Number(resultado.numDeletedRows);
    ctx.auditar({ entidadId: entrada.ordenId, payload: { quitadas } });
    return { quitadas };
  },
});

/** El borrador de esta terminal (o uno nuevo). Sin caja abierta no se toma: no se podría cobrar. */
async function borradorDeLaCaja(ctx: ContextoComando<Transaccion>): Promise<string> {
  const { organizacionId, sucursalId, terminalId, empleoId } = ctx.ambito;
  if (sucursalId === null || terminalId === null) {
    throw new ErrorDominio(
      'VENTA_SIN_TERMINAL',
      'Para vender hace falta una terminal dada de alta en una sucursal.',
    );
  }
  const sesion = await ctx.paso('cargar_caja', () =>
    repoCaja.sesionAbiertaDeTerminal(ctx.tx, organizacionId, terminalId),
  );
  if (sesion === null) {
    throw new ErrorDominio('CAJA_CERRADA', 'Abre la caja antes de tomar un pedido para llevar.');
  }
  // DP-18 · M1 (auditoría del 10-11). Primero la TERMINAL con candado: dos «armar» del mismo
  // aparato a la vez (un doble toque, dos pestañas) se forman en fila; antes los dos veían que no
  // había borrador, los dos lo creaban y el segundo moría con 23505 (un borrador por terminal).
  await ctx.paso('bloquear_terminal', () =>
    ctx.tx
      .selectFrom('terminales')
      .select('id')
      .where('organizacion_id', '=', organizacionId)
      .where('id', '=', terminalId)
      .forUpdate()
      .executeTakeFirstOrThrow(),
  );
  // Luego el borrador con candado: si un cobro de ESE borrador va en vuelo, se espera a que
  // termine; si quedó pagado, ya no es borrador (Postgres vuelve a mirar el `where` al soltarse el
  // candado) y se empieza uno nuevo. Antes se leía sin candado y se le reescribían los renglones a
  // la cuenta que en ese instante quedaba cobrada.
  const existente = await ctx.paso('buscar_borrador', () =>
    ctx.tx
      .selectFrom('ordenes')
      .select('id')
      .where('organizacion_id', '=', organizacionId)
      .where('terminal_id', '=', terminalId)
      .where('estado', '=', 'borrador')
      .forUpdate()
      .executeTakeFirst(),
  );
  if (existente !== undefined) return existente.id;
  return ctx.paso('crear_borrador', () =>
    repoOrdenes.crearBorrador(ctx.tx, {
      organizacionId,
      sucursalId,
      terminalId,
      empleadoAtiendeId: empleoId,
      sesionCajaId: null,
    }),
  );
}

async function sellarTotales(
  tx: Transaccion,
  organizacionId: string,
  ordenId: string,
  totales: TotalesOrden,
): Promise<void> {
  await tx
    .updateTable('ordenes')
    .set({
      subtotal_centavos: totales.subtotalCentavos,
      descuento_centavos: totales.descuentoCentavos,
      impuestos_centavos: totales.impuestosCentavos,
      total_centavos: totales.totalCentavos,
      costo_total_centavos: totales.costoTotalCentavos,
      utilidad_centavos: totales.utilidadCentavos,
      margen_bp: totales.margenBp,
    })
    .where('organizacion_id', '=', organizacionId)
    .where('id', '=', ordenId)
    .where('estado', '=', 'borrador')
    .execute();
}
