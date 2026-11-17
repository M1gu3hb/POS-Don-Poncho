import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { obtenerDb, type Transaccion } from '@morphiqpos/data';
import { sql } from 'kysely';
import { beforeAll, describe, expect, it } from 'vitest';

import {
  sembrarNegocio,
  sembrarSucursal,
  type NegocioReal,
  type SucursalReal,
} from '../pruebas/negocio-real.ts';

/**
 * DP-22 · DP-D165 · LA MIGRACIÓN 195 Y LA REGLA QUE DEJA EN LA BASE (contra Postgres).
 *
 * Dos cosas que no se prueban con los comandos, porque los comandos ya escriben las dos columnas:
 *
 *   1. EL RELLENO. Una base que ya tiene insumos y movimientos (producción no, pero el maestro y
 *      cualquier base con datos sí) tiene que quedar con `costo_exacto_dmc = centavos × 10 000`.
 *      Se corre el tramo de relleno del SQL REAL de la migración (entre sus marcas) sobre filas
 *      «de antes» —con el exacto en cero—, dentro de una transacción que se deshace.
 *   2. LA REGLA. `costo_unitario_centavos` ES el exacto redondeado: un `check` por tabla lo impone y
 *      un disparador completa la columna que no se escribió.
 */

const MIGRACION = readFileSync(
  fileURLToPath(
    new URL('../../../data/src/migraciones/sql/195_costo_exacto_del_insumo.sql', import.meta.url),
  ),
  'utf8',
);

const MARCA_INICIO = '-- ▼ RELLENO ▼';
const MARCA_FIN = '-- ▲ RELLENO ▲';

/** Las sentencias de relleno de la migración, tal cual están escritas. */
function elRelleno(): string {
  const inicio = MIGRACION.indexOf(MARCA_INICIO);
  const fin = MIGRACION.indexOf(MARCA_FIN);
  if (inicio === -1 || fin === -1 || fin < inicio) return '';
  // Desde el renglón SIGUIENTE a la marca de inicio: en el mismo renglón hay un comentario.
  const finDelRenglon = MIGRACION.indexOf('\n', inicio);
  return MIGRACION.slice(finDelRenglon + 1, fin);
}

class Deshacer extends Error {}

let negocio: NegocioReal;
let sucursal: SucursalReal;

beforeAll(async () => {
  negocio = await sembrarNegocio({
    nombre: 'Fonda de la migración 195',
    rol: 'dueno',
    giro: 'restaurante',
    paquete: 'restaurante',
  });
  sucursal = await sembrarSucursal(negocio, { terminales: ['Caja 1'] });
}, 60_000);

/** Corre `cuerpo` dentro de una transacción y la deshace SIEMPRE. */
async function enUnaTransaccionQueSeDeshace(
  cuerpo: (tx: Transaccion) => Promise<void>,
): Promise<void> {
  try {
    await obtenerDb()
      .transaction()
      .execute(async (tx) => {
        await cuerpo(tx);
        throw new Deshacer();
      });
  } catch (error) {
    if (!(error instanceof Deshacer)) throw error;
  }
}

