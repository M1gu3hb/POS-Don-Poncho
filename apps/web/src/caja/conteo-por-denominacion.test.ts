import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  DENOMINACIONES,
  denominacionesParaEnviar,
  piezasDe,
  sumaDelConteo,
} from './conteo-por-denominacion';

/**
 * DP-D178 · EL ARQUEO POR BILLETES Y MONEDAS al cerrar la caja.
 *
 * El servidor ya sabía recibir el conteo por denominación (`caja.cerrar`: `denominaciones`, que debe
 * sumar el efectivo contado) y el papel del corte ya lo imprime («Conteo por denominación»), pero el
 * diálogo de cierre sólo tenía un campo de total: nadie podía capturar el conteo. Aquí vive la
 * cuenta, sin pantalla.
 */
describe('DENOMINACIONES', () => {
  it('son las de México, de mayor a menor, y cada una va una sola vez (el servidor lo exige)', () => {
    const centavos = DENOMINACIONES.map((d) => d.centavos);
    expect(centavos).toEqual([
      100_000, 50_000, 20_000, 10_000, 5_000, 2_000, 1_000, 500, 200, 100, 50,
    ]);
    expect(new Set(centavos).size).toBe(centavos.length);
  });
});

describe('sumaDelConteo', () => {
  it('suma pieza por pieza, en centavos exactos', () => {
    expect(sumaDelConteo({ 50_000: 2, 2_000: 3, 100: 7, 50: 1 })).toBe(100_000 + 6_000 + 700 + 50);
  });

  it('un conteo vacío suma cero', () => {
    expect(sumaDelConteo({})).toBe(0);
  });

  it('ignora lo que no es una pieza válida (negativos, fracciones, NaN)', () => {
    expect(sumaDelConteo({ 10_000: -2, 5_000: 1.5, 2_000: Number.NaN, 1_000: 2 })).toBe(2_000);
  });
});

describe('denominacionesParaEnviar', () => {
  it('manda sólo las que tienen piezas, de mayor a menor', () => {
    expect(denominacionesParaEnviar({ 100: 4, 50_000: 1, 2_000: 0 })).toEqual([
      { denominacionCentavos: 50_000, piezas: 1 },
      { denominacionCentavos: 100, piezas: 4 },
    ]);
  });

  it('sin piezas, nada (el cierre sigue con el total tecleado)', () => {
    expect(denominacionesParaEnviar({})).toEqual([]);
  });

  it('su suma es exactamente la que dice sumaDelConteo (lo que el servidor compara)', () => {
    const piezas = { 20_000: 3, 500: 9, 50: 2 };
    const suma = denominacionesParaEnviar(piezas).reduce(
      (s, d) => s + d.denominacionCentavos * d.piezas,
      0,
    );
    expect(suma).toBe(sumaDelConteo(piezas));
  });
});

describe('piezasDe', () => {
  it('un texto de dígitos son las piezas; lo demás, cero', () => {
    expect(piezasDe('12')).toBe(12);
    expect(piezasDe('')).toBe(0);
    expect(piezasDe('abc')).toBe(0);
    expect(piezasDe('-3')).toBe(0);
    expect(piezasDe('2.5')).toBe(0);
  });

  it('con tope: más de 100 mil piezas es un error de dedo', () => {
    expect(piezasDe('999999')).toBe(100_000);
  });
});

describe('quién usa el conteo', () => {
  const WEB = join(__dirname, '..', '..');
  it('el diálogo de cierre lo ofrece y la Caja lo manda al servidor', () => {
    const dialogo = readFileSync(
      join(WEB, 'heredado/components/caja/CierreDiarioDialog.jsx'),
      'utf8',
    );
    expect(dialogo).toMatch(/from '~\/caja\/ConteoPorDenominacion'/);
    expect(dialogo).toMatch(/denominacionesParaEnviar\(/);
    const caja = readFileSync(join(WEB, 'heredado/pages/Caja.jsx'), 'utf8');
    expect(caja).toMatch(/denominaciones: form\.denominaciones/);
  });

  it('el campo de piezas se pone a la vista al enfocarlo (el teclado en pantalla tapa lo de abajo)', () => {
    const fila = readFileSync(join(__dirname, 'ConteoPorDenominacion.tsx'), 'utf8');
    expect(fila).toMatch(/onFocus=\{[\s\S]*?scrollIntoView\(\{\s*block: 'center'/);
  });
});
