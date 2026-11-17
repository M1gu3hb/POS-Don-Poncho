import type { Ambito } from '@morphiqpos/contracts';
import { obtenerDb } from '@morphiqpos/data';
import { beforeAll, describe, expect, it } from 'vitest';

import { comando } from '../produccion.ts';
import { clave, sembrarCompanero } from '../pruebas/negocio-real.ts';
import { relevarResponsable } from './relevo.ts';
import {
  abrirLasCajas,
  ambitoDeCaja,
  sembrarSalon,
  sentarYPedir,
  type Salon,
} from './pruebas/salon-real.ts';

/**
 * DP-D156 · «Pasar la mesa a otro mesero» (`restaurante.relevar_responsable`), contra Postgres.
 *
 * El comando existía sin pantalla y relevaba TODAS las cuentas del que se va. La pantalla pasa UNA
 * mesa, así que el comando acepta `ordenId`. Y relevar no tocaba la asignación de la mesa
 * (`mesas.empleado_asignado_id`): con la asignación de mesas activa el plano y el panel del mesero
 * se filtran por ELLA, y la mesa que pasó seguía apareciéndole al que se fue y no al que entró.
 */

let salon: Salon;
let ana: string;
let beto: string;
let cuenta: { ordenId: string; mesaId: string };
let otra: { ordenId: string; mesaId: string };

const db = () => obtenerDb();

beforeAll(async () => {
  salon = await sembrarSalon({ nombre: 'Fonda del relevo', mesas: 20, terminales: 1 });
  await abrirLasCajas(salon);
  ana = await sembrarCompanero(salon.negocio, { nombre: 'Ana', rol: 'mesero' });
  beto = await sembrarCompanero(salon.negocio, { nombre: 'Beto', rol: 'mesero' });
}, 120_000);

let siguiente = 0;

/** Una mesa abierta que atiende `ana`; con o sin asignación de sala a ella. */
async function mesaDeAna(asignada: boolean): Promise<{ ordenId: string; mesaId: string }> {
  const { ordenId, mesaId } = await sentarYPedir(salon, siguiente, [
    { platillo: 'cerveza', cantidad: '2' },
  ]);
  siguiente += 1;
  await db()
    .updateTable('ordenes')
    .set({ empleado_atiende_id: ana })
    .where('id', '=', ordenId)
    .execute();
  await db()
    .updateTable('mesas')
    .set({ empleado_atiende_id: ana, empleado_asignado_id: asignada ? ana : null })
    .where('id', '=', mesaId)
    .execute();
  return { ordenId, mesaId };
}

const ambitoCon = (rol: Ambito['rol']): Ambito => ({ ...ambitoDeCaja(salon), rol });

const relevar = (entrada: Record<string, unknown>, rol: Ambito['rol'] = 'gerente') =>
  comando(relevarResponsable, {
    entrada: { empleadoSaleId: ana, empleadoEntraId: beto, ...entrada },
    ambito: ambitoCon(rol),
    idempotencyKey: clave(),
  });

const mesaPersistida = (id: string) =>
  db()
    .selectFrom('mesas')
    .select(['empleado_atiende_id', 'empleado_asignado_id'])
    .where('id', '=', id)
    .executeTakeFirstOrThrow();

const ordenPersistida = (id: string) =>
  db()
    .selectFrom('ordenes')
    .select('empleado_atiende_id')
    .where('id', '=', id)
    .executeTakeFirstOrThrow();

