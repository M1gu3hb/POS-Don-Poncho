import type { Transaccion } from '@morphiqpos/data';
import { describe, expect, it } from 'vitest';

import { escribir } from './escribir.ts';

/**
 * DP-16 · EL FONDO DE LA TARJETA del menú digital sólo se guarda si es de la lista cerrada.
 *
 * El portal lo pinta con una clase (`data-fondo`), nunca como CSS; aun así, lo que no está en
 * `FONDOS_DE_TARJETA` no entra: un texto suelto en esa columna sería CSS escrito por alguien.
 */
const AMBITO = {
  organizacionId: '11111111-1111-4111-8111-111111111111',
  sucursalId: '22222222-2222-4222-8222-222222222222',
  rol: 'dueno',
} as const;

describe('ProductoTerminado.fondo_tarjeta', () => {
  it.each(['red; background:url(https://x)', 'ilustracion:otra', 'color:', ''])(
    'rechaza «%s»',
    async (fondo) => {
      await expect(
        escribir({} as Transaccion, AMBITO, {
          entidad: 'ProductoTerminado',
          operacion: 'create',
          datos: { fondo_tarjeta: fondo },
        }),
      ).rejects.toMatchObject({ codigo: 'PUENTE_CAMPO_INVALIDO' });
    },
  );

  it.each(['ilustracion:talavera', 'color:marca', null])(
    'acepta «%s» (pasa la validación y sigue a la base)',
    async (fondo) => {
      // La transacción falsa revienta al escribir: lo que importa es que NO fue la validación.
      const error: unknown = await escribir({} as Transaccion, AMBITO, {
        entidad: 'ProductoTerminado',
        operacion: 'create',
        datos: { fondo_tarjeta: fondo },
      }).catch((e: unknown) => e);
      expect(error).not.toMatchObject({ codigo: 'PUENTE_CAMPO_INVALIDO' });
    },
  );
});
