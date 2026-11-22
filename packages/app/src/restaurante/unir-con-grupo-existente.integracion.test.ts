import { conTransaccion, obtenerDb } from '@morphiqpos/data';
import { medidasDeMesa, revisarUnion } from '@morphiqpos/domain/sala';
import { sql } from 'kysely';
import { describe, expect, it } from 'vitest';

import { comando } from '../produccion.ts';
import { clave, exigirOk } from '../pruebas/negocio-real.ts';
import { agregarALaUnionComando } from './agregar-a-la-union.ts';
import { abrirLasCajas, ambitoDeCaja, mesaPersistida, sentarYPedir } from './pruebas/salon-real.ts';
import { LADO, mesa, posicion, salonEnFila, unir } from './pruebas/union-en-el-plano.ts';

/**
 * DP-25 · P6 · «UNIR MESAS» CON UNA MESA QUE YA ESTÁ EN UN GRUPO, contra Postgres (DP-D226).
 *
 * Antes: «La mesa N ya pertenece a un grupo. Sepáralo antes de unir otro.» Ahora el servidor lo
 * resuelve: si alguna de las mesas ya está en un grupo, la unión ES agregar al grupo, con la
 * principal de siempre. Y dos meseros que agregan a la vez no se pasan del perímetro.
 */

async function unionesVivas(ids: readonly string[]) {
  return obtenerDb()
    .selectFrom('uniones_mesa')
    .select(['id', 'mesa_principal_id'])
    .where('mesa_principal_id', 'in', [...ids])
    .where('cerrada_en', 'is', null)
    .execute();
}

