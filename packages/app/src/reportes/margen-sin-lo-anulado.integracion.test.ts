import { conTransaccion, obtenerDb } from '@morphiqpos/data';
import { beforeAll, describe, expect, it } from 'vitest';

import {
  abrirLasCajas,
  ambitoDeCaja,
  cobrarExacto,
  ordenPersistida,
  pedirLaCuenta,
  sembrarSalon,
  sentarYPedir,
  type Salon,
} from '../restaurante/pruebas/salon-real.ts';
import { exigirOk } from '../pruebas/negocio-real.ts';
import { leerMargen } from './piezas.ts';

/**
 * DP-14 ronda 2 · EL MARGEN NO CUENTA LO ANULADO. Un platillo que se anuló aparte ya no es venta ni
 * costo: `leerMargen` lo seguía sumando (las líneas anuladas conservan su importe y su costo), y el
 * margen del periodo salía distinto del total de las cuentas.
 */

let salon: Salon;
let ordenId = '';

const periodo = () => ({
  desde: new Date(Date.now() - 3_600_000),
  hasta: new Date(Date.now() + 3_600_000),
});
const margen = () =>
  conTransaccion((tx) =>
    leerMargen(tx, salon.negocio.organizacionId, periodo().desde, periodo().hasta),
  );

beforeAll(async () => {
  salon = await sembrarSalon({ nombre: 'Restaurante del margen', mesas: 1, terminales: 1 });
  await abrirLasCajas(salon);
  const cuenta = await sentarYPedir(salon, 0, [
    { platillo: 'arrachera', cantidad: '1' },
    { platillo: 'cerveza', cantidad: '2' },
  ]);
  ordenId = cuenta.ordenId;
  await pedirLaCuenta(salon, ordenId);
  const total = Number((await ordenPersistida(ordenId)).total_centavos);
  exigirOk(await cobrarExacto(ambitoDeCaja(salon, 0), ordenId, total), 'venta.cobrar');
}, 120_000);

describe('el margen del periodo', () => {
  it('no suma el platillo que se anuló aparte, ni su venta ni su costo', async () => {
    const antes = await margen();
    const db = obtenerDb();
    const arrachera = await db
      .selectFrom('orden_lineas')
      .select(['id', 'total_centavos'])
      .where('orden_id', '=', ordenId)
      .where('producto_nombre', 'like', 'Arrachera%')
      .executeTakeFirstOrThrow();
    await db
      .updateTable('orden_lineas')
      .set({ anulada_en: new Date(), motivo_anulacion: 'error_de_captura' })
      .where('id', '=', arrachera.id)
      .execute();
    const despues = await margen();
    expect(despues.venta).toBe(antes.venta - arrachera.total_centavos);
    expect(despues.venta).toBeLessThan(antes.venta);
  });
});
