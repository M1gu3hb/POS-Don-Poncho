import { randomUUID } from 'node:crypto';

import type { Resultado } from '@morphiqpos/contracts';
import { obtenerDb } from '@morphiqpos/data';
import { describe, expect, it } from 'vitest';

import { comando } from '../produccion.ts';
import { clave, exigirOk } from '../pruebas/negocio-real.ts';
import { abrirMesa } from './mesas.ts';
import { abrirLasCajas, ambitoDeCaja, sembrarSalon, type Salon } from './pruebas/salon-real.ts';
import { fijarZonaActiva } from './zona-activa.ts';

/**
 * DP-15.1 · Desactivar y reactivar una zona del salón, contra Postgres real.
 *
 * La regla: una zona con mesas ocupadas o con cuenta abierta no se desactiva (error claro); si sus
 * mesas están libres se desactivan con ella (dejan de servirse en el plano y en el portal) y al
 * reactivarla vuelven EXACTAMENTE las que se apagaron con ella, no las que alguien ya había dado
 * de baja antes.
 */

const db = () => obtenerDb();

async function sembrarZona(
  salon: Salon,
  nombre: string,
  mesas: readonly number[],
): Promise<string> {
  const id = randomUUID();
  await db()
    .insertInto('zonas')
    .values({ id, organizacion_id: salon.negocio.organizacionId, nombre })
    .execute();
  for (const i of mesas) {
    await db()
      .updateTable('mesas')
      .set({ zona_id: id })
      .where('id', '=', salon.mesas[i] ?? '')
      .execute();
  }
  return id;
}

/** El código de dominio viaja en `datos.regla`; `codigo` es la clase general (REGLA_DE_NEGOCIO). */
const regla = <T>(r: Resultado<T>): string | null => {
  if (r.ok) return null;
  const d = (r.error.datos as { readonly regla?: unknown } | undefined)?.regla;
  return typeof d === 'string' ? d : r.error.codigo;
};

const ambitoDelDueno = (salon: Salon) => ({ ...ambitoDeCaja(salon), rol: 'dueno' as const });

const fijar = (salon: Salon, zonaId: string, activa: boolean, rol: 'dueno' | 'cajero' = 'dueno') =>
  comando(fijarZonaActiva, {
    entrada: { zonaId, activa },
    ambito: rol === 'dueno' ? ambitoDelDueno(salon) : ambitoDeCaja(salon),
    idempotencyKey: clave(),
  });

async function activas(salon: Salon): Promise<boolean[]> {
  const filas = await db()
    .selectFrom('mesas')
    .select(['id', 'activa'])
    .where('organizacion_id', '=', salon.negocio.organizacionId)
    .execute();
  return salon.mesas.map((id) => filas.find((f) => f.id === id)?.activa ?? false);
}

const zonaActiva = async (id: string) =>
  (await db().selectFrom('zonas').select('activa').where('id', '=', id).executeTakeFirstOrThrow())
    .activa;

