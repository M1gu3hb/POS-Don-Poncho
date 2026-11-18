import { randomUUID } from 'node:crypto';

import { conTransaccion, obtenerDb } from '@morphiqpos/data';
import { sql } from 'kysely';
import { describe, expect, it } from 'vitest';

import { salidasSinVenta } from '../caja/corte/consultas.ts';
import { comando } from '../produccion.ts';
import { clave, exigirOk } from '../pruebas/negocio-real.ts';
import {
  abrirLasCajas,
  ambitoDeCaja,
  sembrarSalon,
  type Salon,
} from '../restaurante/pruebas/salon-real.ts';
import { ajustarStock } from './inventario.ts';

/**
 * DP-22 · DP-D171 · «MERMA / PRODUCTO PERDIDO» DE INVENTARIO → AJUSTAR ES UNA MERMA (Postgres real).
 *
 * La pantalla mandaba la merma a `inventario.ajustar` con `ajuste_conteo`, y el movimiento quedaba
 * como `ajuste`: el corte (que sólo cuenta `merma` y `salida_consumo_interno`) y los reportes de
 * merma no la veían. Ahora la pantalla manda `tipo: 'merma'` con el motivo del catálogo, y el
 * comando graba un movimiento de MERMA con su costo exacto (DP-D165). El conteo físico sigue siendo
 * `ajuste`. Un `tipo: 'merma'` con la existencia en negativo se registra igual (DP-D116, DP-D146).
 */

/** 3.4567 ¢ por gramo de arrachera: 34 567 diezmilésimas. */
const ARRACHERA_DMC = 34_567n;

async function salon(nombre: string): Promise<Salon> {
  const s = await sembrarSalon({ nombre, mesas: 1, terminales: 1 });
  await abrirLasCajas(s);
  await obtenerDb()
    .updateTable('insumos')
    .set({ costo_exacto_dmc: ARRACHERA_DMC })
    .where('id', '=', s.insumos.arrachera)
    .execute();
  return s;
}

const comoGerente = (s: Salon) => ({ ...ambitoDeCaja(s), rol: 'gerente' as const });

const delCorte = (s: Salon) =>
  conTransaccion((tx) =>
    salidasSinVenta(tx, s.negocio.organizacionId, {
      sesionId: randomUUID(),
      sucursalId: s.sucursal.sucursalId,
      abreId: randomUUID(),
      cierraElDia: true,
      desde: new Date(Date.now() - 3_600_000),
      hasta: new Date(Date.now() + 60_000),
    }),
  );

const movimientos = async (s: Salon, insumoId: string) =>
  (
    await sql<{ tipo: string; motivo: string | null; nota: string | null; cantidad: string }>`
      select tipo, motivo, nota, cantidad::text from movimientos_stock
       where organizacion_id = ${s.negocio.organizacionId} and insumo_id = ${insumoId}
         and referencia_tipo <> 'inventario_inicial' order by created_at, id
    `.execute(obtenerDb())
  ).rows.filter((m) => m.tipo === 'merma' || m.tipo === 'ajuste');

describe('la merma que manda la pantalla de Ajustar', () => {
  it('sale en la merma del corte con su importe al centavo (2 000 g × 3.4567 ¢ = 6 913 ¢)', async () => {
    const s = await salon('Fonda de la merma de la pantalla');
    exigirOk(
      await comando(ajustarStock, {
        entrada: {
          almacenId: s.sucursal.almacenId,
          insumoId: s.insumos.arrachera,
          cantidad: '-2000',
          tipo: 'merma',
          motivo: 'dañado',
          nota: 'Merma: se cayó la charola',
        },
        ambito: comoGerente(s),
        idempotencyKey: clave(),
      }),
      'inventario.ajustar',
    );

    expect(await movimientos(s, s.insumos.arrachera)).toEqual([
      {
        tipo: 'merma',
        motivo: 'dañado',
        nota: 'Merma: se cayó la charola',
        cantidad: '-2000.0000',
      },
    ]);
    const salidas = await delCorte(s);
    expect(salidas.find((x) => x.nombre.includes('arrachera'))).toMatchObject({
      tipo: 'merma',
      motivo: 'dañado',
      cantidad: '2000',
      costoCentavos: '6913',
    });
  });

  it('el conteo físico sigue siendo un ajuste y no sale como merma', async () => {
    const s = await salon('Fonda del conteo');
    exigirOk(
      await comando(ajustarStock, {
        entrada: {
          almacenId: s.sucursal.almacenId,
          insumoId: s.insumos.arrachera,
          cantidad: '-500',
          motivo: 'ajuste_conteo',
          nota: 'Corrección de conteo: faltaban',
        },
        ambito: comoGerente(s),
        idempotencyKey: clave(),
      }),
      'inventario.ajustar',
    );
    expect((await movimientos(s, s.insumos.arrachera)).map((m) => m.tipo)).toEqual(['ajuste']);
    expect((await delCorte(s)).filter((x) => x.nombre.includes('arrachera'))).toEqual([]);
  });

  it('con la existencia en negativo la merma se registra igual: la existencia baja más', async () => {
    const s = await salon('Fonda de la merma en negativo');
    await obtenerDb()
      .updateTable('existencias')
      .set({ cantidad: '-300' })
      .where('insumo_id', '=', s.insumos.arrachera)
      .execute();
    const hecha = exigirOk(
      await comando(ajustarStock, {
        entrada: {
          almacenId: s.sucursal.almacenId,
          insumoId: s.insumos.arrachera,
          cantidad: '-100',
          tipo: 'merma',
          motivo: 'dañado',
          nota: 'Merma: se tiró',
        },
        ambito: comoGerente(s),
        idempotencyKey: clave(),
      }),
      'inventario.ajustar',
    );
    expect(Number(hecha.cantidad)).toBe(-400);
  });

  it('una merma no suma: con cantidad positiva se rechaza diciendo por qué', async () => {
    const s = await salon('Fonda de la merma que suma');
    const r = await comando(ajustarStock, {
      entrada: {
        almacenId: s.sucursal.almacenId,
        insumoId: s.insumos.arrachera,
        cantidad: '100',
        tipo: 'merma',
        motivo: 'dañado',
        nota: null,
      },
      ambito: comoGerente(s),
      idempotencyKey: clave(),
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.mensaje).toMatch(/merma sólo resta/i);
  });
});
