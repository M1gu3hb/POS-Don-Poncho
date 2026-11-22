import { obtenerDb } from '@morphiqpos/data';
import { beforeAll, describe, expect, it } from 'vitest';

import { comando } from '../produccion.ts';
import { escribirDatos } from './comandos.ts';
import {
  ambitoDe,
  clave,
  exigirOk,
  sembrarNegocio,
  sembrarSucursal,
  type NegocioReal,
  type SucursalReal,
} from '../pruebas/negocio-real.ts';

/**
 * UN NÚMERO DE MESA REPETIDO SE DICE CON PALABRAS, contra Postgres (DP-25 · Parte 9).
 *
 * El dueño editaba el mapa en Configuración y, al crear o renombrar una mesa con un número que otra
 * mesa activa ya tiene, chocaba con el índice `mesas_numero_unico` (migración 183): el 23505 subía sin
 * traducir, `puente.escribir` respondía 500 y la pantalla decía «Algo falló». Ahora es un rechazo del
 * negocio con su código y el número que choca; con un número libre —o el de una mesa ya dada de
 * baja— todo pasa igual que antes.
 */

let negocio: NegocioReal;
let sucursal: SucursalReal;
let mesas: Readonly<Record<number, string>> = {};

const ambito = () => ambitoDe(negocio, sucursal.sucursalId, null);

beforeAll(async () => {
  negocio = await sembrarNegocio({
    nombre: 'Restaurante del número repetido',
    rol: 'gerente',
    giro: 'restaurante',
    paquete: 'restaurante',
  });
  sucursal = await sembrarSucursal(negocio, { terminales: [] });
  const filas = await obtenerDb()
    .insertInto('mesas')
    .values(
      [7, 8].map((numero) => ({
        organizacion_id: negocio.organizacionId,
        sucursal_id: sucursal.sucursalId,
        numero,
      })),
    )
    .returning(['id', 'numero'])
    .execute();
  mesas = Object.fromEntries(filas.map((f) => [f.numero, f.id]));
});

function escribir(entrada: Record<string, unknown>) {
  return comando(escribirDatos, {
    entrada: { entidad: 'Mesa', ...entrada },
    ambito: ambito(),
    idempotencyKey: clave(),
  });
}

async function activasConNumero(numero: number): Promise<number> {
  const filas = await obtenerDb()
    .selectFrom('mesas')
    .select('id')
    .where('organizacion_id', '=', negocio.organizacionId)
    .where('numero', '=', numero)
    .where('activa', '=', true)
    .execute();
  return filas.length;
}

describe('el número de una mesa activa no se repite', () => {
  it('crear una mesa con el número de otra activa: rechazo claro, sin segunda mesa', async () => {
    const salida = await escribir({ operacion: 'create', datos: { numero: 7, capacidad: 4 } });
    expect(salida.ok).toBe(false);
    if (salida.ok) return;
    expect(salida.error.datos?.['regla']).toBe('MESA_NUMERO_REPETIDO');
    expect(salida.error.mensaje).toBe('Ya hay una mesa activa con el número 7.');
    expect(await activasConNumero(7)).toBe(1);
  });

  it('editar una mesa al número de otra activa: rechazo claro y la mesa conserva el suyo', async () => {
    const salida = await escribir({
      operacion: 'update',
      id: mesas[8],
      datos: { numero: 7 },
    });
    expect(salida.ok).toBe(false);
    if (salida.ok) return;
    expect(salida.error.datos?.['regla']).toBe('MESA_NUMERO_REPETIDO');
    expect(salida.error.mensaje).toBe('Ya hay una mesa activa con el número 7.');
    const persistida = await obtenerDb()
      .selectFrom('mesas')
      .select('numero')
      .where('id', '=', mesas[8] ?? '')
      .executeTakeFirstOrThrow();
    expect(persistida.numero).toBe(8);
  });

  it('con un número libre se crea y se edita', async () => {
    const creada = exigirOk(
      await escribir({ operacion: 'create', datos: { numero: 9, capacidad: 2 } }),
      'puente.escribir (crear la mesa 9)',
    );
    expect(creada).toBeDefined();
    exigirOk(
      await escribir({ operacion: 'update', id: mesas[8], datos: { numero: 10 } }),
      'puente.escribir (la mesa 8 pasa a 10)',
    );
    expect(await activasConNumero(10)).toBe(1);
  });

  it('el número de una mesa dada de baja se puede volver a usar', async () => {
    exigirOk(
      await escribir({ operacion: 'delete', id: mesas[7] }),
      'puente.escribir (quitar la mesa 7)',
    );
    exigirOk(
      await escribir({ operacion: 'create', datos: { numero: 7, capacidad: 4 } }),
      'puente.escribir (crear otra mesa 7)',
    );
    expect(await activasConNumero(7)).toBe(1);
  });
});
