import { randomUUID } from 'node:crypto';

import { obtenerDb } from '@morphiqpos/data';
import { beforeAll, describe, expect, it } from 'vitest';

import { comando } from '../produccion.ts';
import {
  ambitoDe,
  clave,
  exigirOk,
  sembrarNegocio,
  sembrarSucursal,
  type NegocioReal,
  type SucursalReal,
} from '../pruebas/negocio-real.ts';
import { registrarMerma } from './merma.ts';
import { tomarValuacion } from './valuacion.ts';

/**
 * A24 + DP-D116 · LA MERMA DE UN INSUMO EN NEGATIVO (Postgres real).
 *
 * D116 deja que lo que pasó por cocina se cobre aunque el almacén diga que no había: la existencia
 * queda en negativo «para que el conteo la enseñe». Registrar una merma de ese insumo fallaba con
 * «No puedes mermar más de lo que hay», que no ayuda: la cocina SÍ tiró la crema. Regla: nunca un
 * error mudo. Con la existencia ya en negativo la merma se registra (la existencia baja más y el
 * conteo la corrige); con existencia positiva se sigue rechazando una merma mayor a lo que hay.
 */

let negocio: NegocioReal;
let sucursal: SucursalReal;

beforeAll(async () => {
  negocio = await sembrarNegocio({
    nombre: 'Fonda de los negativos',
    rol: 'gerente',
    giro: 'restaurante',
    paquete: 'restaurante',
  });
  sucursal = await sembrarSucursal(negocio, { terminales: ['Caja 1'] });
}, 60_000);

const ambito = () => ambitoDe(negocio, sucursal.sucursalId, null);

async function sembrarInsumo(
  nombre: string,
  existencia: string,
  costoCentavos: bigint,
): Promise<string> {
  const db = obtenerDb();
  const id = randomUUID();
  await db
    .insertInto('insumos')
    .values({
      id,
      organizacion_id: negocio.organizacionId,
      nombre: `${nombre} ${id.slice(0, 6)}`,
      unidad_base: 'g',
      costo_unitario_centavos: costoCentavos,
    })
    .execute();
  await db
    .insertInto('existencias')
    .values({
      organizacion_id: negocio.organizacionId,
      almacen_id: sucursal.almacenId,
      insumo_id: id,
      cantidad: existencia,
    })
    .execute();
  return id;
}

const existenciaDe = async (insumoId: string): Promise<number> =>
  Number(
    (
      await obtenerDb()
        .selectFrom('existencias')
        .select('cantidad')
        .where('insumo_id', '=', insumoId)
        .executeTakeFirstOrThrow()
    ).cantidad,
  );

const mermar = (insumoId: string, cantidad: string) =>
  comando(registrarMerma, {
    entrada: {
      almacenId: sucursal.almacenId,
      insumoId,
      estrategia: 'insumo',
      cantidad,
      unidad: 'g',
      motivoClave: 'caducado',
    },
    ambito: ambito(),
    idempotencyKey: clave(),
  });

describe('registrar merma con la existencia en negativo', () => {
  it('se registra: la existencia baja más y queda su movimiento de merma', async () => {
    const crema = await sembrarInsumo('Crema', '-500', 10n);

    const resultado = exigirOk(await mermar(crema, '100'), 'inventario.registrar_merma');

    expect(resultado.seRecupera).toBe(false);
    expect(await existenciaDe(crema)).toBe(-600);
    const movimientos = await obtenerDb()
      .selectFrom('movimientos_stock')
      .select(['tipo', 'cantidad', 'motivo'])
      .where('insumo_id', '=', crema)
      .execute();
    expect(movimientos).toHaveLength(1);
    expect(movimientos[0]).toMatchObject({ tipo: 'merma', motivo: 'caducado' });
    expect(Number(movimientos[0]?.cantidad)).toBe(-100);
  });

  it('con existencia POSITIVA sigue rechazando una merma mayor a lo que hay, y lo dice', async () => {
    const jitomate = await sembrarInsumo('Jitomate', '50', 10n);

    const rechazada = await mermar(jitomate, '80');

    expect(rechazada.ok).toBe(false);
    if (!rechazada.ok) {
      expect(rechazada.error.codigo).toBe('REGLA_DE_NEGOCIO');
      expect(rechazada.error.datos?.['regla']).toBe('STOCK_INSUFICIENTE');
      expect(rechazada.error.mensaje).toMatch(/No puedes mermar más de lo que hay/);
    }
    expect(await existenciaDe(jitomate)).toBe(50);
  });
});

describe('«Valor de inventario» y valuación cuentan igual un insumo en negativo', () => {
  it('la valuación guardada lo cuenta como cero, no como deuda', async () => {
    const queso = await sembrarInsumo('Queso', '100', 10n);
    const carne = await sembrarInsumo('Carne', '-500', 10n);

    const resultado = exigirOk(
      await comando(tomarValuacion, {
        entrada: { almacenId: sucursal.almacenId, metodo: 'promedio', umbralDias: 180 },
        ambito: ambito(),
        idempotencyKey: clave(),
      }),
      'inventario.valuar',
    );

    const lineas = await obtenerDb()
      .selectFrom('valuacion_lineas')
      .select(['insumo_id', 'cantidad', 'valor_centavos'])
      .where('valuacion_id', '=', resultado.valuacionId)
      .execute();
    const de = (id: string) => lineas.find((l) => l.insumo_id === id);
    expect(Number(de(queso)?.valor_centavos)).toBe(1_000);
    expect(Number(de(carne)?.cantidad)).toBe(0);
    expect(Number(de(carne)?.valor_centavos)).toBe(0);
    // Todo el almacén: los insumos de los casos de arriba (crema −600 y jitomate 50) también entran.
    const suma = lineas.reduce((total, l) => total + Number(l.valor_centavos), 0);
    expect(BigInt(suma)).toBe(BigInt(resultado.valorCentavos));
  });
});
