import { obtenerDb, repoCaja } from '@morphiqpos/data';
import { beforeAll, describe, expect, it } from 'vitest';

import { comando } from '../produccion.ts';
import { abrirCajaReal, clave, exigirOk } from '../pruebas/negocio-real.ts';
import { ambitoDeCaja, sembrarSalon, type Salon } from '../restaurante/pruebas/salon-real.ts';
import { registrarEntradaDeCambio } from './entrada-cambio.ts';

/**
 * DP-15 · LA ENTRADA DE CAMBIO, CONTRA POSTGRES REAL.
 *
 * La cajera la estrena en Caja → Movimientos, y aquí se descubrió que NUNCA se había podido
 * guardar: el movimiento llevaba `referencia_tipo = 'entrada_cambio'`, que la base no admite, y el
 * comando le sumaba la entrada al desglose del fondo de APERTURA, que la base exige que cuadre con
 * el fondo inicial. Las pruebas con la base falsa no lo veían.
 *
 * Además (la revisión de código): leía el fondo esperado y escribía el nuevo sin candado; con dos
 * entradas a la vez en el mismo cajón la segunda pisaba a la primera. Ahora suma la base.
 */

const POR_COMANDOS = 120_000;
const FONDO = 50_000;

let salon: Salon;
let otra: Salon;

const entrar = (
  s: Salon,
  monedasCentavos: number,
  chicosCentavos = 0,
  origen: 'banco' | 'caja_chica' | 'dueno' | 'otra_caja' = 'banco',
) =>
  comando(registrarEntradaDeCambio, {
    entrada: { monedasCentavos, chicosCentavos, origen, motivo: null },
    ambito: ambitoDeCaja(s),
    idempotencyKey: clave(),
  });

const sesionDe = (sesionId: string) =>
  obtenerDb()
    .selectFrom('sesiones_caja')
    .select([
      'organizacion_id',
      'fondo_inicial_centavos',
      'fondo_esperado_centavos',
      'fondo_monedas_centavos',
      'fondo_chicos_centavos',
      'fondo_grandes_centavos',
    ])
    .where('id', '=', sesionId)
    .executeTakeFirstOrThrow();

const entradasDe = (sesionId: string) =>
  obtenerDb()
    .selectFrom('movimientos_caja')
    .select(['tipo', 'monto_centavos', 'motivo'])
    .where('sesion_caja_id', '=', sesionId)
    .where('tipo', '=', 'entrada_cambio')
    .execute();

beforeAll(async () => {
  salon = await sembrarSalon({ nombre: 'Fonda del cambio', mesas: 1, terminales: 1 });
  otra = await sembrarSalon({ nombre: 'Fonda del cambio a la vez', mesas: 1, terminales: 1 });
}, POR_COMANDOS);

describe('caja.entrada_cambio', () => {
  it(
    'se guarda: el fondo esperado sube, el movimiento es suyo y dice de dónde salió el dinero',
    async () => {
      const sesionId = await abrirCajaReal(ambitoDeCaja(salon), FONDO);
      const alAbrir = await sesionDe(sesionId);
      const salida = exigirOk(await entrar(salon, 40_000, 20_000, 'caja_chica'), 'entrada');

      expect(salida.montoCentavos).toBe('60000');
      expect(salida.fondoEsperadoCentavos).toBe(String(FONDO + 60_000));
      const sesion = await sesionDe(sesionId);
      expect(sesion.fondo_esperado_centavos).toBe(BigInt(FONDO + 60_000));
      // El desglose de la APERTURA no se toca: sigue cuadrando con el fondo inicial.
      expect([
        sesion.fondo_monedas_centavos,
        sesion.fondo_chicos_centavos,
        sesion.fondo_grandes_centavos,
      ]).toEqual([
        alAbrir.fondo_monedas_centavos,
        alAbrir.fondo_chicos_centavos,
        alAbrir.fondo_grandes_centavos,
      ]);
      expect(sesion.fondo_inicial_centavos).toBe(BigInt(FONDO));

      const [movimiento] = await entradasDe(sesionId);
      expect(movimiento?.monto_centavos).toBe(60_000n);
      expect(movimiento?.motivo).toContain('caja_chica');

      // Y el efectivo que el corte espera la cuenta (sale de los movimientos del cajón).
      const arqueo = await repoCaja.arqueoDeSesion(obtenerDb(), sesion.organizacion_id, sesionId);
      expect(arqueo.efectivoEsperadoCentavos).toBe(BigInt(FONDO + 60_000));
    },
    POR_COMANDOS,
  );

  it(
    'varias a la vez en el mismo cajón: ninguna se pierde',
    async () => {
      const sesionId = await abrirCajaReal(ambitoDeCaja(otra), FONDO);
      const VECES = 6;
      const resultados = await Promise.all(
        Array.from({ length: VECES }, () => entrar(otra, 1_000)),
      );
      for (const r of resultados) exigirOk(r, 'entrada');

      expect((await sesionDe(sesionId)).fondo_esperado_centavos).toBe(
        BigInt(FONDO + VECES * 1_000),
      );
      expect(await entradasDe(sesionId)).toHaveLength(VECES);
    },
    POR_COMANDOS,
  );
});
