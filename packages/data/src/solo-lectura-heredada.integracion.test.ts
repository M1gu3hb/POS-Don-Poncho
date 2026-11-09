import { sql } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { cerrarDb, conTransaccion, obtenerDb } from './cliente.ts';
import { contarIntento, devolverIntento } from './repos/limite.ts';

/**
 * DP-15.1 (DP-D92) · UNA CONEXIÓN HEREDADA EN SÓLO LECTURA NO TUMBA LAS ESCRITURAS DE LA APP.
 *
 * En producción la app entra por el pooler de transacción: una conexión del servidor la usan
 * muchos clientes, uno tras otro. Si alguien dejó en ella `default_transaction_read_only = on`
 * —un guion de revisión con un `SET` de sesión, DP-D91—, la siguiente escritura de la app sobre
 * esa conexión fallaba con `25006` (el limitador y el carrito del portal, 08 y 09-11).
 *
 * Aquí se abre el pool de la app con esa opción en TODAS sus conexiones, que es el peor caso, y
 * se comprueba que las escrituras de la app pasan igual: cada transacción pide `read write`
 * explícito y el limitador escribe dentro de una.
 */

const CUBO = 'prueba-de-integracion-solo-lectura-heredada';
const VENTANA = 300;
const cadenaOriginal = process.env['DATABASE_URL'] ?? '';

function conSoloLecturaHeredada(cadena: string): string {
  const url = new URL(cadena);
  url.searchParams.set('options', '-c default_transaction_read_only=on');
  return url.toString();
}

beforeAll(async () => {
  await cerrarDb();
  process.env['DATABASE_URL'] = conSoloLecturaHeredada(cadenaOriginal);
});

afterAll(async () => {
  await cerrarDb();
  process.env['DATABASE_URL'] = cadenaOriginal;
  await obtenerDb().deleteFrom('limite_tasa').where('clave', '=', CUBO).execute();
  await cerrarDb();
});

describe('una conexión heredada en sólo lectura', () => {
  it('de verdad está en sólo lectura: una escritura suelta falla con 25006', async () => {
    const fila = await sql<{ ro: string }>`
      select current_setting('default_transaction_read_only') as ro
    `.execute(obtenerDb());
    expect(fila.rows[0]?.ro).toBe('on');

    await expect(
      sql`insert into limite_tasa (clave, ventana_en, intentos) values (${CUBO}, now(), 1)`.execute(
        obtenerDb(),
      ),
    ).rejects.toMatchObject({ code: '25006' });
  });

  it('conTransaccion escribe igual: abre la transacción en read write', async () => {
    await conTransaccion(async (tx) => {
      await tx.deleteFrom('limite_tasa').where('clave', '=', CUBO).execute();
      await tx
        .insertInto('limite_tasa')
        .values({ clave: CUBO, ventana_en: sql<Date>`now()`, intentos: 7 })
        .execute();
    });

    const fila = await obtenerDb()
      .selectFrom('limite_tasa')
      .select('intentos')
      .where('clave', '=', CUBO)
      .executeTakeFirstOrThrow();
    expect(fila.intentos).toBe(7);
  });

  it('el limitador cuenta y devuelve el intento', async () => {
    await conTransaccion((tx) => tx.deleteFrom('limite_tasa').where('clave', '=', CUBO).execute());

    const primero = await contarIntento(CUBO, VENTANA);
    const segundo = await contarIntento(CUBO, VENTANA);
    expect([primero.intentos, segundo.intentos]).toEqual([1, 2]);

    await devolverIntento(CUBO);
    const tras = await contarIntento(CUBO, VENTANA);
    expect(tras.intentos).toBe(2);
  });
});
