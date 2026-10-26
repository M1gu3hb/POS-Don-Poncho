import {
  NEGOCIOS_AJENOS,
  NEGOCIOS_DE_PRUEBA,
  NEGOCIOS_REALES,
} from '@morphiqpos/contracts/negocios';
import { afterEach, describe, expect, it } from 'vitest';

import { ambitoDeCajero } from '../pruebas/dobles.ts';
import { arnesGrabador } from '../pruebas/grabadora.ts';
import { resetearNegocioDePrueba } from './resetear.ts';

/**
 * EL RESETEO SE NIEGA SOBRE TODO LO QUE NO SEA UN RESTAURANTE DE PRUEBA (bloque B.1 de la
 * 2.4, endurecido en DP-2).
 *
 * Corre el envoltorio REAL sobre la definición REAL con una conexión que apunta cada
 * consulta, y afirma que contesta 403 **sin haber mandado UNA sola consulta a la base** —ni
 * la lectura del giro, y mucho menos un `delete`— sobre Don Poncho, sobre cada negocio
 * ajeno de la base compartida y sobre un negocio que nadie declaró. Y la segunda guarda:
 * aunque el ID sea de prueba, si `DATABASE_URL` apunta a un proyecto intocable tampoco.
 */

const URL_ORIGINAL = process.env['DATABASE_URL'];

afterEach(() => {
  if (URL_ORIGINAL === undefined) delete process.env['DATABASE_URL'];
  else process.env['DATABASE_URL'] = URL_ORIGINAL;
});

function resetearComo(organizacionId: string) {
  const { ejecutar, conexion } = arnesGrabador([]);
  const salida = ejecutar(resetearNegocioDePrueba, {
    entrada: { confirmacion: 'RESETEAR' },
    ambito: ambitoDeCajero({ organizacionId, rol: 'dueno' }),
    idempotencyKey: `resetear-${organizacionId}`,
  });
  return { salida, conexion };
}

describe('configuracion.resetear_negocio_de_prueba · la guarda', () => {
  it.each(
    [...NEGOCIOS_REALES, ...NEGOCIOS_AJENOS].map((n) => [n.nombre, n.id] as const),
  )('sobre %s contesta SIN_PERMISO y no toca la base', async (_nombre, id) => {
    const { salida, conexion } = resetearComo(id);
    const resultado = await salida;
    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.error.codigo).toBe('SIN_PERMISO');
    expect(conexion.consultas).toHaveLength(0);
  });

  it('sobre un negocio que no está en ninguna lista, también: la regla es positiva', async () => {
    const { salida, conexion } = resetearComo('99999999-0000-4000-8000-000000000009');
    const resultado = await salida;
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error.codigo).toBe('SIN_PERMISO');
    expect(conexion.consultas).toHaveLength(0);
  });

  it('sobre un restaurante de prueba, pero en la base compartida, se niega igual', async () => {
    process.env['DATABASE_URL'] =
      'postgresql://postgres.wyqmzhliurwyxuyxznpb:x@aws-0-us-east-2.pooler.supabase.com:6543/postgres';
    const prueba = NEGOCIOS_DE_PRUEBA[0];
    if (prueba === undefined) throw new Error('sin negocios de prueba');
    const { salida, conexion } = resetearComo(prueba.id);
    const resultado = await salida;
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error.codigo).toBe('SIN_PERMISO');
    expect(conexion.consultas).toHaveLength(0);
  });

  it('sobre un restaurante de prueba en una base desechable, la PRIMERA consulta es leer su giro', async () => {
    process.env['DATABASE_URL'] = 'postgres://morphiqpos:x@127.0.0.1:55433/desechable';
    const prueba = NEGOCIOS_DE_PRUEBA[0];
    if (prueba === undefined) throw new Error('sin negocios de prueba');
    const { salida, conexion } = resetearComo(prueba.id);
    await salida;
    expect(conexion.consultas.length).toBeGreaterThan(0);
    expect(conexion.consultas[0]?.sql).toMatch(/from\s+"organizaciones"/i);
    // Y ninguna consulta borra nada antes de saber qué negocio es.
    expect(conexion.consultas[0]?.sql).not.toMatch(/delete/i);
  });
});
