import { obtenerDb } from '@morphiqpos/data';
import { describe, expect, it } from 'vitest';

import { comando } from '../../produccion.ts';
import { clave, exigirOk } from '../../pruebas/negocio-real.ts';
import {
  PRECIO_ARRACHERA,
  PRECIO_CERVEZA,
  abrirLasCajas,
  ambitoDeCaja,
  cobrarExacto,
  lineasDe,
  sembrarSalon,
  sentarYPedir,
} from '../../restaurante/pruebas/salon-real.ts';
import { devolverVenta } from '../../venta/devolucion-de-venta.ts';
import { devolucionesDelCorte } from './devoluciones.ts';

/**
 * QA2-011 (DP-13.5) · EL CORTE SÓLO DA POR REGRESADO LO QUE VOLVIÓ AL ALMACÉN.
 *
 * Devolver un platillo de receta no regresa nada (ya se preparó); devolver una cerveza (`sku`) sí
 * regresa la pieza. La hoja del corte leía la casilla «regresa al inventario» de la devolución y
 * daba por regresado el costo de TODO lo devuelto: un platillo que nunca volvió al almacén dejaba
 * de ser costo de ventas.
 */

const ARRACHERA = 'Arrachera al carbón';
const CERVEZA = 'Cerveza clara';

interface Devolucion {
  readonly productos: readonly string[];
  readonly regresaAlInventario: boolean;
}

/** Vende una arrachera y una cerveza en una mesa y hace las devoluciones dadas, en orden. */
async function venderYDevolver(nombre: string, devoluciones: readonly Devolucion[]) {
  const salon = await sembrarSalon({ nombre, mesas: 1, terminales: 1 });
  const [sesionCajaId] = await abrirLasCajas(salon);
  const { ordenId } = await sentarYPedir(salon, 0, [
    { platillo: 'arrachera', cantidad: '1' },
    { platillo: 'cerveza', cantidad: '1' },
  ]);
  const caja = ambitoDeCaja(salon);
  exigirOk(
    await cobrarExacto(caja, ordenId, Number(PRECIO_ARRACHERA + PRECIO_CERVEZA)),
    'venta.cobrar',
  );
  const lineas = await lineasDe(ordenId);
  for (const { productos, regresaAlInventario } of devoluciones) {
    exigirOk(
      await comando(devolverVenta, {
        entrada: {
          ordenId,
          lineas: productos.map((p) => ({ ordenLineaId: lineas.get(p)?.[0] ?? '', cantidad: '1' })),
          metodo: 'efectivo',
          motivo: 'No le gustó',
          regresaAlInventario,
        },
        ambito: { ...caja, rol: 'gerente' },
        idempotencyKey: clave(),
      }),
      'venta.devolver_venta',
    );
  }
  const costos = await obtenerDb()
    .selectFrom('orden_lineas')
    .select(['producto_nombre', 'costo_unitario_centavos'])
    .where('orden_id', '=', ordenId)
    .execute();
  const costoDe = (producto: string) =>
    costos.find((c) => c.producto_nombre === producto)?.costo_unitario_centavos ?? null;
  const delCorte = await obtenerDb()
    .transaction()
    .execute((tx) => devolucionesDelCorte(tx, salon.negocio.organizacionId, sesionCajaId ?? ''));
  return { delCorte, costoDe };
}

describe('lo que el corte da por regresado al almacén', () => {
  it('un platillo de receta devuelto no regresó: ni la marca ni su costo', async () => {
    const { delCorte, costoDe } = await venderYDevolver('Fonda de la receta', [
      { productos: [ARRACHERA], regresaAlInventario: true },
    ]);
    expect(Number(costoDe(ARRACHERA))).toBeGreaterThan(0);
    expect(delCorte).toMatchObject([{ regresoAlInventario: false, costoDevueltoCentavos: '0' }]);
  });

  it('con una cerveza en la misma devolución, regresa sólo el costo de la cerveza', async () => {
    const { delCorte, costoDe } = await venderYDevolver('Fonda de la cerveza', [
      { productos: [ARRACHERA, CERVEZA], regresaAlInventario: true },
    ]);
    expect(delCorte).toMatchObject([
      { regresoAlInventario: true, costoDevueltoCentavos: String(costoDe(CERVEZA)) },
    ]);
  });

  it('cada devolución dice lo suyo: la cerveza que regresó y, después, la arrachera', async () => {
    const { delCorte, costoDe } = await venderYDevolver('Fonda de las dos devoluciones', [
      { productos: [CERVEZA], regresaAlInventario: true },
      { productos: [ARRACHERA], regresaAlInventario: true },
    ]);
    expect(delCorte).toMatchObject([
      { regresoAlInventario: true, costoDevueltoCentavos: String(costoDe(CERVEZA)) },
      { regresoAlInventario: false, costoDevueltoCentavos: '0' },
    ]);
  });

  it('una cerveza devuelta sin regresarla (se rompió) sigue siendo costo', async () => {
    const { delCorte } = await venderYDevolver('Fonda de la botella rota', [
      { productos: [CERVEZA], regresaAlInventario: false },
    ]);
    expect(delCorte).toMatchObject([{ regresoAlInventario: false, costoDevueltoCentavos: '0' }]);
  });
});
