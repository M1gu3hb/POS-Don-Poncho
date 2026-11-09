import type { Rol } from '@morphiqpos/contracts';
import { describe, expect, it } from 'vitest';

import { contextoFalso, crearBaseFalsa } from '../restaurante/pruebas/base-falsa.ts';
import { ambitoDe, PREDETERMINADOS, sesionCajaAbierta } from '../restaurante/pruebas/sala.ts';
import { entradaMovimientoCaja } from '../venta/esquemas.ts';
import { registrarMovimientoCaja } from './sesion.ts';

/**
 * `caja.movimiento` · el signo de lo que entra y sale del cajón a mano (auditoría 2.4).
 *
 * El esquema acepta un AJUSTE negativo —«un ajuste a la baja lo es»— y el comando le
 * quitaba el signo con `Math.abs`: todo ajuste sumaba al cajón.
 */

const AHORA = new Date('2026-09-26T20:00:00.000Z');

function baseDe() {
  return crearBaseFalsa(
    { sesiones_caja: [sesionCajaAbierta()], movimientos_caja: [] },
    { predeterminados: PREDETERMINADOS },
  );
}

type Tipo = 'gasto' | 'retiro' | 'deposito' | 'ajuste';

async function registrar(tipo: Tipo, monto: number, rol: Rol = 'gerente') {
  const base = baseDe();
  const { ctx } = contextoFalso(base.tx, ambitoDe(rol), AHORA);
  await registrarMovimientoCaja.ejecutar(ctx, { tipo, montoCentavos: monto, motivo: 'prueba' });
  return base.campo('movimientos_caja', 'monto_centavos');
}

describe('caja.movimiento', () => {
  it('el AJUSTE a la baja resta; el ajuste al alza suma', async () => {
    expect(await registrar('ajuste', -2_500)).toBe(-2_500n);
    expect(await registrar('ajuste', 2_500)).toBe(2_500n);
  });

  it('gasto y retiro salen; depósito entra, venga el signo como venga', async () => {
    expect(await registrar('gasto', 1_000)).toBe(-1_000n);
    expect(await registrar('retiro', -1_000)).toBe(-1_000n);
    expect(await registrar('deposito', -1_000)).toBe(1_000n);
  });
});

/**
 * DP-15.1 · Quién puede mover qué del cajón.
 *
 * La cajera saca un retiro (el dinero que sale del cajón con explicación) y mete cambio (otro
 * comando). El gasto, el depósito y el AJUSTE son de quien responde por la caja: un ajuste es el
 * único movimiento que cambia lo que el corte espera sin que haya pasado dinero de verdad, y en
 * manos de quien cuenta el cajón es la forma de tapar su propio faltante. La regla vive en el
 * servidor; esconder el botón no la cumple.
 */
describe('caja.movimiento · por rol', () => {
  it('la cajera hace su retiro', async () => {
    expect(await registrar('retiro', -1_000, 'cajero')).toBe(-1_000n);
  });

  it.each(['gasto', 'deposito', 'ajuste'] as const)(
    'la cajera NO puede registrar un %s: MOVIMIENTO_NO_PERMITIDO y no queda nada',
    async (tipo) => {
      const base = baseDe();
      const { ctx } = contextoFalso(base.tx, ambitoDe('cajero'), AHORA);
      await expect(
        registrarMovimientoCaja.ejecutar(ctx, {
          tipo,
          montoCentavos: 1_000,
          motivo: 'por si acaso',
        }),
      ).rejects.toMatchObject({ codigo: 'MOVIMIENTO_NO_PERMITIDO' });
      expect(base.campo('movimientos_caja', 'monto_centavos')).toBeNull();
    },
  );

  it.each(['gerente', 'administrador', 'dueno'] as const)(
    '%s sí puede registrar los cuatro tipos',
    async (rol) => {
      for (const tipo of ['gasto', 'retiro', 'deposito', 'ajuste'] as const) {
        expect(await registrar(tipo, 1_000, rol), `${rol} ${tipo}`).not.toBeNull();
      }
    },
  );
});

describe('caja.movimiento · el motivo', () => {
  const parsear = (tipo: Tipo, motivo: string) =>
    entradaMovimientoCaja.safeParse({ tipo, montoCentavos: -1_000, motivo });

  it('el retiro pide al menos 5 caracteres que no sean espacios', () => {
    expect(parsear('retiro', 'gas').success).toBe(false);
    expect(parsear('retiro', 'hielo').success).toBe(true);
    expect(parsear('retiro', '  abc  ').success, 'los espacios no cuentan').toBe(false);
    expect(parsear('retiro', '     ').success).toBe(false);
  });

  it('el mensaje del retiro corto dice qué escribir', () => {
    const resultado = parsear('retiro', 'gas');
    expect(resultado.success).toBe(false);
    if (!resultado.success) {
      expect(resultado.error.issues[0]?.message).toBe(
        'Escribe a dónde va ese dinero: al menos 5 letras.',
      );
    }
  });

  it('el ajuste SIEMPRE lleva motivo, y un motivo de puros espacios no es motivo', () => {
    expect(parsear('ajuste', '').success).toBe(false);
    expect(parsear('ajuste', '      ').success).toBe(false);
    expect(parsear('ajuste', 'sobró de ayer').success).toBe(true);
  });

  it('el motivo se guarda recortado', () => {
    const resultado = parsear('retiro', '  pago de hielo  ');
    expect(resultado.success && resultado.data.motivo).toBe('pago de hielo');
  });
});
