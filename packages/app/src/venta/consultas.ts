import 'server-only';

import { ErrorDominio, PAQUETES_MOSTRADOR } from '@morphiqpos/contracts';
import type { Transaccion } from '@morphiqpos/data';
import { repoOrdenes, repoCaja } from '@morphiqpos/data';

import { definirComando } from '../definicion.ts';
import { opcionConSuPrecio } from '../restaurante/precio-de-las-opciones.ts';
import { cotizar, type Cotizacion } from './cotizar.ts';
import { entradaEstadoVenta, entradaTicket } from './esquemas.ts';

/**
 * Las lecturas de la pantalla de venta (F1.1-A-07 y A-12).
 *
 * Van por el mismo envoltorio que las escrituras y no por un `fetch` suelto,
 * porque el ámbito y el rol se comprueban igual: leer el catálogo de otra
 * organización es una fuga, aunque no cambie nada.
 */

const ROLES_DE_MOSTRADOR = ['cajero', 'mesero', 'gerente', 'administrador', 'dueno'] as const;

/**
 * Quien ve lo que la cuenta le CUESTA al negocio: dirección. La caja y el mesero cobran y
 * atienden, y con el precio a la vista el costo da el margen de cada platillo (lo mismo
 * que el puente cierra en `Venta`; el corte lo abre a la caja sólo con su bandera).
 */
const VEN_COSTOS: readonly string[] = ['dueno', 'administrador', 'gerente'];

/** La cotización como la recibe quien la pide: sin costo, utilidad ni margen si no los ve. */
export type CotizacionVisible = Omit<
  Cotizacion,
  'costoTotalCentavos' | 'utilidadCentavos' | 'margenBp'
> & {
  readonly costoTotalCentavos: string | null;
  readonly utilidadCentavos: string | null;
  readonly margenBp: number | null;
};

export function cotizacionPara(rol: string, cotizacion: Cotizacion): CotizacionVisible {
  if (VEN_COSTOS.includes(rol)) return cotizacion;
  return { ...cotizacion, costoTotalCentavos: null, utilidadCentavos: null, margenBp: null };
}

export interface EstadoVenta {
  readonly cotizacion: CotizacionVisible | null;
  /** `null` = no hay caja abierta en esta terminal; la pantalla lo dice antes de cobrar. */
  readonly sesionCajaId: string | null;
  /**
   * DP-14.6-3 · Lo que se eligió de las opciones de cada línea («Salsa: Verde»), por id de línea:
   * el cajero lo lee en la cuenta. Sin opciones, la línea no sale aquí.
   */
  readonly opcionesPorLinea: Readonly<Record<string, string>>;
}

/** El texto de las opciones elegidas de cada línea (la forma consultable, no la nota). */
async function opcionesDeLasLineas(
  tx: Transaccion,
  lineaIds: readonly string[],
): Promise<Readonly<Record<string, string>>> {
  if (lineaIds.length === 0) return {};
  const filas = await tx
    .selectFrom('orden_linea_modificadores')
    .select(['orden_linea_id', 'modificador_nombre', 'opcion_nombre', 'delta_precio_centavos'])
    .where('orden_linea_id', 'in', [...lineaIds])
    .orderBy('created_at')
    .orderBy('id')
    .execute();
  const porLinea = new Map<string, Map<string, string[]>>();
  for (const f of filas) {
    const grupos = porLinea.get(f.orden_linea_id) ?? new Map<string, string[]>();
    grupos.set(f.modificador_nombre, [
      ...(grupos.get(f.modificador_nombre) ?? []),
      // DP-16 · Con su precio: la cuenta, la precuenta y el ticket dicen cuánto sumó.
      opcionConSuPrecio(f.opcion_nombre, f.delta_precio_centavos),
    ]);
    porLinea.set(f.orden_linea_id, grupos);
  }
  return Object.fromEntries(
    [...porLinea].map(([id, grupos]) => [
      id,
      [...grupos].map(([g, o]) => `${g}: ${o.join(', ')}`).join(' · '),
    ]),
  );
}

/**
 * El estado completo de la venta en curso.
 *
 * Sin `ordenId` devuelve el borrador vivo de la terminal, que es lo que hace
 * que recargar la pestaña recupere el carrito en vez de perderlo (P1-10).
 */
export const estadoDeVenta = definirComando<Transaccion, typeof entradaEstadoVenta, EstadoVenta>({
  nombre: 'venta.estado',
  entidad: 'orden',
  escribe: false,
  roles: [...ROLES_DE_MOSTRADOR],
  paquetes: PAQUETES_MOSTRADOR,
  sucursal: { ordenId: 'ordenes' },
  entrada: entradaEstadoVenta,
  async ejecutar(ctx, entrada) {
    const { organizacionId, terminalId } = ctx.ambito;

    const caja =
      terminalId === null
        ? null
        : await repoCaja.sesionAbiertaDeTerminal(ctx.tx, organizacionId, terminalId);

    const ordenId = await resolverOrden(ctx.tx, organizacionId, terminalId, entrada.ordenId);
    if (ordenId === null) {
      return { cotizacion: null, sesionCajaId: caja?.id ?? null, opcionesPorLinea: {} };
    }

    const { cotizacion } = await ctx.paso('cotizar', () =>
      cotizar(ctx.tx, organizacionId, ordenId),
    );
    return {
      cotizacion: cotizacionPara(ctx.ambito.rol, cotizacion),
      sesionCajaId: caja?.id ?? null,
      opcionesPorLinea: await opcionesDeLasLineas(
        ctx.tx,
        cotizacion.lineas.map((l) => l.id),
      ),
    };
  },
});

