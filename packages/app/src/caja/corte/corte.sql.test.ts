import type { Transaccion } from '@morphiqpos/data';
import { describe, expect, it } from 'vitest';

import * as consultas from './consultas.ts';
import * as extras from './extras.ts';
import { transaccionGrabadora } from '../../pruebas/grabadora.ts';

/**
 * EL SQL QUE LA HOJA DEL CORTE EMITE DE VERDAD (C.6 de la 2.4).
 *
 * Las consultas de la hoja van en `sql` crudo, y la base falsa de las pruebas devuelve lo
 * mismo a cualquier consulta crudo: una consulta que olvidara su organización seguiría en
 * verde. Aquí hay un Kysely REAL con el compilador de Postgres sobre una conexión que
 * apunta lo que se le pide, y se afirma sobre lo compilado: cada consulta lleva el
 * negocio como parámetro —un corte de otro negocio no se cuela— y se acota a SU sesión o
 * a la ventana de su sesión, nunca a «todo».
 *
 * Lo que este archivo NO puede decir es que Postgres devuelva lo que creemos: eso lo dicen
 * el e2e del restaurante, que cierra por la pantalla y leen la hoja pintada contra la base viva.
 */

const ORG = '11111111-1111-4111-8111-111111111111';
const SESION = '22222222-2222-4222-8222-222222222222';
const VENTANA = {
  sucursalId: '33333333-3333-4333-8333-333333333333',
  abiertaEn: new Date('2026-09-25T14:00:00Z'),
  cerradaEn: new Date('2026-09-26T03:00:00Z'),
};
const AHORA = new Date('2026-09-26T03:00:00Z');

const grabadora = () => transaccionGrabadora();

type Acotada = 'sesion' | 'ventana' | 'negocio';

/** Cada consulta de la hoja, con lo que la acota además del negocio. */
const CONSULTAS: readonly (readonly [string, Acotada, (tx: Transaccion) => Promise<unknown>])[] = [
  ['leerSesion', 'sesion', (tx) => consultas.leerSesion(tx, ORG, SESION)],
  ['movimientosPorTipo', 'sesion', (tx) => consultas.movimientosPorTipo(tx, ORG, SESION)],
  ['conteoDelCierre', 'sesion', (tx) => consultas.conteoDelCierre(tx, ORG, SESION)],
  ['ventasPorMetodo', 'sesion', (tx) => consultas.ventasPorMetodo(tx, ORG, SESION)],
  ['resumenDeVentas', 'sesion', (tx) => consultas.resumenDeVentas(tx, ORG, SESION)],
  ['detalleDeVentas', 'sesion', (tx) => consultas.detalleDeVentas(tx, ORG, SESION)],
  ['productosVendidos', 'sesion', (tx) => consultas.productosVendidos(tx, ORG, SESION)],
  ['ventasPorPersona', 'sesion', (tx) => consultas.ventasPorPersona(tx, ORG, SESION)],
  ['gastosDelCorte', 'sesion', (tx) => consultas.gastosDelCorte(tx, ORG, SESION)],
  ['cancelacionesDelCorte', 'ventana', (tx) => consultas.cancelacionesDelCorte(tx, ORG, VENTANA)],
  ['descuentosPorUsuario', 'sesion', (tx) => consultas.descuentosPorUsuario(tx, ORG, SESION)],
  ['alertasDeInventario', 'negocio', (tx) => consultas.alertasDeInventario(tx, ORG, AHORA)],
  ['insumosConsumidos', 'sesion', (tx) => consultas.insumosConsumidos(tx, ORG, SESION)],
  ['salidasSinVenta', 'ventana', (tx) => consultas.salidasSinVenta(tx, ORG, VENTANA)],
  ['propinasPorMesero', 'sesion', (tx) => extras.propinasPorMesero(tx, ORG, SESION)],
];

describe('la hoja del corte · cada consulta, acotada', () => {
  it.each(CONSULTAS)('%s lleva el negocio y se acota a su %s', async (_nombre, acotada, correr) => {
    const { tx, conexion } = grabadora();
    await correr(tx);
    expect(conexion.consultas).toHaveLength(1);
    const [consulta] = conexion.consultas;
    const parametros = consulta?.parameters ?? [];
    expect(
      parametros,
      'La consulta no lleva la organización: leería de todos los negocios.',
    ).toContain(ORG);
    expect(consulta?.sql).toMatch(/organizacion_id = \$\d+/);
    if (acotada === 'sesion') {
      expect(parametros, 'La consulta no se acota a la sesión del corte.').toContain(SESION);
    }
    if (acotada === 'ventana') {
      expect(
        parametros.some((p) => p instanceof Date && p.getTime() === VENTANA.abiertaEn.getTime()),
        'La consulta no se acota a la ventana de la sesión: sumaría días que no son del corte.',
      ).toBe(true);
    }
  });
});
