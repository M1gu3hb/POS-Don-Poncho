import 'server-only';

import type { Transaccion } from '@morphiqpos/data';

/**
 * POR QUÉ YA NO SE COBRA UNA CUENTA, dicho para la caja (DP-14.2, decisión DP-D60).
 *
 * Con dos cajas abiertas las dos ven las mismas cuentas pendientes y la cobra quien la tome
 * primero. Si la otra llega después —o al mismo tiempo y pierde el candado de `venta.cobrar`—, el
 * cobro se rechaza (jamás un cobro doble) y la cajera lee DÓNDE se cobró: «Ya se cobró en Caja 1».
 * La caja es la terminal de la sesión que la cobró (`ordenes.sesion_caja_id`).
 */

const COBRADAS = ['pagada', 'parcialmente_reembolsada', 'reembolsada'] as const;

export async function porQueYaNoSeCobra(
  tx: Transaccion,
  organizacionId: string,
  ordenId: string,
  estado: string,
): Promise<string> {
  if ((COBRADAS as readonly string[]).includes(estado)) {
    const fila = await tx
      .selectFrom('ordenes as o')
      .leftJoin('sesiones_caja as s', 's.id', 'o.sesion_caja_id')
      .leftJoin('terminales as t', 't.id', 's.terminal_id')
      .select('t.nombre as terminal')
      .where('o.organizacion_id', '=', organizacionId)
      .where('o.id', '=', ordenId)
      .executeTakeFirst();
    const terminal = fila?.terminal ?? null;
    return terminal === null ? 'Esa cuenta ya se cobró.' : `Ya se cobró en ${terminal}.`;
  }
  if (estado === 'cancelada') return 'Esa cuenta se canceló: ya no se cobra.';
  if (estado === 'dividida') return 'Esa cuenta se dividió: cobra cada una de sus partes.';
  return 'Esa venta ya se cobró o se canceló.';
}
