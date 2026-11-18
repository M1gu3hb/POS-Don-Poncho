import { randomUUID } from 'node:crypto';

import { conTransaccion, obtenerDb } from '@morphiqpos/data';
import { sql } from 'kysely';
import { describe, expect, it } from 'vitest';

import { salidasSinVenta } from '../caja/corte/consultas.ts';
import { comando } from '../produccion.ts';
import { clave, exigirOk } from '../pruebas/negocio-real.ts';
import {
  PRECIO_ARRACHERA,
  PRECIO_CERVEZA,
  abrirLasCajas,
  ambitoDeCaja,
  cobrarExacto,
  lineasDe,
  sembrarSalon,
  sentarYPedir,
  type Salon,
} from '../restaurante/pruebas/salon-real.ts';
import { devolverVenta } from '../venta/devolucion-de-venta.ts';
import { registrarConsumoInterno } from './consumo-interno.ts';
import { registrarMerma } from './merma.ts';
import { enviarTraspaso, recibirTraspaso } from './traspaso.ts';

/**
 * DP-22 · DP-D167 · CADA MOVIMIENTO DEL KARDEX LLEVA EL COSTO EXACTO DEL INSUMO AL MOVERSE (Postgres real).
 *
 * La revisión del costo exacto (DP-D165) encontró dos defectos en lo que NO había pasado por el
 * cobro, la cancelación ni el ajuste:
 *   · la merma manual, el traspaso y la devolución escribían el movimiento SIN costo (el cero de
 *     omisión): una merma de 2 kg de barbacoa salía a $0 en el kardex y en el corte;
 *   · `inventario.consumo_interno` nunca se había corrido contra Postgres y ahí fallaba: su salida
 *     exige un `motivo` (el `check` `movimiento_stock_salida_con_motivo`) y no lo escribía.
 */

/** 3.4567 ¢ por gramo de arrachera: 34 567 diezmilésimas; el redondeado es 3. */
const ARRACHERA_DMC = 34_567n;
/** 123.4567 ¢ por pieza de cerveza: 1 234 567 diezmilésimas; el redondeado es 123. */
const CERVEZA_DMC = 1_234_567n;

async function salonConCosto(nombre: string): Promise<Salon> {
  const salon = await sembrarSalon({ nombre, mesas: 1, terminales: 1 });
  await abrirLasCajas(salon);
  const db = obtenerDb();
  await db
    .updateTable('insumos')
    .set({ costo_exacto_dmc: ARRACHERA_DMC })
    .where('id', '=', salon.insumos.arrachera)
    .execute();
  await db
    .updateTable('insumos')
    .set({ costo_exacto_dmc: CERVEZA_DMC })
    .where('id', '=', salon.insumos.cerveza)
    .execute();
  return salon;
}

const comoGerente = (salon: Salon) => ({ ...ambitoDeCaja(salon), rol: 'gerente' as const });

interface FilaDelKardex {
  readonly tipo: string;
  readonly cantidad: string;
  readonly costo_exacto_dmc: string;
  readonly costo_unitario_centavos: string;
  readonly importe: string;
}

async function kardexDe(salon: Salon, insumoId: string, tipo: string): Promise<FilaDelKardex[]> {
  const { rows } = await sql<FilaDelKardex>`
    select m.tipo, m.cantidad::text, m.costo_exacto_dmc::text,
           m.costo_unitario_centavos::text, k.importe_centavos::text as importe
      from movimientos_stock m
      join kardex k on k.movimiento_id = m.id
     where m.organizacion_id = ${salon.negocio.organizacionId}
       and m.insumo_id = ${insumoId} and m.tipo = ${tipo}
     order by m.created_at, m.id
  `.execute(obtenerDb());
  return rows;
}

describe('la merma manual lleva el costo exacto', () => {
  it('2 kg de arrachera valen 6913 ¢ en el kardex y en el corte, no $0', async () => {
    const salon = await salonConCosto('Fonda de la merma manual');

    exigirOk(
      await comando(registrarMerma, {
        entrada: {
          almacenId: salon.sucursal.almacenId,
          insumoId: salon.insumos.arrachera,
          estrategia: 'insumo',
          cantidad: '2000',
          unidad: 'g',
          motivoClave: 'caducado',
        },
        ambito: comoGerente(salon),
        idempotencyKey: clave(),
      }),
      'inventario.registrar_merma',
    );

    // 2000 g × 3.4567 ¢ = 6913.4 ¢ → 6913 ¢ (se redondea una sola vez, al final).
    expect(await kardexDe(salon, salon.insumos.arrachera, 'merma')).toEqual([
      {
        tipo: 'merma',
        cantidad: '-2000.0000',
        costo_exacto_dmc: '34567',
        costo_unitario_centavos: '3',
        importe: '-6913',
      },
    ]);
    const salidas = await conTransaccion((tx) =>
      salidasSinVenta(tx, salon.negocio.organizacionId, {
        sesionId: randomUUID(),
        sucursalId: salon.sucursal.sucursalId,
        abreId: randomUUID(),
        cierraElDia: true,
        desde: new Date(Date.now() - 3_600_000),
        hasta: new Date(Date.now() + 60_000),
      }),
    );
    expect(salidas.find((s) => s.nombre.includes('arrachera'))).toMatchObject({
      tipo: 'merma',
      cantidad: '2000',
      costoCentavos: '6913',
    });
  });
});

