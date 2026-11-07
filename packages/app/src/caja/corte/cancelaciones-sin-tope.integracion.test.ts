import { conTransaccion } from '@morphiqpos/data';
import { beforeAll, describe, expect, it } from 'vitest';

import {
  cancelar,
  cuenta,
  dejarListo,
  mesero,
  negocio,
  sembrarElSalonQueCancela,
  sucursal,
} from '../../restaurante/pruebas/cancelacion-real.ts';
import { exigirOk } from '../../pruebas/negocio-real.ts';
import { cancelacionesDelCorte, totalDeLasCancelacionesDelCorte } from './cancelaciones.ts';

/**
 * DP-14.6 · LAS CANCELACIONES DEL CORTE NO SE CORTAN EN SILENCIO. La lista tiene un tope de filas
 * (500 en producción), pero la cuenta y la suma salen de SQL sobre TODAS: el corte dice «se
 * muestran X de N» con el total completo, y no suma sólo lo que cupo.
 */

const alcance = () => ({
  sesionId: '00000000-0000-4000-8000-000000000000',
  sucursalId: sucursal.sucursalId,
  abreId: '00000000-0000-4000-8000-000000000000',
  cierraElDia: true,
  desde: new Date(Date.now() - 3_600_000),
  hasta: new Date(Date.now() + 60_000),
});

beforeAll(async () => {
  await sembrarElSalonQueCancela();
  for (const mesa of [1, 2, 3]) {
    const { ordenId } = await cuenta(mesa, ['1']);
    // La de la mesa 3 ya la había dejado lista la cocina: es pérdida, y la suma tiene que verla.
    if (mesa === 3) await dejarListo(ordenId);
    exigirOk(await cancelar(ordenId, mesero(), 'Se fueron sin pagar'), 'cancelar');
  }
}, 120_000);

describe('el total no depende del tope de la lista', () => {
  it('con un tope de 2, la lista trae 2 y el total cuenta y suma las 3', async () => {
    const [lista, total] = await conTransaccion(async (tx) => [
      await cancelacionesDelCorte(tx, negocio.organizacionId, alcance(), 2),
      await totalDeLasCancelacionesDelCorte(tx, negocio.organizacionId, alcance()),
    ]);
    expect(lista).toHaveLength(2);
    expect(total.cuantas).toBe(3);
    // Cada cuenta es una arrachera de $329.00.
    expect(total.montoCentavos).toBe('98700');
    // Una de las tres ya estaba lista: su arrachera entera es pérdida, aunque la lista se corte.
    expect(total.perdidaCentavos).toBe('32900');
  });
});
