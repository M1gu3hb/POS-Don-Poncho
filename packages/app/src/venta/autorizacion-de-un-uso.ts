import 'server-only';

import { ErrorDominio } from '@morphiqpos/contracts';
import type { Transaccion } from '@morphiqpos/data';
import { sql } from 'kysely';

import {
  VIGENCIA_AUTORIZACION_SEGUNDOS,
  type CargaDeAutorizacion,
} from '../identidad/supervisor.ts';

/**
 * LA AUTORIZACIÓN CON PIN SE GASTA AL USARLA (DP-14.2, decisión DP-D61).
 *
 * La firma ya ataba la autorización al negocio, a quien la pidió, a la cuenta, a «descuento» y,
 * desde DP-14.2, al monto exacto. Faltaba que sirviera UNA vez: dentro de sus dos minutos se podía
 * presentar otra vez. Ahora cada uso deja su nonce (`n`) en la auditoría del comando que la gastó
 * —la fila se escribe en la MISMA transacción, antes de confirmar— y el siguiente que la presente
 * la encuentra ahí.
 *
 * Sin tabla nueva (cero DDL): `autorizaciones_descuento` no sirve de registro para todos, porque la
 * base prohíbe ahí que quien autoriza sea quien pide (`autorizacion_no_es_de_uno_mismo`), y desde
 * DP-14.2 la gerente con la sesión abierta vuelve a teclear SU PIN. La auditoría sí la tiene toda,
 * y su índice `(organizacion_id, accion, created_at)` deja la búsqueda en una ventana de minutos.
 *
 * Dos usos A LA VEZ: el candado consultivo de la transacción, con el nonce por llave, pone en fila
 * al segundo hasta que el primero confirme; entonces lee la fila del primero y se rechaza.
 */

/** Los comandos que gastan una autorización de descuento: su auditoría lleva `autorizacion`. */
export const COMANDOS_QUE_GASTAN_AUTORIZACION = [
  'venta.aplicar_descuento',
  'restaurante.descontar_cuenta',
] as const;

/** La ventana se mide desde que se firmó, con holgura por el reloj de cada lado. */
const HOLGURA_SEGUNDOS = 300;

export async function gastarLaAutorizacion(
  tx: Transaccion,
  organizacionId: string,
  carga: CargaDeAutorizacion,
): Promise<void> {
  await sql`select pg_advisory_xact_lock(hashtextextended(${`autorizacion:${organizacionId}:${carga.n}`}, 0))`.execute(
    tx,
  );
  const desde = new Date((carga.exp - VIGENCIA_AUTORIZACION_SEGUNDOS - HOLGURA_SEGUNDOS) * 1000);
  const usada = await tx
    .selectFrom('auditoria')
    .select('id')
    .where('organizacion_id', '=', organizacionId)
    .where('accion', 'in', [...COMANDOS_QUE_GASTAN_AUTORIZACION])
    .where('created_at', '>=', desde)
    .where(sql<string>`payload ->> 'autorizacion'`, '=', carga.n)
    .executeTakeFirst();
  if (usada !== undefined) {
    throw new ErrorDominio(
      'AUTORIZACION_USADA',
      'Esa autorización ya se usó: cada descuento lleva su PIN. Que quien autoriza lo teclee otra vez.',
    );
  }
}
