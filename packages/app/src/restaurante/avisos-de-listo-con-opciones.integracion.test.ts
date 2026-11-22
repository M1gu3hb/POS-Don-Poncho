import { obtenerDb } from '@morphiqpos/data';
import { sql } from 'kysely';
import { beforeAll, describe, expect, it } from 'vitest';

import { comando } from '../produccion.ts';
import { clave, exigirOk, sembrarCompanero } from '../pruebas/negocio-real.ts';
import { avisosDeListo } from './avisos-de-listo.ts';
import { moverPlatillos } from './mover-platillos.ts';
import {
  abrirLasCajas,
  ambitoDeCaja,
  sembrarSalon,
  sentarYPedir,
  type Salon,
} from './pruebas/salon-real.ts';

/**
 * DP-25 · Parte 3 · 3.2 · EL AVISO DE «LISTO» DICE QUÉ SALIÓ, con las opciones que eligió el mesero
 * («Michelado»), igual que cocina, Caja y ticket (Postgres real). Sólo nombres: ningún precio ni
 * id de opción viaja en el aviso.
 */

let salon: Salon;
let mesero = '';

beforeAll(async () => {
  salon = await sembrarSalon({ nombre: 'Avisos con opciones', mesas: 4 });
  await abrirLasCajas(salon);
  mesero = await sembrarCompanero(salon.negocio, { nombre: 'Ana', rol: 'mesero' });
}, 120_000);

const cocina = () => ({ ...ambitoDeCaja(salon), rol: 'cocina' as const });

async function avisosDe(ordenId: string) {
  return exigirOk(
    await comando(avisosDeListo, {
      entrada: {},
      ambito: { ...ambitoDeCaja(salon), rol: 'mesero' as const, empleoId: mesero },
      idempotencyKey: clave(),
    }),
    'avisos',
  ).avisos.filter((a) => a.ordenId === ordenId);
}

async function listoElPlatillo(ordenId: string): Promise<void> {
  const platillo = await obtenerDb()
    .selectFrom('comanda_items as i')
    .innerJoin('comandas as c', 'c.id', 'i.comanda_id')
    .select('i.id')
    .where('c.orden_id', '=', ordenId)
    .executeTakeFirstOrThrow();
  exigirOk(
    await comando(moverPlatillos, {
      entrada: { platilloIds: [platillo.id], desde: 'nuevo', estado: 'listo' },
      ambito: cocina(),
      idempotencyKey: clave(),
    }),
    'mover',
  );
}

describe('el aviso de «listo» con las opciones del platillo (DP-25 · 3.2)', () => {
  it('un platillo con «Michelado» sale como «Michelado», sin precios ni ids', async () => {
    const { ordenId, mesaId } = await sentarYPedir(salon, 0, [
      { platillo: 'cerveza', cantidad: '1' },
    ]);
    await obtenerDb()
      .updateTable('mesas')
      .set({ empleado_atiende_id: mesero })
      .where('id', '=', mesaId)
      .execute();
    const instantanea = [
      {
        grupoId: 'g1',
        grupo: 'Prepárala',
        opciones: [{ opcionId: 'o1', nombre: 'Michelado', precioCentavos: '1500' }],
      },
    ];
    await sql`update orden_lineas set opciones = ${JSON.stringify(instantanea)}::jsonb where orden_id = ${ordenId}`.execute(
      obtenerDb(),
    );
    await listoElPlatillo(ordenId);
    const [aviso] = await avisosDe(ordenId);
    expect(aviso?.platillos[0]?.opciones).toEqual(['Michelado']);
    expect(JSON.stringify(aviso)).not.toContain('1500');
    expect(JSON.stringify(aviso)).not.toContain('o1');
  });

  it('un platillo sin opciones trae la lista vacía, no un hueco', async () => {
    const { ordenId, mesaId } = await sentarYPedir(salon, 1, [
      { platillo: 'cerveza', cantidad: '1' },
    ]);
    await obtenerDb()
      .updateTable('mesas')
      .set({ empleado_atiende_id: mesero })
      .where('id', '=', mesaId)
      .execute();
    await listoElPlatillo(ordenId);
    const [aviso] = await avisosDe(ordenId);
    expect(aviso?.platillos[0]?.opciones).toEqual([]);
  });
});
