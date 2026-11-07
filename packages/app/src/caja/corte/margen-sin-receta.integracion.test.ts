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
  sembrarProducto,
  sembrarSucursal,
  type NegocioReal,
  type SucursalReal,
} from '../../pruebas/negocio-real.ts';
import { hojaDelCorte } from './documento.ts';

/**
 * DP-13.2 · EL MARGEN «SIN RECETA», UNA SOLA REGLA DEL SERVIDOR, contra Postgres.
 *
 * Un platillo sin receta se cobra con costo cero, y una cuenta que lo lleva salía con margen
 * inflado (o del 100 %). La regla vive en el servidor (`costo-conocido.ts`): una línea con importe
 * y sin costo no tiene costo conocido; una cuenta con TODAS así es «sin receta», con ALGUNAS es
 * «receta incompleta». El corte saca el margen sólo de las cuentas con costo completo y cuenta las
 * demás; el puente le dice a cada venta su estado, para las pantallas heredadas y el CSV.
 */

let negocio: NegocioReal;
let sucursal: SucursalReal;
let caja = '';
const ventas: Record<'completa' | 'sinReceta' | 'incompleta', { id: string; total: number }> = {
  completa: { id: '', total: 0 },
  sinReceta: { id: '', total: 0 },
  incompleta: { id: '', total: 0 },
};

const deLaDuena = () => ambitoDe(negocio, sucursal.sucursalId, sucursal.terminales[0] ?? null);

beforeAll(async () => {
  negocio = await sembrarNegocio({
    nombre: 'Fonda del margen',
    rol: 'dueno',
    giro: 'restaurante',
    paquete: 'restaurante',
  });
  sucursal = await sembrarSucursal(negocio, { terminales: ['Caja'] });
  const { productoId: conReceta } = await sembrarProducto(negocio, sucursal.almacenId, {
    nombre: 'Taco de pastor',
    precioCentavos: 4_000n,
    existencia: '50',
  });
  const sinReceta = randomUUID();
  await conTransaccion((tx) =>
    tx
      .insertInto('productos')
      .values({
        id: sinReceta,
        organizacion_id: negocio.organizacionId,
        nombre: 'Agua de jamaica',
        precio_venta_centavos: 3_000n,
        costo_unitario_centavos: 0n,
        estrategia_consumo: 'ninguno',
      })
      .execute(),
  );
  const ambito = deLaDuena();
  caja = await abrirCajaReal(ambito);
  const cobrar = async (lineas: { productoId: string; cantidad: string }[]) => {
    const venta = await armarVenta(ambito, lineas);
    exigirOk(await cobrarEnEfectivo(ambito, venta.ordenId, venta.totalCentavos), 'venta.cobrar');
    return { id: venta.ordenId, total: venta.totalCentavos };
  };
  ventas.completa = await cobrar([{ productoId: conReceta, cantidad: '2' }]);
  ventas.sinReceta = await cobrar([{ productoId: sinReceta, cantidad: '1' }]);
  ventas.incompleta = await cobrar([
    { productoId: conReceta, cantidad: '1' },
    { productoId: sinReceta, cantidad: '1' },
  ]);
});

describe('el corte saca el margen sólo de lo que tiene costo completo', () => {
  it('cuenta aparte las ventas sin receta y las de receta incompleta', async () => {
    const hoja = exigirOk(
      await comando(hojaDelCorte, {
        entrada: { sesionCajaId: caja },
        ambito: deLaDuena(),
        idempotencyKey: clave(),
      }),
      'caja.hoja_del_corte',
    );
    expect(hoja.resumen).toMatchObject({
      tickets: 3,
      ventaConCostoCentavos: String(ventas.completa.total),
      // El taco de pastor cuesta la mitad de su precio (`sembrarProducto`).
      costoConocidoCentavos: String(ventas.completa.total / 2),
      ventasSinReceta: 1,
      ventasRecetaIncompleta: 1,
    });
    const agua = hoja.productos.find((p) => p.nombre === 'Agua de jamaica');
    const taco = hoja.productos.find((p) => p.nombre === 'Taco de pastor');
    expect(agua).toMatchObject({ lineas: 2, lineasSinCosto: 2, lineasSinReceta: 2 });
    expect(taco).toMatchObject({ lineasSinCosto: 0 });
  });
});

describe('el puente le dice a cada venta el estado de su costo', () => {
  it('a quien ve márgenes: conocido, sin receta o receta incompleta', async () => {
    const filas = await consultar(deLaDuena(), { entidad: 'Venta', operacion: 'list' });
    const estado = (id: string) => filas.find((f) => f['id'] === id)?.['estado_costo'];
    expect(estado(ventas.completa.id)).toBe('conocido');
    expect(estado(ventas.sinReceta.id)).toBe('sin_receta');
    expect(estado(ventas.incompleta.id)).toBe('receta_incompleta');
  });

  it('a quien no ve márgenes, nada: ni el estado del costo', async () => {
    const cajero = { ...deLaDuena(), rol: 'cajero' as const };
    const filas = await consultar(cajero, { entidad: 'Venta', operacion: 'list' });
    expect(filas.length).toBeGreaterThan(0);
    for (const fila of filas) expect(fila).not.toHaveProperty('estado_costo');
  });
});
