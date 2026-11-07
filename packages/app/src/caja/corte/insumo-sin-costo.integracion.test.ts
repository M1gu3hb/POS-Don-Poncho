import { conTransaccion } from '@morphiqpos/data';
import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';

import { comando } from '../../produccion.ts';
import { consultar } from '../../puente/consultar.ts';
import {
  abrirCajaReal,
  ambitoDe,
  armarVenta,
  clave,
  cobrarEnEfectivo,
  exigirOk,
  sembrarNegocio,
  sembrarSucursal,
  type NegocioReal,
  type SucursalReal,
} from '../../pruebas/negocio-real.ts';
import { hojaDelCorte } from './documento.ts';

/**
 * DP-14.6-2 · UN INSUMO CON COSTO CERO DEJA LA CUENTA EN «RECETA INCOMPLETA», no en «conocida».
 *
 * La sopa tiene receta (costo congelado de $20 por la parte con costo), pero uno de sus insumos
 * está en $0: el costo real es mayor y el margen saldría inflado. La regla es del servidor.
 */

let negocio: NegocioReal;
let sucursal: SucursalReal;
let caja = '';
const venta = { id: '', total: 0 };
const completa = { id: '', total: 0 };

const deLaDuena = () => ambitoDe(negocio, sucursal.sucursalId, sucursal.terminales[0] ?? null);

async function sembrarPlatillo(nombre: string, insumos: readonly bigint[]): Promise<string> {
  const productoId = randomUUID();
  await conTransaccion(async (tx) => {
    await tx
      .insertInto('productos')
      .values({
        id: productoId,
        organizacion_id: negocio.organizacionId,
        nombre,
        precio_venta_centavos: 9_000n,
        costo_unitario_centavos: 2_000n,
        estrategia_consumo: 'ninguno',
      })
      .execute();
    for (const costo of insumos) {
      const insumoId = randomUUID();
      await tx
        .insertInto('insumos')
        .values({
          id: insumoId,
          organizacion_id: negocio.organizacionId,
          nombre: `${nombre} ${insumoId.slice(0, 6)}`,
          unidad_base: 'g',
          costo_unitario_centavos: costo,
        })
        .execute();
      await tx
        .insertInto('recetas')
        .values({
          organizacion_id: negocio.organizacionId,
          producto_id: productoId,
          insumo_id: insumoId,
          cantidad: '100',
          unidad: 'g',
        })
        .execute();
    }
  });
  return productoId;
}

beforeAll(async () => {
  negocio = await sembrarNegocio({
    nombre: 'Fonda del insumo en cero',
    rol: 'dueno',
    giro: 'restaurante',
    paquete: 'restaurante',
  });
  sucursal = await sembrarSucursal(negocio, { terminales: ['Caja'] });
  const sopa = await sembrarPlatillo('Sopa de fideo', [300n, 0n]);
  const arroz = await sembrarPlatillo('Arroz', [300n, 500n]);
  const ambito = deLaDuena();
  caja = await abrirCajaReal(ambito);
  const cobrar = async (productoId: string) => {
    const v = await armarVenta(ambito, [{ productoId, cantidad: '1' }]);
    exigirOk(await cobrarEnEfectivo(ambito, v.ordenId, v.totalCentavos), 'venta.cobrar');
    return { id: v.ordenId, total: v.totalCentavos };
  };
  Object.assign(venta, await cobrar(sopa));
  Object.assign(completa, await cobrar(arroz));
});

describe('un insumo en cero', () => {
  it('el puente dice «receta_incompleta» de la cuenta y «conocido» de la que tiene todo', async () => {
    const filas = await consultar(deLaDuena(), { entidad: 'Venta', operacion: 'list' });
    const estado = (id: string) => filas.find((f) => f['id'] === id)?.['estado_costo'];
    expect(estado(venta.id)).toBe('receta_incompleta');
    expect(estado(completa.id)).toBe('conocido');
  });

  it('el corte deja la cuenta fuera del margen y la cuenta aparte', async () => {
    const hoja = exigirOk(
      await comando(hojaDelCorte, {
        entrada: { sesionCajaId: caja },
        ambito: deLaDuena(),
        idempotencyKey: clave(),
      }),
      'caja.hoja_del_corte',
    );
    expect(hoja.resumen).toMatchObject({
      ventasRecetaIncompleta: 1,
      ventaConCostoCentavos: String(completa.total),
    });
  });

  it('la tabla por producto cuenta la sopa como receta incompleta, no como costo conocido', async () => {
    const hoja = exigirOk(
      await comando(hojaDelCorte, {
        entrada: { sesionCajaId: caja },
        ambito: deLaDuena(),
        idempotencyKey: clave(),
      }),
      'caja.hoja_del_corte',
    );
    const sopa = hoja.productos.find((p) => p.nombre === 'Sopa de fideo');
    const arroz = hoja.productos.find((p) => p.nombre === 'Arroz');
    // Tiene receta (no es «sin receta») pero le falta el costo de un insumo.
    expect(sopa).toMatchObject({ lineas: 1, lineasSinCosto: 1, lineasSinReceta: 0 });
    expect(arroz).toMatchObject({ lineas: 1, lineasSinCosto: 0, lineasSinReceta: 0 });
  });
});