async function resolverOrden(
  tx: Transaccion,
  organizacionId: string,
  terminalId: string | null,
  ordenId: string | undefined,
): Promise<string | null> {
  if (ordenId !== undefined) {
    const orden = await repoOrdenes.ordenPorId(tx, organizacionId, ordenId);
    if (orden === null) throw new ErrorDominio('ORDEN_NO_ENCONTRADA', 'Esa venta no existe.');
    return orden.id;
  }
  if (terminalId === null) return null;
  const borrador = await repoOrdenes.borradorDeTerminal(tx, organizacionId, terminalId);
  return borrador?.id ?? null;
}

export interface TicketImpreso {
  readonly serie: string;
  readonly folio: string | null;
  readonly emitidoEn: string;
  readonly organizacionNombre: string;
  readonly sucursalNombre: string;
  /**
   * DP-16 · El pedido para llevar: su número del día y el nombre del cliente, para el renglón
   * grande «PARA LLEVAR · N · nombre». `null` en una mesa o en el mostrador.
   */
  readonly paraLlevar: { readonly numero: number | null; readonly nombre: string | null } | null;
  readonly lineas: readonly {
    readonly nombre: string;
    readonly cantidad: string;
    readonly unidad: string;
    readonly precioUnitarioCentavos: string;
    readonly importeCentavos: string;
    /** DP-14.6-3 · Lo elegido de las opciones («Salsa: Verde»), o vacío. */
    readonly opciones: string;
  }[];
  readonly subtotalCentavos: string;
  readonly descuentoCentavos: string;
  readonly impuestosCentavos: string;
  readonly totalCentavos: string;
  /** DP-13.5 (QA2-005): la propina de la venta; no es parte del total, sí de lo que se cobró. */
  readonly propinaCentavos: string;
  readonly pagos: readonly {
    readonly metodo: string;
    readonly montoCentavos: string;
    readonly propinaCentavos: string;
    readonly recibidoCentavos: string | null;
    readonly cambioCentavos: string;
  }[];
}

/**
 * El ticket de una venta cobrada (F1.1-A-12).
 *
 * Devuelve los totales **congelados** de la orden, no un recálculo: reimprimir
 * un ticket con el precio de hoy no reproduce el documento que se le dio al
 * cliente. Por eso lee de `ordenes` y no vuelve a llamar a `cotizar`.
 */
export const ticketDeOrden = definirComando<Transaccion, typeof entradaTicket, TicketImpreso>({
  nombre: 'venta.ticket',
  entidad: 'orden',
  escribe: false,
  roles: [...ROLES_DE_MOSTRADOR],
  paquetes: PAQUETES_MOSTRADOR,
  sucursal: { ordenId: 'ordenes' },
  entrada: entradaTicket,
  async ejecutar(ctx, entrada) {
    const { organizacionId } = ctx.ambito;

    const orden = await ctx.paso('cargar_orden', () =>
      repoOrdenes.ordenParaTicket(ctx.tx, organizacionId, entrada.ordenId),
    );
    if (orden === null) throw new ErrorDominio('ORDEN_NO_ENCONTRADA', 'Esa venta no existe.');

    const [lineas, pagos] = await Promise.all([
      repoOrdenes.lineasDeOrden(ctx.tx, organizacionId, entrada.ordenId),
      repoOrdenes.pagosDeOrden(ctx.tx, organizacionId, entrada.ordenId),
    ]);

    const opciones = await opcionesDeLasLineas(
      ctx.tx,
      lineas.map((l) => l.id),
    );
    return {
      serie: orden.serie,
      folio: orden.folio === null ? null : orden.folio.toString(),
      // La hora del COBRO (QA2-005): la de abrir la venta podía ser de horas antes.
      emitidoEn: (orden.cerradaEn ?? orden.createdAt).toISOString(),
      organizacionNombre: orden.organizacionNombre,
      sucursalNombre: orden.sucursalNombre,
      paraLlevar:
        orden.canal === 'llevar'
          ? { numero: orden.numeroPedido, nombre: orden.nombrePedido }
          : null,
      lineas: lineas.map((l) => ({
        nombre: l.productoNombre,
        cantidad: l.cantidad,
        unidad: l.unidad,
        precioUnitarioCentavos: l.precioUnitarioCentavos.toString(),
        importeCentavos: l.subtotalCentavos.toString(),
        opciones: opciones[l.id] ?? '',
      })),
      subtotalCentavos: orden.subtotalCentavos.toString(),
      descuentoCentavos: orden.descuentoCentavos.toString(),
      impuestosCentavos: orden.impuestosCentavos.toString(),
      totalCentavos: orden.totalCentavos.toString(),
      propinaCentavos: pagos.reduce((suma, p) => suma + p.propinaCentavos, 0n).toString(),
      pagos: pagos.map((p) => ({
        metodo: p.metodo,
        montoCentavos: p.montoCentavos.toString(),
        propinaCentavos: p.propinaCentavos.toString(),
        recibidoCentavos: p.recibidoCentavos === null ? null : p.recibidoCentavos.toString(),
        cambioCentavos: p.cambioCentavos.toString(),
      })),
    };
  },
});