describe('DP-15.1 · desactivar y reactivar una zona', () => {
  it('con las mesas libres, las apaga con la zona y al reactivar vuelven sólo ésas', async () => {
    const salon = await sembrarSalon({ nombre: 'Salón de zonas', mesas: 4 });
    const zona = await sembrarZona(salon, 'Terraza', [0, 1, 2]);
    // La mesa 3 de la terraza ya estaba dada de baja ANTES: no debe volver con la zona.
    await db()
      .updateTable('mesas')
      .set({ activa: false })
      .where('id', '=', salon.mesas[2] ?? '')
      .execute();

    const apagada = exigirOk(await fijar(salon, zona, false), 'desactivar');
    expect(apagada).toMatchObject({ zonaId: zona, activa: false, mesasAfectadas: 2 });
    expect(await zonaActiva(zona)).toBe(false);
    expect(await activas(salon)).toEqual([false, false, false, true]);

    const encendida = exigirOk(await fijar(salon, zona, true), 'reactivar');
    expect(encendida).toMatchObject({ zonaId: zona, activa: true, mesasAfectadas: 2 });
    expect(await zonaActiva(zona)).toBe(true);
    expect(await activas(salon)).toEqual([true, true, false, true]);
  });

  it('no se desactiva con una mesa ocupada o con cuenta abierta, y no cambia nada', async () => {
    const salon = await sembrarSalon({ nombre: 'Salón ocupado', mesas: 3 });
    const zona = await sembrarZona(salon, 'Jardín', [0, 1]);
    await abrirLasCajas(salon);
    exigirOk(
      await comando(abrirMesa, {
        entrada: { mesaId: salon.mesas[1] ?? '', personas: 2 },
        ambito: ambitoDeCaja(salon),
        idempotencyKey: clave(),
      }),
      'abrir la mesa 2',
    );
    const r = await fijar(salon, zona, false);
    expect(regla(r)).toBe('ZONA_CON_MESAS_OCUPADAS');
    expect(r.ok ? '' : r.error.mensaje).toMatch(/Jardín.*\b2\b/);
    expect(await zonaActiva(zona)).toBe(true);
    expect(await activas(salon)).toEqual([true, true, true]);
  });

  it('una mesa en limpieza o unida a otra tampoco deja desactivar la zona', async () => {
    const salon = await sembrarSalon({ nombre: 'Salón en limpieza', mesas: 3 });
    const zona = await sembrarZona(salon, 'Salón chico', [0, 1, 2]);
    await db()
      .updateTable('mesas')
      .set({ estado: 'limpieza' })
      .where('id', '=', salon.mesas[0] ?? '')
      .execute();
    const limpieza = await fijar(salon, zona, false);
    expect(regla(limpieza)).toBe('ZONA_CON_MESAS_OCUPADAS');
    expect(limpieza.ok ? '' : limpieza.error.mensaje).toMatch(/mesa 1/);

    await db()
      .updateTable('mesas')
      .set({ estado: 'libre' })
      .where('id', '=', salon.mesas[0] ?? '')
      .execute();
    await db()
      .updateTable('mesas')
      .set({ unida_a_mesa_id: salon.mesas[1] ?? '' })
      .where('id', '=', salon.mesas[2] ?? '')
      .execute();
    const unida = await fijar(salon, zona, false);
    expect(regla(unida)).toBe('ZONA_CON_MESAS_OCUPADAS');
    expect(unida.ok ? '' : unida.error.mensaje).toMatch(/mesa 3/);
    expect(await activas(salon)).toEqual([true, true, true]);
  });

  it('una mesa apagada con su zona no se puede abrir', async () => {
    const salon = await sembrarSalon({ nombre: 'Salón apagado', mesas: 2 });
    const zona = await sembrarZona(salon, 'Barra', [0]);
    await abrirLasCajas(salon);
    exigirOk(await fijar(salon, zona, false), 'desactivar');
    const r = await comando(abrirMesa, {
      entrada: { mesaId: salon.mesas[0] ?? '', personas: 2 },
      ambito: ambitoDeCaja(salon),
      idempotencyKey: clave(),
    });
    expect(regla(r)).toBe('MESA_NO_ENCONTRADA');
  });

  it('repetir el estado en que ya está no hace nada y no es un error', async () => {
    const salon = await sembrarSalon({ nombre: 'Salón repetido', mesas: 2 });
    const zona = await sembrarZona(salon, 'Patio', [0]);
    expect(exigirOk(await fijar(salon, zona, true), 'ya activa').mesasAfectadas).toBe(0);
    exigirOk(await fijar(salon, zona, false), 'desactivar');
    expect(exigirOk(await fijar(salon, zona, false), 'ya apagada').mesasAfectadas).toBe(0);
    // El «ya estaba apagada» queda en el rastro, pero la memoria de las mesas es la de la desactivación.
    expect(exigirOk(await fijar(salon, zona, true), 'reactivar').mesasAfectadas).toBe(1);
  });

  it('no reactiva si otra zona activa ya se llama igual, ni si el número de mesa ya lo usa otra', async () => {
    const salon = await sembrarSalon({ nombre: 'Salón con choques', mesas: 3 });
    const zona = await sembrarZona(salon, 'Terraza', [0]);
    exigirOk(await fijar(salon, zona, false), 'desactivar');

    const otra = await sembrarZona(salon, ' terraza ', []);
    const nombre = await fijar(salon, zona, true);
    expect(regla(nombre)).toBe('ZONA_NO_REACTIVABLE');
    await db().updateTable('zonas').set({ nombre: 'Otra cosa' }).where('id', '=', otra).execute();

    // Mientras estaba apagada, alguien creó una mesa activa con el número 1.
    await db()
      .insertInto('mesas')
      .values({
        organizacion_id: salon.negocio.organizacionId,
        sucursal_id: salon.sucursal.sucursalId,
        numero: 1,
      })
      .execute();
    const numero = await fijar(salon, zona, true);
    expect(regla(numero)).toBe('ZONA_NO_REACTIVABLE');
    expect(numero.ok ? '' : numero.error.mensaje).toMatch(/mesa 1/);
    expect(await zonaActiva(zona)).toBe(false);
  });

  it('sólo dueño, administrador y gerente; y no una zona de otro negocio', async () => {
    const salon = await sembrarSalon({ nombre: 'Salón de roles', mesas: 1 });
    const zona = await sembrarZona(salon, 'Terraza', [0]);
    const cajero = await fijar(salon, zona, false, 'cajero');
    expect(regla(cajero)).toBe('SIN_PERMISO');
    const ajeno = await sembrarSalon({ nombre: 'Salón ajeno', mesas: 1 });
    const r = await fijar(ajeno, zona, false);
    expect(regla(r)).toBe('ZONA_NO_ENCONTRADA');
    expect(await zonaActiva(zona)).toBe(true);
  });
});