describe('unir con una mesa que ya está en un grupo', () => {
  it('a · la principal de un grupo vuelve a «unir» con una libre: la agrega, sin error', async () => {
    const salon = await salonEnFila('Salón de unir con la principal', 4);
    await abrirLasCajas(salon);
    const primera = exigirOk(
      await unir(salon, 0, [1], [{ i: 1, x: 100 + LADO, y: 100 }]),
      'unir la 1 y la 2',
    );
    const r = exigirOk(
      await unir(salon, 0, [2], [{ i: 2, x: 100 + 2 * LADO, y: 100 }]),
      'unir la 1 con la 3, que se pega al grupo',
    );
    expect(r.unionId).toBe(primera.unionId);
    // La 3 llegó libre: no trae ninguna cuenta que avisar.
    expect(r.cuentasQuePasaron).toEqual([]);
    expect(await mesaPersistida(mesa(salon, 2))).toMatchObject({
      unida_a_mesa_id: mesa(salon, 0),
    });
    expect(await unionesVivas(salon.mesas)).toHaveLength(1);
  }, 120_000);

  it('b · una libre elegida «principal» que se une a la principal de un grupo: la principal de siempre manda', async () => {
    const salon = await salonEnFila('Salón de la principal libre', 4);
    await abrirLasCajas(salon);
    exigirOk(await unir(salon, 0, [1], [{ i: 1, x: 100 + LADO, y: 100 }]), 'unir la 1 y la 2');
    exigirOk(
      await unir(salon, 3, [0], [{ i: 3, x: 100 + 2 * LADO, y: 100 }]),
      'la 4 se une a la 1 y dice que ella queda',
    );
    expect(await mesaPersistida(mesa(salon, 3))).toMatchObject({
      unida_a_mesa_id: mesa(salon, 0),
    });
    expect((await mesaPersistida(mesa(salon, 0))).unida_a_mesa_id).toBeNull();
    const vivas = await unionesVivas(salon.mesas);
    expect(vivas.map((u) => u.mesa_principal_id)).toEqual([mesa(salon, 0)]);
  }, 120_000);

  it('c · una mesa ya absorbida elegida como principal: manda la principal de su grupo', async () => {
    const salon = await salonEnFila('Salón de la absorbida', 4);
    await abrirLasCajas(salon);
    exigirOk(await unir(salon, 0, [1], [{ i: 1, x: 100 + LADO, y: 100 }]), 'unir la 1 y la 2');
    // El mapa dibuja el grupo como una caja y manda su lugar con la mesa que eligieron: no cuenta.
    exigirOk(
      await unir(
        salon,
        1,
        [3],
        [
          { i: 1, x: 5000, y: 100 },
          { i: 3, x: 100 + 2 * LADO, y: 100 },
        ],
      ),
      'la 2 (ya unida) con la 4',
    );
    expect(await posicion(mesa(salon, 1))).toEqual([100 + LADO, 100]);
    expect(await mesaPersistida(mesa(salon, 3))).toMatchObject({
      unida_a_mesa_id: mesa(salon, 0),
    });
    expect(await unionesVivas(salon.mesas)).toHaveLength(1);
  }, 120_000);

  it('d · dos grupos: gana el de la principal elegida y el otro entra entero, sin separar a nadie', async () => {
    const salon = await salonEnFila('Salón de dos grupos', 4);
    await abrirLasCajas(salon);
    exigirOk(await unir(salon, 0, [1], [{ i: 1, x: 100 + LADO, y: 100 }]), 'unir la 1 y la 2');
    exigirOk(await unir(salon, 2, [3], [{ i: 3, x: 500 + LADO, y: 100 }]), 'unir la 3 y la 4');
    const r = exigirOk(
      await unir(
        salon,
        0,
        [3],
        [
          { i: 2, x: 100 + 2 * LADO, y: 100 },
          { i: 3, x: 100 + 3 * LADO, y: 100 },
        ],
      ),
      'la 1 (con su grupo) se une a la 4 (del otro grupo)',
    );
    expect(r).toMatchObject({ gruposAbsorbidos: 1 });
    for (const i of [1, 2, 3]) {
      expect(await mesaPersistida(mesa(salon, i)), `mesa ${String(i + 1)}`).toMatchObject({
        unida_a_mesa_id: mesa(salon, 0),
      });
    }
    expect((await unionesVivas(salon.mesas)).map((u) => u.mesa_principal_id)).toEqual([
      mesa(salon, 0),
    ]);
  }, 120_000);

  it('d2 · el grupo que entra entero trae sus renglones con la mesa de la que ya venían', async () => {
    const salon = await salonEnFila('Salón de los renglones de dos grupos', 4);
    await abrirLasCajas(salon);
    const pedido = [{ platillo: 'cerveza' as const, cantidad: '1' }];
    const cuentas = [];
    for (let i = 0; i < 4; i += 1) cuentas.push((await sentarYPedir(salon, i, pedido)).ordenId);
    exigirOk(await unir(salon, 0, [1], [{ i: 1, x: 100 + LADO, y: 100 }]), 'unir la 1 y la 2');
    exigirOk(await unir(salon, 2, [3], [{ i: 3, x: 500 + LADO, y: 100 }]), 'unir la 3 y la 4');
    exigirOk(
      await unir(
        salon,
        0,
        [2],
        [
          { i: 2, x: 100 + 2 * LADO, y: 100 },
          { i: 3, x: 100 + 3 * LADO, y: 100 },
        ],
      ),
      'la 1 (con su grupo) y la 3 (con el suyo)',
    );
    const lineas = await obtenerDb()
      .selectFrom('orden_lineas')
      .select(['orden_id', 'mesa_origen_numero as origen'])
      .where('orden_id', 'in', cuentas)
      .execute();
    // Todo en la cuenta de la 1; la 4 se había absorbido en la 3 y sigue diciendo «4», no «3».
    expect(new Set(lineas.map((l) => l.orden_id))).toEqual(new Set([cuentas[0]]));
    expect(lineas.map((l) => l.origen).sort()).toEqual([2, 3, 4, null]);
  }, 120_000);

  it('e · si todas las elegidas ya son del mismo grupo no hay nada que agregar, y se dice', async () => {
    const salon = await salonEnFila('Salón de nada que agregar', 3);
    await abrirLasCajas(salon);
    exigirOk(await unir(salon, 0, [1], [{ i: 1, x: 100 + LADO, y: 100 }]), 'unir la 1 y la 2');
    const r = await unir(salon, 0, [1]);
    expect(r.ok ? '' : r.error.mensaje).toMatch(/ya están unidas/);
  }, 120_000);

  it('f · lo que no entra se sigue rechazando como al unir: una mesa en limpieza', async () => {
    const salon = await salonEnFila('Salón de la limpieza', 3);
    await abrirLasCajas(salon);
    exigirOk(await unir(salon, 0, [1], [{ i: 1, x: 100 + LADO, y: 100 }]), 'unir la 1 y la 2');
    await obtenerDb()
      .updateTable('mesas')
      .set({ estado: 'limpieza' })
      .where('id', '=', mesa(salon, 2))
      .execute();
    const r = await unir(salon, 0, [2], [{ i: 2, x: 100 + 2 * LADO, y: 100 }]);
    expect(r.ok ? '' : r.error.mensaje).toMatch(/limpieza/);
  }, 120_000);
});

