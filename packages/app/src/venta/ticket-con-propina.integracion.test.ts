import { obtenerDb } from '@morphiqpos/data';
import { describe, expect, it } from 'vitest';

import { comando } from '../produccion.ts';
import { clave, exigirOk } from '../pruebas/negocio-real.ts';
import {
  PRECIO_ARRACHERA,
  abrirLasCajas,
  ambitoDeCaja,
  cobrar,
  sembrarSalon,
  sentarYPedir,
} from '../restaurante/pruebas/salon-real.ts';
import { ticketDeOrden } from './consultas.ts';

/**
 * QA2-005 (DP-13.5) · EL TICKET DICE LA PROPINA Y LA HORA DEL COBRO.
 *
 * `venta.ticket` devolvía lo recibido y el cambio, pero no la propina: total $366, recibido $500,
 * cambio $97.40 no cuadraba para quien lo leía (la diferencia era la propina). Y su hora era la
 * de abrir la cuenta, no la del cobro. Ahora trae la propina de cada pago y la total, y la hora en
 * que se cerró la venta.
 */

describe('el ticket de una venta con propina', () => {
  it('trae la propina (por pago y total) y la hora del cobro', async () => {
    const salon = await sembrarSalon({ nombre: 'Fonda del ticket', mesas: 2, terminales: 1 });
    await abrirLasCajas(salon);
    const { ordenId } = await sentarYPedir(salon, 0, [{ platillo: 'arrachera', cantidad: '1' }]);
    const total = Number(PRECIO_ARRACHERA);
    exigirOk(
      await cobrar(ambitoDeCaja(salon), ordenId, total, [
        {
          metodo: 'efectivo',
          montoCentavos: total,
          propinaCentavos: 3_660,
          recibidoCentavos: 50_000,
        },
      ]),
      'venta.cobrar',
    );

    const ticket = exigirOk(
      await comando(ticketDeOrden, {
        entrada: { ordenId },
        ambito: ambitoDeCaja(salon),
        idempotencyKey: clave(),
      }),
      'venta.ticket',
    );
    expect(ticket.propinaCentavos).toBe('3660');
    expect(ticket.pagos[0]).toMatchObject({ propinaCentavos: '3660' });
    // Cuadra: lo recibido es el total más la propina más el cambio.
    const pago = ticket.pagos[0];
    expect(BigInt(pago?.montoCentavos ?? '0') + 3_660n + BigInt(pago?.cambioCentavos ?? '0')).toBe(
      50_000n,
    );

    const { cerrada_en } = await obtenerDb()
      .selectFrom('ordenes')
      .select('cerrada_en')
      .where('id', '=', ordenId)
      .executeTakeFirstOrThrow();
    expect(ticket.emitidoEn).toBe(cerrada_en?.toISOString());
  });
});