describe('195 · el relleno de lo que ya existía', () => {
  it('la migración trae su tramo de relleno entre las marcas', () => {
    const relleno = elRelleno();
    expect(relleno).toMatch(/update insumos/);
    expect(relleno).toMatch(/update movimientos_stock/);
    expect(relleno).toMatch(/update valuacion_lineas/);
  });

  it('filas con costo en centavos y sin exacto quedan con centavos × 10 000; las de costo cero, en cero', async () => {
    await enUnaTransaccionQueSeDeshace(async (tx) => {
      // Una base «de antes»: sin la regla nueva, para poder escribir un exacto en cero a mano.
      for (const tabla of ['insumos', 'movimientos_stock', 'valuacion_lineas']) {
        await sql
          .raw(`alter table ${tabla} disable trigger ${tabla}_costo_exacto_coherente`)
          .execute(tx);
        await sql
          .raw(`alter table ${tabla} drop constraint ${tabla}_costo_exacto_coherente`)
          .execute(tx);
      }

      const conCosto = randomUUID();
      const sinCosto = randomUUID();
      for (const [id, costo] of [
        [conCosto, 450n],
        [sinCosto, 0n],
      ] as const) {
        await tx
          .insertInto('insumos')
          .values({
            id,
            organizacion_id: negocio.organizacionId,
            nombre: `Insumo ${id.slice(0, 6)}`,
            unidad_base: 'g',
            costo_unitario_centavos: costo,
            costo_exacto_dmc: 0n,
          })
          .execute();
      }
      await tx
        .insertInto('movimientos_stock')
        .values({
          organizacion_id: negocio.organizacionId,
          almacen_id: sucursal.almacenId,
          insumo_id: conCosto,
          tipo: 'inventario_inicial',
          cantidad: '10',
          unidad: 'g',
          costo_unitario_centavos: 450n,
          costo_exacto_dmc: 0n,
          referencia_tipo: 'manual',
        })
        .execute();
      const valuacion = await tx
        .insertInto('valuaciones_inventario')
        .values({
          organizacion_id: negocio.organizacionId,
          almacen_id: sucursal.almacenId,
          metodo: 'promedio',
          tomada_en: new Date(),
          valor_centavos: 4_500n,
          articulos: 1,
          empleado_id: negocio.empleoId,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      await tx
        .insertInto('valuacion_lineas')
        .values({
          valuacion_id: valuacion.id,
          insumo_id: conCosto,
          cantidad: '10',
          costo_unitario_centavos: 450n,
          costo_exacto_dmc: 0n,
          valor_centavos: 4_500n,
        })
        .execute();

      // Antes del relleno: el exacto está en cero.
      const antes = await tx
        .selectFrom('insumos')
        .select('costo_exacto_dmc')
        .where('id', '=', conCosto)
        .executeTakeFirstOrThrow();
      expect(antes.costo_exacto_dmc).toBe(0n);

      await sql.raw(elRelleno()).execute(tx);

      const insumos = await tx
        .selectFrom('insumos')
        .select(['id', 'costo_exacto_dmc'])
        .where('id', 'in', [conCosto, sinCosto])
        .execute();
      expect(insumos.find((i) => i.id === conCosto)?.costo_exacto_dmc).toBe(4_500_000n);
      expect(insumos.find((i) => i.id === sinCosto)?.costo_exacto_dmc).toBe(0n);
      const movimiento = await tx
        .selectFrom('movimientos_stock')
        .select('costo_exacto_dmc')
        .where('insumo_id', '=', conCosto)
        .executeTakeFirstOrThrow();
      expect(movimiento.costo_exacto_dmc).toBe(4_500_000n);
      const linea = await tx
        .selectFrom('valuacion_lineas')
        .select('costo_exacto_dmc')
        .where('valuacion_id', '=', valuacion.id)
        .executeTakeFirstOrThrow();
      expect(linea.costo_exacto_dmc).toBe(4_500_000n);
    });
  });
});

describe('195 · la regla en la base: el redondeado ES el exacto redondeado', () => {
  const nuevoInsumo = (valores: {
    costo_unitario_centavos?: bigint;
    costo_exacto_dmc?: bigint;
  }) => ({
    id: randomUUID(),
    organizacion_id: negocio.organizacionId,
    nombre: `Insumo ${randomUUID().slice(0, 6)}`,
    unidad_base: 'g' as const,
    ...valores,
  });

  const costosDe = async (tx: Transaccion, id: string) =>
    tx
      .selectFrom('insumos')
      .select(['costo_unitario_centavos', 'costo_exacto_dmc'])
      .where('id', '=', id)
      .executeTakeFirstOrThrow();

  it('quien sólo conoce los centavos deja el exacto en centavos × 10 000', async () => {
    await enUnaTransaccionQueSeDeshace(async (tx) => {
      const fila = nuevoInsumo({ costo_unitario_centavos: 250n });
      await tx.insertInto('insumos').values(fila).execute();
      expect(await costosDe(tx, fila.id)).toEqual({
        costo_unitario_centavos: 250n,
        costo_exacto_dmc: 2_500_000n,
      });
    });
  });

  it('quien sólo conoce el exacto deja los centavos redondeados (medio centavo hacia arriba)', async () => {
    await enUnaTransaccionQueSeDeshace(async (tx) => {
      const leche = nuevoInsumo({ costo_exacto_dmc: 24_000n });
      const maiz = nuevoInsumo({ costo_exacto_dmc: 45_000n });
      const casi = nuevoInsumo({ costo_exacto_dmc: 44_999n });
      await tx.insertInto('insumos').values([leche, maiz, casi]).execute();
      expect((await costosDe(tx, leche.id)).costo_unitario_centavos).toBe(2n);
      expect((await costosDe(tx, maiz.id)).costo_unitario_centavos).toBe(5n);
      expect((await costosDe(tx, casi.id)).costo_unitario_centavos).toBe(4n);
    });
  });

  it('al actualizar sólo una de las dos, la otra la sigue', async () => {
    await enUnaTransaccionQueSeDeshace(async (tx) => {
      const fila = nuevoInsumo({ costo_exacto_dmc: 24_000n });
      await tx.insertInto('insumos').values(fila).execute();

      await tx
        .updateTable('insumos')
        .set({ costo_unitario_centavos: 7n })
        .where('id', '=', fila.id)
        .execute();
      expect(await costosDe(tx, fila.id)).toEqual({
        costo_unitario_centavos: 7n,
        costo_exacto_dmc: 70_000n,
      });

      await tx
        .updateTable('insumos')
        .set({ costo_exacto_dmc: 26_667n })
        .where('id', '=', fila.id)
        .execute();
      expect(await costosDe(tx, fila.id)).toEqual({
        costo_unitario_centavos: 3n,
        costo_exacto_dmc: 26_667n,
      });
    });
  });

  it('dos columnas que se contradicen no se pueden guardar', async () => {
    const intento = async (valores: {
      costo_unitario_centavos: bigint;
      costo_exacto_dmc: bigint;
    }) => {
      try {
        await enUnaTransaccionQueSeDeshace(async (tx) => {
          await tx.insertInto('insumos').values(nuevoInsumo(valores)).execute();
        });
        return 'NO LANZÓ';
      } catch (error) {
        return (error as { code?: string }).code ?? String(error);
      }
    };
    // 5 centavos con un exacto de 2.4: no es su redondeo.
    expect(await intento({ costo_unitario_centavos: 5n, costo_exacto_dmc: 24_000n })).toBe('23514');
    // Un exacto negativo, tampoco.
    expect(await intento({ costo_unitario_centavos: 0n, costo_exacto_dmc: -1n })).toBe('23514');
  });
});
