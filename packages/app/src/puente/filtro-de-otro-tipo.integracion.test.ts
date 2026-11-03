import { ErrorDominio } from '@morphiqpos/contracts';
import { beforeAll, describe, expect, it } from 'vitest';

import {
  ambitoDe,
  sembrarNegocio,
  sembrarSucursal,
  type NegocioReal,
} from '../pruebas/negocio-real.ts';
import { consultar } from './consultar.ts';

/**
 * QA2-002 (DP-13.5) · UN FILTRO DEL TIPO EQUIVOCADO ES UNA ENTRADA MALA, NO UN 500.
 *
 * `/api/datos/consultar` con un id que no es uuid, un número que no es número o una fecha que no
 * es fecha llegaba a Postgres y volvía «error interno» (SQLSTATE de la clase 22). No es un fallo del
 * servidor: es la petición la que no tiene sentido, y se dice así.
 */

let negocio: NegocioReal;
let ambito: ReturnType<typeof ambitoDe>;

beforeAll(async () => {
  negocio = await sembrarNegocio({
    nombre: 'Fonda de los filtros',
    rol: 'dueno',
    giro: 'restaurante',
    paquete: 'restaurante',
  });
  const sucursal = await sembrarSucursal(negocio, { terminales: ['Caja 1'] });
  ambito = ambitoDe(negocio, sucursal.sucursalId, null);
});

describe('filtros que no son del tipo de su campo', () => {
  it.each([
    ['un id que no es uuid', { entidad: 'Mesa', operacion: 'get', id: 'no-uuid' }],
    [
      'un número que no es número',
      { entidad: 'Mesa', operacion: 'filter', filtro: { numero: 'abc' } },
    ],
  ] as const)('%s: un error de entrada, no un 500', async (_que, peticion) => {
    const intento = consultar(ambito, peticion);
    await expect(intento).rejects.toBeInstanceOf(ErrorDominio);
    await expect(intento).rejects.toMatchObject({ codigo: 'PUENTE_FILTRO_INVALIDO' });
  });

  it('el filtro bien formado sigue respondiendo', async () => {
    expect(
      await consultar(ambito, { entidad: 'Mesa', operacion: 'filter', filtro: { numero: 1 } }),
    ).toEqual([]);
  });
});