describe('el traspaso lleva el costo exacto en la salida y en la entrada', () => {
  it('500 g de arrachera que pasan a otro almacén valen 1728 ¢ de cada lado', async () => {
    const salon = await salonConCosto('Fonda del traspaso');
    const destino = randomUUID();
    await obtenerDb()
      .insertInto('almacenes')
      .values({
        id: destino,
        organizacion_id: salon.negocio.organizacionId,
        sucursal_id: salon.sucursal.sucursalId,
        nombre: 'Barra',
        principal: false,
      })
      .execute();
    const enviado = exigirOk(
      await comando(enviarTraspaso, {
        entrada: {
          almacenOrigen: salon.sucursal.almacenId,
          almacenDestino: destino,
          motivo: 'Para la barra',
          lineas: [{ insumoId: salon.insumos.arrachera, cantidad: '500', unidad: 'g' }],
        },
        ambito: comoGerente(salon),
        idempotencyKey: clave(),
      }),
      'inventario.enviar_traspaso',
    );
    exigirOk(
      await comando(recibirTraspaso, {
        entrada: {
          traspasoId: enviado.traspasoId,
          recibido: [{ insumoId: salon.insumos.arrachera, cantidad: '500', unidad: 'g' }],
        },
        ambito: comoGerente(salon),
        idempotencyKey: clave(),
      }),
      'inventario.recibir_traspaso',
    );

    // 500 g × 3.4567 ¢ = 1728.35 ¢ → 1728 ¢.
    const salida = await kardexDe(salon, salon.insumos.arrachera, 'traspaso_salida');
    const entrada = await kardexDe(salon, salon.insumos.arrachera, 'traspaso_entrada');
    expect(salida).toMatchObject([{ costo_exacto_dmc: '34567', importe: '-1728' }]);
    expect(entrada).toMatchObject([{ costo_exacto_dmc: '34567', importe: '1728' }]);
  });
});

describe('la devolución que regresa mercancía lleva el costo exacto', () => {
  it('una cerveza devuelta vale 123 ¢ al volver al almacén', async () => {
    const salon = await salonConCosto('Fonda de la devolución');
    const caja = ambitoDeCaja(salon);
    const { ordenId } = await sentarYPedir(salon, 0, [
      { platillo: 'arrachera', cantidad: '1' },
      { platillo: 'cerveza', cantidad: '1' },
    ]);
    exigirOk(
      await cobrarExacto(caja, ordenId, Number(PRECIO_ARRACHERA + PRECIO_CERVEZA)),
      'venta.cobrar',
    );
    const lineas = await lineasDe(ordenId);
    exigirOk(
      await comando(devolverVenta, {
        entrada: {
          ordenId,
          lineas: [{ ordenLineaId: lineas.get('Cerveza clara')?.[0] ?? '', cantidad: '1' }],
          metodo: 'efectivo',
          motivo: 'No le gustó',
          regresaAlInventario: true,
        },
        ambito: { ...caja, rol: 'gerente' },
        idempotencyKey: clave(),
      }),
      'venta.devolver_venta',
    );

    // La salida de la venta y el regreso valen lo mismo: 1 pieza × 123.4567 ¢ = 123 ¢.
    expect(await kardexDe(salon, salon.insumos.cerveza, 'devolucion')).toMatchObject([
      { costo_exacto_dmc: '1234567', costo_unitario_centavos: '123', importe: '123' },
    ]);
    expect(await kardexDe(salon, salon.insumos.cerveza, 'salida_venta')).toMatchObject([
      { importe: '-123' },
    ]);
  });
});

describe('inventario.consumo_interno contra Postgres', () => {
  it('la comida del personal sale del almacén con su motivo y su costo exacto, y no es una venta', async () => {
    const salon = await salonConCosto('Fonda de la comida del personal');

    const resultado = exigirOk(
      await comando(registrarConsumoInterno, {
        entrada: {
          tipo: 'personal',
          productoId: salon.platillos.arrachera,
          cantidad: '2',
          motivo: 'Comida del personal',
        },
        ambito: comoGerente(salon),
        idempotencyKey: clave(),
      }),
      'inventario.consumo_interno',
    );

    // La receta de la arrachera gasta 280 g: 2 platillos = 560 g × 3.4567 ¢ = 1935.75 ¢ → 1936 ¢.
    expect(resultado.costoCentavos).toBe('1936');
    const filas = await kardexDe(salon, salon.insumos.arrachera, 'salida_consumo_interno');
    expect(filas).toMatchObject([
      { cantidad: '-560.0000', costo_exacto_dmc: '34567', importe: '-1936' },
    ]);
    // Toda la receta (arrachera, frijol, tortilla) sale con su motivo del catálogo y la explicación.
    const { rows } = await sql<{ motivo: string | null; nota: string | null }>`
      select motivo, nota from movimientos_stock
       where organizacion_id = ${salon.negocio.organizacionId}
         and tipo = 'salida_consumo_interno'
    `.execute(obtenerDb());
    expect(rows.length).toBeGreaterThanOrEqual(2);
    for (const fila of rows) {
      expect(fila).toEqual({ motivo: 'consumo_personal', nota: 'Comida del personal' });
    }
  });
});
