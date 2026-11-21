import { obtenerDb } from '@morphiqpos/data';
import { beforeAll, describe, expect, it } from 'vitest';

import { reintentosPorConcurrencia } from '../comando.ts';
import { exigirOk } from '../pruebas/negocio-real.ts';
import {
  abrirLasCajas,
  ambitoDeCaja,
  cobrarExacto,
  ordenPersistida,
  pagosDe,
  pedirLaCuenta,
  sembrarSalon,
  sentarYPedir,
  type Salon,
} from './pruebas/salon-real.ts';

/**
 * DP-25 · Parte 4 · UN COBRO QUE ESPERÓ UN CANDADO MÁS DE 3 s Y SE REPITIÓ NO COBRA DOS VECES.
 *
 * El `lock_timeout` de 3 s vale para toda la transacción del comando; al agotarse (55P03) el
 * envoltorio repite el comando ENTERO desde cero, con la misma clave de idempotencia (`comando.ts`).
 * Esto lo prueba con dinero y contra Postgres: otra conexión tiene tomada la cuenta 3.6 s, el
 * primer intento se rinde por tiempo y se revierte, el segundo cobra, y queda UN solo pago, la
 * cuenta pagada una vez y la clave confirmada una vez.
 */

let salon: Salon;

beforeAll(async () => {
  salon = await sembrarSalon({ nombre: 'Cobro con candado ocupado', mesas: 2 });
  await abrirLasCajas(salon);
}, 120_000);

const dormir = (ms: number) => new Promise((listo) => setTimeout(listo, ms));

describe('P4 · el reintento por candado agotado (55P03) con dinero', () => {
  it('el cobro se repite entero y la cuenta se cobra UNA vez', async () => {
    const { ordenId } = await sentarYPedir(salon, 0, [{ platillo: 'guacamole', cantidad: '1' }]);
    await pedirLaCuenta(salon, ordenId);
    const total = Number((await ordenPersistida(ordenId)).total_centavos);
    expect(total).toBeGreaterThan(0);
    const antes = reintentosPorConcurrencia();

    // Otra conexión tiene tomada la cuenta 3.6 s: más que el lock_timeout de 3 s del comando.
    let tomada: () => void = () => undefined;
    const yaTomada = new Promise<void>((listo) => {
      tomada = listo;
    });
    const ocupando = obtenerDb()
      .transaction()
      .execute(async (trx) => {
        await trx
          .selectFrom('ordenes')
          .select('id')
          .where('id', '=', ordenId)
          .forUpdate()
          .execute();
        tomada();
        await dormir(3_600);
      });
    await yaTomada;

    const resultado = exigirOk(await cobrarExacto(ambitoDeCaja(salon), ordenId, total), 'cobrar');
    await ocupando;

    expect(resultado).toBeDefined();
    expect(reintentosPorConcurrencia() - antes).toBeGreaterThanOrEqual(1);
    const pagos = await pagosDe([ordenId]);
    expect(pagos).toHaveLength(1);
    expect(Number((await ordenPersistida(ordenId)).total_centavos)).toBe(total);
    expect((await ordenPersistida(ordenId)).estado).toBe('pagada');
  }, 60_000);
});
