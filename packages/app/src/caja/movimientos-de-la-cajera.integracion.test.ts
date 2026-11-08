import { obtenerDb, repoCaja } from '@morphiqpos/data';
import type { Ambito } from '@morphiqpos/contracts';
import { beforeAll, describe, expect, it } from 'vitest';

import { comando } from '../produccion.ts';
import { abrirCajaReal, clave, exigirOk, sembrarCompanero } from '../pruebas/negocio-real.ts';
import { ambitoDeCaja, sembrarSalon, type Salon } from '../restaurante/pruebas/salon-real.ts';
import { registrarEntradaDeCambio } from './entrada-cambio.ts';
import { registrarMovimientoCaja } from './sesion.ts';

/**
 * DP-15 · LOS MOVIMIENTOS DE LA CAJERA (A1-B1), CONTRA POSTGRES REAL.
 *
 * Caja → «Movimientos» le da a la cajera el retiro y la entrada de cambio. Sus pruebas eran con una
 * base falsa, que no aplica las restricciones de la real (así se escondió que la entrada de cambio
 * no se podía guardar). Aquí, con el puesto de caja: el retiro resta del efectivo que el corte
 * espera y la entrada lo suma, cada uno con su motivo.
 */

const POR_COMANDOS = 120_000;
const FONDO = 50_000;

let salon: Salon;
let cajera: Ambito;
let sesionId = '';

beforeAll(async () => {
  salon = await sembrarSalon({ nombre: 'Fonda de la cajera', mesas: 1, terminales: 1 });
  const empleoId = await sembrarCompanero(salon.negocio, { nombre: 'La Cajera', rol: 'cajero' });
  cajera = { ...ambitoDeCaja(salon), rol: 'cajero', empleoId };
  sesionId = await abrirCajaReal(cajera, FONDO);
}, POR_COMANDOS);

const esperado = async (): Promise<bigint> =>
  (await repoCaja.arqueoDeSesion(obtenerDb(), cajera.organizacionId, sesionId))
    .efectivoEsperadoCentavos;

describe('la cajera, en Caja → Movimientos', () => {
  it(
    'el retiro resta del efectivo esperado y queda con su motivo',
    async () => {
      const antes = await esperado();
      exigirOk(
        await comando(registrarMovimientoCaja, {
          entrada: {
            tipo: 'retiro',
            montoCentavos: 20_000,
            motivo: 'pago al proveedor de tortillas',
          },
          ambito: cajera,
          idempotencyKey: clave(),
        }),
        'caja.movimiento',
      );
      expect(await esperado()).toBe(antes - 20_000n);
      const retiro = await obtenerDb()
        .selectFrom('movimientos_caja')
        .select(['monto_centavos', 'motivo'])
        .where('sesion_caja_id', '=', sesionId)
        .where('tipo', '=', 'retiro')
        .executeTakeFirstOrThrow();
      expect(retiro).toEqual({
        monto_centavos: -20_000n,
        motivo: 'pago al proveedor de tortillas',
      });
    },
    POR_COMANDOS,
  );

  it(
    'la entrada de cambio suma al efectivo esperado',
    async () => {
      const antes = await esperado();
      exigirOk(
        await comando(registrarEntradaDeCambio, {
          entrada: {
            monedasCentavos: 30_000,
            chicosCentavos: 0,
            origen: 'dueno',
            motivo: 'monedas',
          },
          ambito: cajera,
          idempotencyKey: clave(),
        }),
        'caja.entrada_cambio',
      );
      expect(await esperado()).toBe(antes + 30_000n);
    },
    POR_COMANDOS,
  );
});
