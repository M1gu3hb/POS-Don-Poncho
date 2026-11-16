import 'server-only';

import type { Transaccion } from '@morphiqpos/data';
import { folioVisible, type ConFolios } from '@morphiqpos/domain/venta';

import { leerFoliosDelNegocio } from '../../configuracion/folios-leidos.ts';

/**
 * LOS FOLIOS DEL CORTE, YA VESTIDOS (DP-21 · Bloque 6).
 *
 * Las lecturas del corte arman cada folio en SQL con su serie (`o.serie || '-' || o.folio`: «A-3»).
 * Con prefijo («DP») el documento tiene que decir «DP-01003»: lo hace el servidor al armar la
 * lectura, con el mismo `folioVisible` de las pantallas, de modo que la hoja, el PDF, la lista de
 * cancelaciones y los descuentos digan lo mismo que el ticket. Sin prefijo el texto no cambia.
 */

/** Los folios del negocio, en la forma que lee `folioVisible`. */
export async function foliosParaVestir(
  tx: Transaccion,
  organizacionId: string,
): Promise<ConFolios> {
  return { folios: await leerFoliosDelNegocio(tx, organizacionId) };
}

/** Un folio ya armado con su serie («A-3»); lo que no se entiende se queda como viene. */
export function vestirFolio(folio: string | null, folios: ConFolios): string | null {
  return folio === null ? null : folioVisible(null, folio, folios) || folio;
}

/** Las mismas filas, con su `folio` vestido. No modifica las originales. */
export function vestirFolios<T extends { readonly folio: string | null }>(
  filas: readonly T[],
  folios: ConFolios,
): T[] {
  return filas.map((fila) => ({ ...fila, folio: vestirFolio(fila.folio, folios) }));
}

/** El folio de la caja o del corte, con su serie suelta: «CC-2» o, con prefijo, «DPC-0002». */
export function folioVisibleDeLaSesion(
  serie: string,
  folio: string | null,
  folios: ConFolios,
): string | null {
  return folio === null ? null : folioVisible(serie, folio, folios) || null;
}
