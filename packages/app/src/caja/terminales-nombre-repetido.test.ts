import { esErrorDominio, type Ambito } from '@morphiqpos/contracts';
import { describe, expect, it } from 'vitest';

import type { Transaccion } from '@morphiqpos/data';

import { contextoFalso } from '../restaurante/pruebas/base-falsa.ts';
import { nombrarTerminal } from './terminales.ts';

/**
 * DP-14 · ronda 2 (revisión) · DOS RENOMBRES A LA VEZ AL MISMO NOMBRE.
 *
 * Dos administradores llaman «Barra» a dos cajas distintas en el mismo instante: los dos pasan la
 * comprobación de que el nombre está libre (ninguno ve la fila aún sin confirmar del otro) y el
 * segundo choca con el índice `terminales_nombre_unico`. Eso es «ya hay otra caja con ese nombre»,
 * no un error interno: el comando lo dice con el mismo código que la comprobación de antes. Un
 * 23505 de OTRO índice sigue siendo lo que es.
 */

const ORG = '11111111-1111-4111-8111-111111111111';
const SUCURSAL = '22222222-2222-4222-8222-222222222222';
const TERMINAL = '33333333-3333-4333-8333-333333333333';

/** Una transacción falsa: la terminal existe, el nombre «está libre» y el update choca. */
function transaccionQueChoca(error: Error): Transaccion {
  let lecturas = 0;
  const cadena = (alFinal: () => Promise<unknown>): unknown =>
    new Proxy(
      {},
      {
        get: (_obj, prop) =>
          prop === 'execute' || prop === 'executeTakeFirst' ? alFinal : () => cadena(alFinal),
      },
    );
  const tx = {
    selectFrom: () =>
      cadena(() => {
        lecturas += 1;
        return Promise.resolve(lecturas === 1 ? { id: TERMINAL, nombre: 'Caja 2' } : undefined);
      }),
    updateTable: () => cadena(() => Promise.reject(error)),
  };
  return tx as unknown as Transaccion;
}

const ambito: Ambito = {
  organizacionId: ORG,
  sucursalId: SUCURSAL,
  terminalId: null,
  empleoId: '44444444-4444-4444-8444-444444444444',
  rol: 'administrador',
} as unknown as Ambito;

/** El error de `pg` de un índice único: un `Error` con su `code` y su `constraint`. */
const duplicado = (constraint: string): Error =>
  Object.assign(new Error('duplicate key value violates unique constraint'), {
    code: '23505',
    constraint,
  });

const nombrar = async (error: Error): Promise<unknown> => {
  const { ctx } = contextoFalso(transaccionQueChoca(error), ambito);
  try {
    await nombrarTerminal.ejecutar(ctx, { terminal: TERMINAL, nombre: 'Barra' });
    return null;
  } catch (atrapado: unknown) {
    return atrapado;
  }
};

describe('caja.nombrar_terminal con dos renombres a la vez', () => {
  it('el choque con terminales_nombre_unico es TERMINAL_NOMBRE_REPETIDO', async () => {
    const error = await nombrar(duplicado('terminales_nombre_unico'));
    expect(esErrorDominio(error) && error.codigo).toBe('TERMINAL_NOMBRE_REPETIDO');
  });

  it('un 23505 de otro índice no se disfraza', async () => {
    const otro = duplicado('otro_indice');
    expect(await nombrar(otro)).toBe(otro);
  });
});