describe('Pasar UNA mesa a otro mesero (con ordenId)', () => {
  it('sólo se pasa esa cuenta: la otra mesa de quien se va se queda con él', async () => {
    cuenta = await mesaDeAna(false);
    otra = await mesaDeAna(false);

    const salida = await relevar({ ordenId: cuenta.ordenId });

    expect(salida.ok).toBe(true);
    if (!salida.ok) return;
    expect(salida.datos.cuentas.map((c) => c.ordenId)).toEqual([cuenta.ordenId]);
    expect((await ordenPersistida(cuenta.ordenId)).empleado_atiende_id).toBe(beto);
    expect((await mesaPersistida(cuenta.mesaId)).empleado_atiende_id).toBe(beto);
    expect((await ordenPersistida(otra.ordenId)).empleado_atiende_id).toBe(ana);
    expect((await mesaPersistida(otra.mesaId)).empleado_atiende_id).toBe(ana);
  }, 60_000);

  it('deja el corte en el ledger: el tramo de quien se va se cierra y el de quien entra se abre', async () => {
    const mesa = await mesaDeAna(false);
    await relevar({ ordenId: mesa.ordenId });
    const tramos = await db()
      .selectFrom('relevos_atencion')
      .select(['empleado_id', 'hasta', 'empleado_releva_id'])
      .where('orden_id', '=', mesa.ordenId)
      .orderBy('desde')
      .orderBy('hasta', 'asc')
      .execute();
    expect(tramos).toHaveLength(2);
    const cerrado = tramos.find((t) => t.hasta !== null);
    const abierto = tramos.find((t) => t.hasta === null);
    expect(cerrado?.empleado_id).toBe(ana);
    expect(cerrado?.empleado_releva_id).toBe(beto);
    expect(abierto?.empleado_id).toBe(beto);
  }, 60_000);

  it('una cuenta que no atiende quien se va se rechaza y no escribe nada', async () => {
    const mesa = await mesaDeAna(false);
    const salida = await relevar({
      ordenId: mesa.ordenId,
      empleadoSaleId: beto,
      empleadoEntraId: ana,
    });
    expect(salida.ok).toBe(false);
    expect((await ordenPersistida(mesa.ordenId)).empleado_atiende_id).toBe(ana);
    const tramos = await db()
      .selectFrom('relevos_atencion')
      .select('id')
      .where('orden_id', '=', mesa.ordenId)
      .execute();
    expect(tramos).toHaveLength(0);
  }, 60_000);
});

describe('La asignación de sala viaja con la mesa', () => {
  it('la mesa asignada a quien se va queda asignada a quien entra: el plano de los dos cambia', async () => {
    const mesa = await mesaDeAna(true);
    await relevar({ ordenId: mesa.ordenId });
    const fila = await mesaPersistida(mesa.mesaId);
    expect(fila.empleado_atiende_id).toBe(beto);
    expect(fila.empleado_asignado_id).toBe(beto);
  }, 60_000);

  it('una mesa sin asignación sigue sin asignación (no se inventa una)', async () => {
    const mesa = await mesaDeAna(false);
    await relevar({ ordenId: mesa.ordenId });
    expect((await mesaPersistida(mesa.mesaId)).empleado_asignado_id).toBeNull();
  }, 60_000);

  it('sin ordenId (el relevo de turno) también mueve la asignación de las mesas relevadas', async () => {
    const mesa = await mesaDeAna(true);
    const salida = await relevar({});
    expect(salida.ok).toBe(true);
    const fila = await mesaPersistida(mesa.mesaId);
    expect(fila.empleado_atiende_id).toBe(beto);
    expect(fila.empleado_asignado_id).toBe(beto);
  }, 60_000);
});

describe('Quién puede pasar una mesa', () => {
  it.each(['gerente', 'administrador', 'dueno', 'cajero'] as const)(
    '%s sí',
    async (rol) => {
      const mesa = await mesaDeAna(false);
      const salida = await relevar({ ordenId: mesa.ordenId }, rol);
      expect(salida.ok).toBe(true);
    },
    60_000,
  );

  it.each(['mesero', 'cocina', 'almacen'] as const)(
    '%s no: se rechaza y la mesa sigue con quien la atiende',
    async (rol) => {
      const mesa = await mesaDeAna(true);
      const salida = await relevar({ ordenId: mesa.ordenId }, rol);
      expect(salida.ok).toBe(false);
      const fila = await mesaPersistida(mesa.mesaId);
      expect(fila.empleado_atiende_id).toBe(ana);
      expect(fila.empleado_asignado_id).toBe(ana);
    },
    60_000,
  );
});
