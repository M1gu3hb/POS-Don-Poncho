import { obtenerDb } from '@morphiqpos/data';
import { describe, expect, it } from 'vitest';

import { comando } from '../produccion.ts';
import { vaciarMesas } from '../mantenimiento/comandos.ts';
import { marcarPlataforma } from '../mantenimiento/plataforma.ts';
import { clave, exigirOk } from '../pruebas/negocio-real.ts';
import { escribirDatos } from '../puente/comandos.ts';
import { abrirMesa } from './mesas.ts';
import { notasJuntas } from './notas-de-la-union.ts';
import { ambitoDeCaja } from './pruebas/salon-real.ts';
import { LADO, mesa, salonEnFila, unir } from './pruebas/union-en-el-plano.ts';

/**
 * DP-12.3 · UNIR MESAS CON GENTE, contra Postgres: las alergias y la celebración de la absorbida
 * llegan a la principal (es inocuidad: antes se perdían de vista), una mesa en limpieza se dice
 * con su nombre, y ni el editor ni «vaciar el mapa» dejan una unión varada.
 */

describe('las notas de la unión', () => {
  it('se juntan sin vacíos ni repetidas', () => {
    expect(notasJuntas('Nueces', null, '', 'nueces · Gluten')).toBe('Nueces · Gluten');
    expect(notasJuntas(null, undefined, '  ')).toBeNull();
  });
});

describe('unir mesas con gente (DP-12.3)', () => {
  it('las alergias y la celebración de la absorbida llegan a la mesa y a la cuenta que quedan', async () => {
    const salon = await salonEnFila('Salón con alergias', 2);
    const ambito = ambitoDeCaja(salon);
    const [uno, dos] = [mesa(salon, 0), mesa(salon, 1)];
    exigirOk(
      await comando(abrirMesa, {
        ambito,
        entrada: { mesaId: uno, personas: 2, notasAlergias: 'Mariscos' },
        idempotencyKey: clave(),
      }),
      'abrir la 1',
    );
    exigirOk(
      await comando(abrirMesa, {
        ambito,
        entrada: {
          mesaId: dos,
          personas: 3,
          notasAlergias: 'Nueces',
          celebracionEspecial: true,
          tipoCelebracion: 'Cumpleaños',
        },
        idempotencyKey: clave(),
      }),
      'abrir la 2',
    );
    exigirOk(await unir(salon, 0, [1], [{ i: 1, x: 100 + LADO, y: 100 }]), 'unir');

    const laUno = await obtenerDb()
      .selectFrom('mesas')
      .select(['notas_alergias', 'celebracion_especial', 'tipo_celebracion', 'orden_activa_id'])
      .where('id', '=', uno)
      .executeTakeFirstOrThrow();
    expect(laUno).toMatchObject({
      notas_alergias: 'Mariscos · Nueces',
      celebracion_especial: true,
      tipo_celebracion: 'Cumpleaños',
    });
    const cuenta = await obtenerDb()
      .selectFrom('ordenes')
      .select(['notas_alergias', 'celebracion_especial'])
      .where('id', '=', laUno.orden_activa_id ?? '')
      .executeTakeFirstOrThrow();
    expect(cuenta).toEqual({ notas_alergias: 'Mariscos · Nueces', celebracion_especial: true });
  });

  it('una mesa en limpieza se dice: «márcala libre primero»', async () => {
    const salon = await salonEnFila('Salón en limpieza', 2);
    await obtenerDb()
      .updateTable('mesas')
      .set({ estado: 'limpieza' })
      .where('id', '=', mesa(salon, 1))
      .execute();
    const r = await unir(salon, 0, [1], [{ i: 1, x: 100 + LADO, y: 100 }]);
    expect(r.ok ? null : r.error.mensaje).toMatch(/limpieza.*márcala libre primero/i);
  });
});

describe('ninguna unión se queda varada (DP-12.3)', () => {
  it('el editor no apaga ni la principal ni una absorbida de una unión viva', async () => {
    const salon = await salonEnFila('Salón del editor', 2);
    exigirOk(await unir(salon, 0, [1], [{ i: 1, x: 100 + LADO, y: 100 }]), 'unir');
    for (const id of [mesa(salon, 0), mesa(salon, 1)]) {
      const r = await comando(escribirDatos, {
        ambito: { ...ambitoDeCaja(salon), rol: 'dueno' },
        entrada: { entidad: 'Mesa', operacion: 'update', id, datos: { activo: false } },
        idempotencyKey: clave(),
      });
      expect(r.ok ? null : r.error.mensaje).toMatch(/unida|sepár/i);
    }
  });

  it('vaciar el mapa con una unión viva se niega', async () => {
    const salon = await salonEnFila('Salón por vaciar', 2);
    exigirOk(await unir(salon, 0, [1], [{ i: 1, x: 100 + LADO, y: 100 }]), 'unir');
    const dueno = { ...ambitoDeCaja(salon), rol: 'dueno' as const };
    exigirOk(
      await comando(marcarPlataforma, { ambito: dueno, entrada: {}, idempotencyKey: clave() }),
      'marcar',
    );
    const r = await comando(vaciarMesas, { ambito: dueno, entrada: {}, idempotencyKey: clave() });
    expect(r.ok ? null : r.error.mensaje).toMatch(/unidas/i);
  });
});
