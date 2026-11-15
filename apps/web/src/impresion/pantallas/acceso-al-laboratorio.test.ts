import { describe, expect, it } from 'vitest';

import {
  AVISO_DEL_LABORATORIO,
  horaDeVencimiento,
  textoDeLaSesion,
} from './acceso-al-laboratorio.ts';

describe('DP-20 · la entrada al laboratorio', () => {
  it('el aviso dice quién puede entrar', () => {
    expect(AVISO_DEL_LABORATORIO).toBe('Sólo tu proveedor MORPHIQ puede entrar aquí');
  });

  it('el permiso vence a la hora de México', () => {
    expect(horaDeVencimiento('2026-11-14T22:30:00.000Z')).toBe('16:30');
    expect(horaDeVencimiento('2026-11-15T01:05:00.000Z')).toBe('19:05');
  });

  it('sin fecha o con una fecha que no se entiende, no inventa la hora', () => {
    expect(horaDeVencimiento(null)).toBe('');
    expect(horaDeVencimiento('mañana')).toBe('');
  });

  it('la sesión dice cuándo vence', () => {
    expect(
      textoDeLaSesion({ dentro: true, vence: '2026-11-14T22:30:00.000Z', configurado: true }),
    ).toBe('Permiso vigente · vence a las 16:30');
    expect(textoDeLaSesion({ dentro: true, vence: null, configurado: true })).toBe(
      'Permiso vigente',
    );
  });
});
