import { obtenerDb } from '@morphiqpos/data';
import type { Rol } from '@morphiqpos/contracts';
import { describe, expect, it } from 'vitest';

import { comando } from '../produccion.ts';
import {
  ambitoDe,
  clave,
  exigirOk,
  sembrarNegocio,
  sembrarSucursal,
} from '../pruebas/negocio-real.ts';
import { topeDeDescuento } from './descuento-de-mostrador.ts';

/**
 * QA2-009 (DP-13.5, decisión DP-D59) · UN NEGOCIO SIN TOPES DE DESCUENTO USA LOS DEL SISTEMA.
 *
 * La migración 078 sembró los topes por puesto para todo negocio que existía; Don Poncho se dio de
 * alta después y quedó sin ninguno, y ninguna pantalla los escribe. Con «sin fila es cero», nadie
 * podía dar un descuento, ni el dueño (no hay nadie por encima de él que lo autorice). Sin topes
 * propios, el negocio usa los del sistema, los mismos de la 078; los que tenga escritos mandan.
 */

describe('el tope de descuento de cada puesto', () => {
  it('sin topes escritos: los del sistema (el dueño, el 100 %; el cajero, el 10 %)', async () => {
    const negocio = await sembrarNegocio({
      nombre: 'Fonda sin topes',
      rol: 'dueno',
      giro: 'restaurante',
      paquete: 'restaurante',
    });
    const sucursal = await sembrarSucursal(negocio, { terminales: ['Caja 1'] });
    await obtenerDb()
      .deleteFrom('topes_descuento')
      .where('organizacion_id', '=', negocio.organizacionId)
      .execute();
    const de = async (rol: Rol) =>
      exigirOk(
        await comando(topeDeDescuento, {
          entrada: {},
          ambito: { ...ambitoDe(negocio, sucursal.sucursalId, null), rol },
          idempotencyKey: clave(),
        }),
        'venta.tope_de_descuento',
      );
    expect(await de('dueno')).toMatchObject({ topeBp: 10_000 });
    expect(await de('cajero')).toMatchObject({ topeBp: 1_000, topeCentavos: '5000' });
  });

  it('con un tope escrito, manda el suyo; el puesto que no escribió, el del sistema (DP-14.2)', async () => {
    const negocio = await sembrarNegocio({
      nombre: 'Fonda con su tope',
      rol: 'cajero',
      giro: 'restaurante',
      paquete: 'restaurante',
    });
    const sucursal = await sembrarSucursal(negocio, { terminales: ['Caja 1'] });
    const db = obtenerDb();
    await db
      .deleteFrom('topes_descuento')
      .where('organizacion_id', '=', negocio.organizacionId)
      .execute();
    await db
      .insertInto('topes_descuento')
      .values({
        organizacion_id: negocio.organizacionId,
        rol: 'cajero',
        tope_centavos: 1_000n,
        tope_bp: 200,
      })
      .execute();
    const tope = exigirOk(
      await comando(topeDeDescuento, {
        entrada: {},
        ambito: ambitoDe(negocio, sucursal.sucursalId, null),
        idempotencyKey: clave(),
      }),
      'venta.tope_de_descuento',
    );
    expect(tope).toMatchObject({ topeBp: 200, topeCentavos: '1000' });
    const delGerente = exigirOk(
      await comando(topeDeDescuento, {
        entrada: {},
        ambito: { ...ambitoDe(negocio, sucursal.sucursalId, null), rol: 'gerente' },
        idempotencyKey: clave(),
      }),
      'venta.tope_de_descuento',
    );
    // DP-14.2 · El respaldo va por puesto: la gerente sin fila sigue con su 30 %, no en cero.
    expect(delGerente).toMatchObject({ topeBp: 3_000, topeCentavos: '200000' });
  });
});
