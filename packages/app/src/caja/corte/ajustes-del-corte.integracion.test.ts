import type { Ambito } from '@morphiqpos/contracts';
import { obtenerDb } from '@morphiqpos/data';
import { beforeAll, describe, expect, it } from 'vitest';

import { comando } from '../../produccion.ts';
import { abrirCajaReal, clave, exigirOk, sembrarCompanero } from '../../pruebas/negocio-real.ts';
import { ambitoDeCaja, sembrarSalon } from '../../restaurante/pruebas/salon-real.ts';
import { abrirCajon } from '../multiples.ts';
import { cerrarCaja, registrarMovimientoCaja } from '../sesion.ts';
import { hojaDelCorte } from './documento.ts';

/**
 * DP-15.1 · EL AJUSTE NO TAPA UN FALTANTE EN SILENCIO, CONTRA POSTGRES REAL.
 *
 * Un ajuste cambia lo que el corte ESPERA sin que haya pasado dinero. Si el corte sólo lo sumara al
 * «efectivo esperado», la diferencia de la noche saldría en cero y nadie sabría por qué. Así que el
 * corte lo enseña en un renglón aparte, con su motivo y con quién lo hizo; y la cajera, que es quien
 * cuenta el cajón, no puede hacerlo.
 */

const POR_COMANDOS = 120_000;
const FONDO = 50_000;

let cajera: Ambito;
let gerente: Ambito;
let sesionId = '';

beforeAll(async () => {
  const salon = await sembrarSalon({ nombre: 'Fonda de los ajustes', mesas: 1, terminales: 1 });
  const cajeraId = await sembrarCompanero(salon.negocio, { nombre: 'Lupe Cajera', rol: 'cajero' });
  const gerenteId = await sembrarCompanero(salon.negocio, {
    nombre: 'Rosa Gerente',
    rol: 'gerente',
  });
  cajera = { ...ambitoDeCaja(salon), rol: 'cajero', empleoId: cajeraId };
  gerente = { ...ambitoDeCaja(salon), rol: 'gerente', empleoId: gerenteId };
  sesionId = await abrirCajaReal(cajera, FONDO);
}, POR_COMANDOS);

const registrar = (
  ambito: Ambito,
  tipo: 'ajuste' | 'retiro' | 'gasto',
  centavos: number,
  motivo: string,
) =>
  comando(registrarMovimientoCaja, {
    entrada: { tipo, montoCentavos: centavos, motivo },
    ambito,
    idempotencyKey: clave(),
  });

const hoja = async (ambito: Ambito) =>
  exigirOk(
    await comando(hojaDelCorte, {
      entrada: { sesionCajaId: sesionId },
      ambito,
      idempotencyKey: clave(),
    }),
    'caja.hoja_del_corte',
  );

describe('los ajustes de caja en el corte', () => {
  it(
    'la cajera NO puede ajustar: el servidor se lo niega y no queda ningún movimiento',
    async () => {
      const resultado = await registrar(cajera, 'ajuste', 30_000, 'cuadrar la caja');
      expect(resultado.ok).toBe(false);
      if (resultado.ok) return;
      expect(resultado.error.datos?.['regla']).toBe('MOVIMIENTO_NO_PERMITIDO');
      const quedaron = await obtenerDb()
        .selectFrom('movimientos_caja')
        .select('id')
        .where('sesion_caja_id', '=', sesionId)
        .where('tipo', '=', 'ajuste')
        .execute();
      expect(quedaron).toEqual([]);
    },
    POR_COMANDOS,
  );

  it(
    'la gerente ajusta; el corte lo enseña aparte, con motivo y quién, y suma al esperado a la vista',
    async () => {
      const antes = await hoja(gerente);
      expect(antes.ajustes).toEqual([]);

      exigirOk(await registrar(gerente, 'ajuste', 7_500, 'sobró de ayer, ya contado'), 'ajuste +');
      exigirOk(await registrar(gerente, 'ajuste', -2_000, 'billete falso devuelto'), 'ajuste -');
      exigirOk(await registrar(cajera, 'retiro', -10_000, 'pago de hielo'), 'retiro');

      // Abrir el cajón sin venta también se anota como ajuste (de cero): sale en la lista con su
      // motivo y quién, pero no cambia lo que el corte espera.
      exigirOk(
        await comando(abrirCajon, {
          entrada: { sesionCajaId: sesionId, motivo: 'dar_cambio' },
          ambito: cajera,
          idempotencyKey: clave(),
        }),
        'caja.abrir_cajon',
      );

      const despues = await hoja(cajera);
      expect(despues.ajustes.map((a) => [a.montoCentavos, a.motivo, a.quien])).toEqual([
        ['7500', 'sobró de ayer, ya contado', 'Rosa Gerente'],
        ['-2000', 'billete falso devuelto', 'Rosa Gerente'],
        ['0', 'cajón abierto sin venta: dar_cambio', 'Lupe Cajera'],
      ]);
      // El retiro de la cajera no es un ajuste: no se cuela en el renglón.
      expect(despues.ajustes).toHaveLength(3);
      // Y el renglón agrupado de siempre dice cuánto pesan en el esperado.
      expect(despues.movimientos.find((m) => m.tipo === 'ajuste')).toMatchObject({
        montoCentavos: '5500',
        cuantos: 3,
      });
    },
    POR_COMANDOS,
  );

  it(
    'el corte cerrado conserva los ajustes con su detalle',
    async () => {
      exigirOk(
        await comando(cerrarCaja, {
          entrada: { efectivoContadoCentavos: FONDO + 5_500 - 10_000 },
          ambito: cajera,
          idempotencyKey: clave(),
        }),
        'caja.cerrar',
      );
      const cerrado = await hoja(gerente);
      expect(cerrado.ajustes).toHaveLength(3);
      expect(cerrado.ajustes.every((a) => a.motivo !== null && a.quien !== null)).toBe(true);
    },
    POR_COMANDOS,
  );
});
