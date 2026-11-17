import { conTransaccion, obtenerDb } from '@morphiqpos/data';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { comando } from '../produccion.ts';
import { abrirCajaReal, clave, exigirOk } from '../pruebas/negocio-real.ts';
import { guardarConfiguracionParcial } from '../puente/configuracion.ts';
import { fijarPropina } from '../propinas/fijar-propina.ts';
import { quienPuedeElegirEn } from '../propinas/una-sola-verdad.ts';

import { abrirYPedir, type FilaDeDinero } from './pruebas/flujo-de-dinero.ts';
import { SECRETO, sembrarMundo, type Mundo } from './pruebas/mundo.ts';

/**
 * DP-22 · FASE D · AJUSTES QUE SE PRUEBAN SOLOS (los que no tenían quién los demostrara).
 *
 * `propinas_activas`: «Apagado: no se ofrece propina en ningún lado». El servidor lo respeta en el
 * único comando que guarda la elección de la Caja (`cuenta.fijar_propina`) y en quién puede elegir.
 */

vi.mock('@morphiqpos/contracts', async (original) => ({
  ...(await original<typeof import('@morphiqpos/contracts')>()),
  validarEntorno: () => ({ SESSION_SECRET: SECRETO }),
}));

const FILA: FilaDeDinero = {
  iva: 'iva16_incluido',
  propina: 'ninguna',
  descuento: 'ninguno',
  division: 'sin_dividir',
  pago: 'efectivo_exacto',
  canal: 'mesa',
};

let mundo: Mundo;

beforeAll(async () => {
  mundo = await sembrarMundo({ nombre: 'Ajustes solos', mesas: 4, terminales: 1 });
  await abrirCajaReal(mundo.quienes(0).cajera, mundo.fondoCentavos);
}, 600_000);

async function propinasActivas(activas: boolean): Promise<void> {
  await conTransaccion((tx) =>
    guardarConfiguracionParcial(tx, mundo.salon.negocio.organizacionId, {
      propinas_activas: activas,
    }),
  );
}

describe('propinas_activas', () => {
  it(
    'apagado: nadie puede elegir la propina y la Caja no la guarda; encendido, la Caja sí',
    { timeout: 240_000 },
    async () => {
      const sinFalla = (texto: string): void => {
        throw new Error(texto);
      };
      const ordenId = await abrirYPedir(mundo, 0, 0, FILA, sinFalla);
      if (ordenId === null) throw new Error('Sin cuenta.');
      const version = async (): Promise<number> =>
        (
          await obtenerDb()
            .selectFrom('ordenes')
            .select('version')
            .where('id', '=', ordenId)
            .executeTakeFirstOrThrow()
        ).version;
      const fijar = async () =>
        comando(fijarPropina, {
          entrada: {
            ordenId,
            version: await version(),
            propinaTipo: 'porcentaje',
            propinaPuntosBase: 1000,
            cambiar: false,
          },
          ambito: mundo.quienes(0).cajera,
          idempotencyKey: clave(),
        });

      await propinasActivas(false);
      const valores = (
        await obtenerDb()
          .selectFrom('configuracion')
          .select('valores')
          .where('organizacion_id', '=', mundo.salon.negocio.organizacionId)
          .executeTakeFirstOrThrow()
      ).valores;
      expect(quienPuedeElegirEn(valores)).toEqual({
        comensales: false,
        mesero: false,
        caja: false,
      });
      expect((await fijar()).ok).toBe(false);

      await propinasActivas(true);
      exigirOk(await fijar(), 'cuenta.fijar_propina con las propinas encendidas');
    },
  );
});
