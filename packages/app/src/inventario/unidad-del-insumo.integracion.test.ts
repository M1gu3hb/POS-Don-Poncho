import { describe, expect, it } from 'vitest';

import { comando } from '../produccion.ts';
import { ambitoDe, clave, sembrarNegocio, sembrarSucursal } from '../pruebas/negocio-real.ts';
import { crearInsumo } from './inventario.ts';

/**
 * QA1-3 (DP-13.5) · UN INSUMO DE RESTAURANTE EN «kg» SE RECHAZA CON SU RAZÓN, NO CON UN 500.
 *
 * El esquema de la entrada acepta todas las unidades del sistema, pero la base (trigger
 * `insumo_unidad_base_valida`) sólo deja medir el insumo de un restaurante o una cafetería en g, ml
 * o pieza: crearlo en kilos reventaba como «error interno». Ahora el comando lo dice antes de
 * escribir, con lo que hay que hacer.
 */

describe('la unidad del insumo de un restaurante', () => {
  it('en kg: se rechaza con la regla y el porqué, sin escribir nada', async () => {
    const negocio = await sembrarNegocio({
      nombre: 'Fonda de los kilos',
      rol: 'dueno',
      giro: 'restaurante',
      paquete: 'restaurante',
    });
    const sucursal = await sembrarSucursal(negocio, { terminales: ['Caja 1'] });
    const ambito = ambitoDe(negocio, sucursal.sucursalId, null);
    const r = await comando(crearInsumo, {
      entrada: { nombre: 'Carne de res', unidad: 'kg', costoUnitario: '120', stockMinimo: '0' },
      ambito,
      idempotencyKey: clave(),
    });
    expect(r.ok).toBe(false);
    expect(r.ok ? null : r.error.codigo).toBe('REGLA_DE_NEGOCIO');
    expect(r.ok ? null : r.error.datos?.['regla']).toBe('INVENTARIO_INVALIDO');
    expect(r.ok ? '' : r.error.mensaje).toMatch(/g, ml o pieza/);

    const bien = await comando(crearInsumo, {
      entrada: { nombre: 'Carne de res', unidad: 'g', costoUnitario: '0.12', stockMinimo: '0' },
      ambito,
      idempotencyKey: clave(),
    });
    expect(bien.ok).toBe(true);
  });
});