/** Espera hasta que `cuantas` conexiones estén detenidas en un candado. */
async function esperarCandados(cuantas: number): Promise<void> {
  for (let intento = 0; intento < 100; intento += 1) {
    const { rows } = await sql<{ n: string }>`
      select count(*)::text as n from pg_stat_activity
       where wait_event_type = 'Lock' and datname = current_database()
    `.execute(obtenerDb());
    if (Number(rows[0]?.n ?? 0) >= cuantas) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('Las dos escrituras no llegaron al candado.');
}

describe('dos meseros agregan al mismo grupo a la vez', () => {
  it('g · el perímetro se revisa con las mesas que de verdad hay: no se pasan los dos', async () => {
    const salon = await salonEnFila('Salón de dos que agregan', 9);
    await abrirLasCajas(salon);
    // Siete mesas en hilera (560 de largo): el límite del grupo es 640, o sea UNA más.
    const primera = exigirOk(
      await unir(
        salon,
        0,
        [1, 2, 3, 4, 5, 6],
        [0, 1, 2, 3, 4, 5, 6].map((i) => ({ i, x: 100 + i * LADO, y: 100 })),
      ),
      'unir siete mesas',
    );
    const agregar = (i: number, x: number) =>
      comando(agregarALaUnionComando, {
        entrada: {
          unionId: primera.unionId,
          mesaIds: [mesa(salon, i)],
          posiciones: [{ mesaId: mesa(salon, i), x, y: 100 }],
        },
        ambito: ambitoDeCaja(salon),
        idempotencyKey: clave(),
      });

    // Se detiene el candado del grupo para que las dos lean ANTES de que cualquiera lo tome.
    let soltar: () => void = () => undefined;
    const liberar = new Promise<void>((resolve) => {
      soltar = resolve;
    });
    let tomado: () => void = () => undefined;
    const yaTomado = new Promise<void>((resolve) => {
      tomado = resolve;
    });
    const retenido = conTransaccion(async (tx) => {
      await tx
        .selectFrom('mesas')
        .select('id')
        .where('id', '=', mesa(salon, 0))
        .forUpdate()
        .execute();
      tomado();
      await liberar;
    });
    await yaTomado;
    // La 8 se pega al final de la hilera (640 en total); la 9, al principio (también 640).
    const alFinal = agregar(7, 100 + 7 * LADO);
    const alPrincipio = agregar(8, 100 - LADO);
    await esperarCandados(2);
    soltar();
    await retenido;
    const [uno, otro] = await Promise.all([alFinal, alPrincipio]);

    expect(
      [uno.ok, otro.ok].filter(Boolean),
      'Las dos pasaron: el grupo quedó de 720, más de lo que cabe.',
    ).toHaveLength(1);
    const miembros = await obtenerDb()
      .selectFrom('mesas')
      .select(['id', 'posicion_x', 'posicion_y', 'forma', 'tamano'])
      .where((eb) =>
        eb.or([eb('id', '=', mesa(salon, 0)), eb('unida_a_mesa_id', '=', mesa(salon, 0))]),
      )
      .execute();
    const enPlano = miembros.map((m) => ({
      id: m.id,
      x: m.posicion_x,
      y: m.posicion_y,
      ...medidasDeMesa(m.forma, m.tamano),
    }));
    expect(revisarUnion(enPlano)).toBeNull();
  }, 180_000);
});
