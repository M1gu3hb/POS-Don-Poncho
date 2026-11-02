import { describe, expect, it } from 'vitest';

import {
  avisoDePerdidaAlCancelar,
  descripcionDelRenglon,
  platillosQuitables,
  type DetalleDeLaCuenta,
} from './cancelar-del-mesero.ts';

/**
 * DP-12.4 · Lo que el mesero ve al quitar un platillo o cancelar la cuenta.
 */

const SOPA: DetalleDeLaCuenta = { id: 'l-1', producto_nombre: 'Sopa de fideo', cantidad: '1.0000' };
const ARRACHERA: DetalleDeLaCuenta = {
  id: 'l-2',
  producto_nombre: 'Arrachera',
  cantidad: '2.0000',
};

describe('qué platillos ya salieron de cocina', () => {
  it('marca los que cocina dejó listos o entregados, y sólo ésos', () => {
    const salieron = new Set(['Arrachera']);
    expect(platillosQuitables([SOPA, ARRACHERA], salieron).map((p) => p.yaSePreparo)).toEqual([
      false,
      true,
    ]);
  });

  it('sin lectura de cocina no se inventa nada: ninguno se marca', () => {
    expect(platillosQuitables([SOPA, ARRACHERA], new Set()).every((p) => !p.yaSePreparo)).toBe(
      true,
    );
  });
});

describe('el aviso de pérdida al cancelar la cuenta', () => {
  it('sin nada preparado no se dice nada: un aviso que siempre sale deja de leerse', () => {
    expect(avisoDePerdidaAlCancelar([SOPA, ARRACHERA], new Set())).toBeNull();
  });

  it('con algo preparado nombra qué y dice que queda como pérdida', () => {
    const aviso = avisoDePerdidaAlCancelar([SOPA, ARRACHERA], new Set(['Arrachera']));
    expect(aviso).toContain('Arrachera');
    expect(aviso).not.toContain('Sopa');
    expect(aviso).toMatch(/pérdida/);
  });

  it('un platillo repetido en dos renglones se nombra una vez', () => {
    const otra: DetalleDeLaCuenta = { ...ARRACHERA, id: 'l-3' };
    const aviso = avisoDePerdidaAlCancelar([ARRACHERA, otra], new Set(['Arrachera']));
    expect(aviso?.match(/Arrachera/g)).toHaveLength(1);
  });
});

describe('cómo se nombra el renglón', () => {
  it('una pieza, sólo el nombre; varias, con la cantidad sin ceros de relleno', () => {
    expect(descripcionDelRenglon(SOPA)).toBe('Sopa de fideo');
    expect(descripcionDelRenglon(ARRACHERA)).toBe('2 × Arrachera');
  });
});
