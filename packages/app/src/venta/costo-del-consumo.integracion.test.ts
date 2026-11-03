import { obtenerDb } from '@morphiqpos/data';
import { describe, expect, it } from 'vitest';

import { exigirOk } from '../pruebas/negocio-real.ts';
import {
  PRECIO_ARRACHERA,
  abrirLasCajas,
  ambitoDeCaja,
  cobrarExacto,
  sembrarSalon,
  sentarYPedir,
} from '../restaurante/pruebas/salon-real.ts';

/**
 * QA2-003 (DP-13.5) · LO QUE UNA VENTA SACA DEL ALMACÉN LLEVA SU COSTO.
 *
 * `repoStock.aplicarMovimientos` escribía cada salida de venta (y de consumo de la casa) sin
 * `costo_unitario_centavos`: la columna se quedaba en su cero de omisión y el corte decía
 * «Insumos consumidos» con costo $0 aunque la receta costaba lo suyo. Ahora cada movimiento lleva
 * el costo del insumo en ese momento.
 */

describe('el costo de lo que sale del almacén al cobrar', () => {
  it('cada salida de la receta lleva el costo del insumo, no cero', async () => {
    const salon = await sembrarSalon({ nombre: 'Fonda del costo', mesas: 2, terminales: 1 });
    await abrirLasCajas(salon);
    const db = obtenerDb();
    // 50 centavos el gramo de arrachera, 2 el de frijol, 300 la tortilla.
    for (const [insumo, costo] of [
      ['arrachera', 50n],
      ['frijol', 2n],
      ['tortilla', 300n],
    ] as const) {
      await db
        .updateTable('insumos')
        .set({ costo_unitario_centavos: costo })
        .where('id', '=', salon.insumos[insumo])
        .execute();
    }
    const { ordenId } = await sentarYPedir(salon, 0, [{ platillo: 'arrachera', cantidad: '1' }]);
    exigirOk(
      await cobrarExacto(ambitoDeCaja(salon), ordenId, Number(PRECIO_ARRACHERA)),
      'venta.cobrar',
    );

    const salidas = await db
      .selectFrom('movimientos_stock')
      .select(['insumo_id', 'cantidad', 'costo_unitario_centavos'])
      .where('organizacion_id', '=', salon.negocio.organizacionId)
      .where('tipo', '=', 'salida_venta')
      .execute();
    const costoDe = (insumo: 'arrachera' | 'frijol' | 'tortilla') =>
      salidas.find((s) => s.insumo_id === salon.insumos[insumo])?.costo_unitario_centavos;
    expect(costoDe('arrachera')).toBe(50n);
    expect(costoDe('frijol')).toBe(2n);
    expect(costoDe('tortilla')).toBe(300n);
  });
});
