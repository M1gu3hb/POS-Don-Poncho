import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { MAPA } from '../../../../packages/app/src/puente/mapa.ts';

import { tiempoDeLaMesa } from './tiempo-de-la-mesa';

/**
 * DP-D177 · EL TIEMPO DE CADA MESA ABIERTA, EN EL PLANO DEL MESERO.
 *
 * La tesela de una mesa con cuenta dice cuánto lleva abierta («35 min»), con la hora de la cuenta
 * (`ordenes.created_at`, que el puente sirve como `abierta_desde`) y el mismo reloj de la pantalla
 * que usa la cocina. Una mesa libre o en limpieza no dice nada: no hay cuenta que medir.
 */

const AHORA = Date.parse('2026-11-18T20:00:00.000Z');
const haceMin = (m: number): string => new Date(AHORA - m * 60_000).toISOString();

describe('tiempoDeLaMesa', () => {
  it('dice los minutos completos desde que se abrió la cuenta', () => {
    const t = tiempoDeLaMesa(
      { estado: 'ocupada', venta_activa_id: 'v1', abierta_desde: haceMin(35) },
      AHORA,
    );
    expect(t?.minutos).toBe(35);
    expect(t?.texto).toBe('35 min');
    expect(t?.etiqueta).toBe('Abierta hace 35 min');
  });

  it('pasada la hora dice horas y minutos', () => {
    const t = tiempoDeLaMesa(
      { estado: 'cuenta_solicitada', venta_activa_id: 'v1', abierta_desde: haceMin(65) },
      AHORA,
    );
    expect(t?.texto).toBe('1 h 5 min');
  });

  it('recién abierta no dice «0 min»', () => {
    const t = tiempoDeLaMesa(
      { estado: 'esperando_orden', venta_activa_id: 'v1', abierta_desde: haceMin(0) },
      AHORA,
    );
    expect(t?.texto).toBe('< 1 min');
  });

  it('una mesa libre o en limpieza no lleva tiempo, aunque traiga una fecha vieja', () => {
    for (const estado of ['libre', 'limpieza', 'pagada', 'cancelada']) {
      expect(
        tiempoDeLaMesa({ estado, venta_activa_id: 'v-vieja', abierta_desde: haceMin(90) }, AHORA),
        estado,
      ).toBeNull();
    }
    expect(
      tiempoDeLaMesa(
        { estado: 'ocupada', venta_activa_id: null, abierta_desde: haceMin(9) },
        AHORA,
      ),
    ).toBeNull();
  });

  it('sin fecha legible o sin reloj no inventa un tiempo', () => {
    const base = { estado: 'ocupada', venta_activa_id: 'v1' };
    expect(tiempoDeLaMesa({ ...base, abierta_desde: null }, AHORA)).toBeNull();
    expect(tiempoDeLaMesa({ ...base, abierta_desde: 'ayer' }, AHORA)).toBeNull();
    expect(tiempoDeLaMesa({ ...base, abierta_desde: haceMin(5) }, 0)).toBeNull();
  });

  it('un reloj atrasado respecto de la cuenta no da minutos negativos', () => {
    const t = tiempoDeLaMesa(
      { estado: 'ocupada', venta_activa_id: 'v1', abierta_desde: haceMin(-3) },
      AHORA,
    );
    expect(t?.minutos).toBe(0);
  });
});

describe('de dónde sale la hora y quién la pinta', () => {
  it('el puente sirve abierta_desde, derivada de la cuenta activa de la mesa', () => {
    const campo = MAPA['Mesa']?.derivados?.['abierta_desde'];
    expect(campo).toMatchObject({
      tabla: 'ordenes',
      porColumna: 'orden_activa_id',
      columna: 'created_at',
      conversion: 'fecha',
    });
  });

  it('abierta_desde no se escribe (es un derivado) ni se publica al portal', () => {
    const campo = MAPA['Mesa']?.derivados?.['abierta_desde'];
    expect(campo?.publico).not.toBe(true);
  });

  const WEB = join(__dirname, '..', '..');
  for (const ruta of [
    'heredado/components/mesero/MesaGridMobile.jsx',
    'heredado/components/mesas/MesaShape.jsx',
  ]) {
    it(`${ruta} pinta el tiempo con TiempoDeLaMesa`, () => {
      const texto = readFileSync(join(WEB, ruta), 'utf8');
      expect(texto).toMatch(/from '~\/restaurante\/TiempoDeLaMesa'/);
      expect(texto).toMatch(/<TiempoDeLaMesa\b/);
    });
  }
});
