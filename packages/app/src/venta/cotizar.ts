import 'server-only';

import { ErrorDominio } from '@morphiqpos/contracts';
import { centavos } from '@morphiqpos/domain/dinero';

import { reglaDeImpuestoEn } from '../configuracion/impuesto-del-negocio.ts';
import { porCantidad } from './escala.ts';
import { calcularTotales, type ReglaImpuesto, type TotalesOrden } from '@morphiqpos/domain/venta';
import type { Kysely } from 'kysely';
import type { Esquema, Transaccion } from '@morphiqpos/data';
import { repoOrdenes } from '@morphiqpos/data';
import type { CostosPorLinea } from './costo-por-medida.ts';

/**
 * Cotización de la orden, siempre en el servidor (F1.1-A-07).
 *
 * Vive como función y no sólo como comando porque el cobro la necesita DENTRO
 * de su propia transacción: si `cobrarOrden` volviera a cotizar por su cuenta,
 * habría dos sitios donde se calcula un total, que es la señal 4 de desviación
 * arquitectónica de `04-ARQUITECTURA §9`.
 *
 * El endpoint no acepta ningún importe. Recibe un id de orden y devuelve lo que
 * cuesta; lo que el cliente creía que costaba sólo sirve para detectar que su
 * pantalla estaba desactualizada, nunca para cobrar.
 */

/**
 * El punto de partida cuando la organización no ha configurado nada.
 *
 * Ya NO es lo que se cobra: `impuestoDe` lee la configuración del negocio en
 * cada cotización. Esto queda como valor por omisión de una organización recién
 * creada, y para que las pruebas puras no tengan que montar una configuración.
 */
export const IMPUESTO_POR_OMISION: ReglaImpuesto = {
  tasaPuntosBase: 1600,
  incluidoEnPrecio: true,
};

/**
 * La regla de impuesto de una organización (F1.1-C-12).
 *
 * Se lee DENTRO de la misma transacción que cotiza. Si se leyera antes, un
 * cambio de IVA a media venta dejaría la cotización con una tasa y el cobro con
 * otra — y el cliente pagaría un total que la pantalla nunca enseñó.
 */
export async function impuestoDe(
  db: Kysely<Esquema> | Transaccion,
  organizacionId: string,
): Promise<ReglaImpuesto> {
  const fila = await db
    .selectFrom('configuracion')
    .select('valores')
    .where('organizacion_id', '=', organizacionId)
    .executeTakeFirst();

  // Una configuración dañada NO tumba la venta: se cobra con el IVA general y el negocio sigue
  // operando (`impuestoEn`). Y «Sin IVA» (0) es un dato, no la ausencia de uno: se respeta.
  return reglaDeImpuestoEn(fila?.valores);
}

/** El costo de un renglón: el exacto que congeló el cobro (por medida) o costo por unidad × cantidad. */
function costoDeLaLinea(
  linea: { readonly id: string; readonly costoUnitarioCentavos: bigint; readonly cantidad: string },
  costosExactos: CostosPorLinea | undefined,
) {
  const exacto = costosExactos?.get(linea.id);
  return exacto === undefined
    ? porCantidad(linea.costoUnitarioCentavos, linea.cantidad)
    : centavos(exacto);
}

export interface LineaCotizada {
  readonly id: string;
  readonly productoId: string | null;
  readonly productoNombre: string;
  readonly cantidad: string;
  readonly unidad: string;
  readonly precioUnitarioCentavos: string;
  readonly subtotalCentavos: string;
  readonly esMayoreo: boolean;
}

export interface Cotizacion {
  readonly ordenId: string;
  readonly lineas: readonly LineaCotizada[];
  readonly subtotalCentavos: string;
  readonly descuentoCentavos: string;
  readonly impuestosCentavos: string;
  readonly totalCentavos: string;
  readonly costoTotalCentavos: string;
  readonly utilidadCentavos: string;
  readonly margenBp: number;
}

/**
 * Recalcula la orden desde sus líneas persistidas.
 *
 * Acepta transacción o conexión suelta: el cobro le pasa SU transacción, para
 * que el total que cobra sea el de las líneas que está a punto de congelar y no
 * el de una lectura anterior.
 *
 * DP-D180 · `costosExactos`: el costo EXACTO de los renglones por medida o por porción que el cobro acaba
 * de congelar (centavos, un solo redondeo). Con él la cuenta suma ese costo y no `costo por unidad ×
 * cantidad`, que redondea dos veces.
 */
export async function cotizar(
  db: Kysely<Esquema> | Transaccion,
  organizacionId: string,
  ordenId: string,
  impuestoDado?: ReglaImpuesto,
  costosExactos?: CostosPorLinea,
): Promise<{ readonly cotizacion: Cotizacion; readonly totales: TotalesOrden }> {
  const [lineas, impuesto] = await Promise.all([
    repoOrdenes.lineasDeOrden(db, organizacionId, ordenId),
    impuestoDado === undefined ? impuestoDe(db, organizacionId) : Promise.resolve(impuestoDado),
  ]);

  const totales = calcularTotales(
    lineas.map((l) => ({
      subtotalCentavos: centavos(l.subtotalCentavos),
      descuentoCentavos: centavos(l.descuentoCentavos),
      costoCentavos: costoDeLaLinea(l, costosExactos),
    })),
    impuesto,
  );

  return {
    totales,
    cotizacion: {
      ordenId,
      lineas: lineas.map((l) => ({
        id: l.id,
        productoId: l.productoId,
        productoNombre: l.productoNombre,
        cantidad: l.cantidad,
        unidad: l.unidad,
        precioUnitarioCentavos: l.precioUnitarioCentavos.toString(),
        subtotalCentavos: l.subtotalCentavos.toString(),
        esMayoreo: l.esMayoreo,
      })),
      subtotalCentavos: totales.subtotalCentavos.toString(),
      descuentoCentavos: totales.descuentoCentavos.toString(),
      impuestosCentavos: totales.impuestosCentavos.toString(),
      totalCentavos: totales.totalCentavos.toString(),
      costoTotalCentavos: totales.costoTotalCentavos.toString(),
      utilidadCentavos: totales.utilidadCentavos.toString(),
      margenBp: totales.margenBp,
    },
  };
}

/**
 * Comprueba que la pantalla y el servidor coinciden en el total.
 *
 * Si no coinciden se rechaza CON el total correcto, en vez de cobrar el del
 * servidor en silencio: el cajero ya le dijo un número al cliente, y cobrarle
 * otro sin avisar es peor que fallar y volver a preguntar.
 */
export function exigirTotalVigente(totalServidor: bigint, totalEsperado: number | undefined): void {
  if (totalEsperado === undefined) return;
  if (BigInt(totalEsperado) === totalServidor) return;
  throw new ErrorDominio(
    'TOTAL_DESACTUALIZADO',
    'El total cambió desde que se mostró en pantalla. Revísalo con el cliente.',
    { totalCentavos: totalServidor.toString() },
  );
}
