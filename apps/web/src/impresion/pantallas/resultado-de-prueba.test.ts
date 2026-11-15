import { describe, expect, it } from 'vitest';

import type { Resultado } from '../puente/contrato.ts';
import {
  conMiles,
  resultadoDeUnError,
  resultadoDelFin,
  resultadoDelPuente,
  textoDeMedidas,
} from './resultado-de-prueba.ts';

const base: Resultado = { ok: true, id: 'lab-1', estado: 'impreso' };

describe('DP-20 · lo que dice una prueba al terminar', () => {
  it('los miles se separan con coma sin depender del idioma', () => {
    expect(conMiles(4321)).toBe('4,321');
    expect(conMiles(1234567.4)).toBe('1,234,567');
    expect(conMiles(12)).toBe('12');
  });

  it('las medidas dicen ms y bytes', () => {
    expect(textoDeMedidas({ ms: 120, bytes: 4321 })).toBe(' · 120 ms · 4,321 bytes');
    expect(textoDeMedidas({})).toBe('');
  });

  it('impreso y enviado se distinguen', () => {
    expect(resultadoDelPuente(base)).toEqual({ ok: true, texto: 'Impreso ✓' });
    expect(resultadoDelPuente({ ...base, estado: 'enviado' }).texto).toBe('Enviado ✓');
    expect(resultadoDelPuente({ ...base, estado: 'duplicado' }).texto).toBe(
      'Enviado ✓ (la app ya lo tenía)',
    );
  });

  it('suma las medidas propias; si faltan, usa las de la app', () => {
    expect(resultadoDelPuente(base, { ms: 900, bytes: 50_000 }).texto).toBe(
      'Impreso ✓ · 900 ms · 50,000 bytes',
    );
    expect(resultadoDelPuente({ ...base, ms: 40, bytes: 10 }).texto).toBe(
      'Impreso ✓ · 40 ms · 10 bytes',
    );
  });

  it('un fallo dice qué pasó y qué hacer', () => {
    const resultado = resultadoDelPuente({
      ...base,
      ok: false,
      estado: 'error',
      codigo: 'SIN_PAPEL',
    });
    expect(resultado).toEqual({
      ok: false,
      texto: 'Sin papel. Pon un rollo nuevo y reintenta.',
    });
  });

  it('un fallo desconocido dice el mensaje de la app', () => {
    const resultado = resultadoDelPuente({
      ...base,
      ok: false,
      estado: 'error',
      mensaje: 'El puerto está ocupado',
    });
    expect(resultado.ok).toBe(false);
    expect(resultado.texto).toContain('El puerto está ocupado');
  });

  it('el fin de un trabajo del navegador a la app dice lo mismo', () => {
    expect(resultadoDelFin({ ok: true, estado: 'impreso' }, { ms: 5 }).texto).toBe(
      'Impreso ✓ · 5 ms',
    );
    expect(resultadoDelFin({ ok: true, estado: 'enviado' }).texto).toBe('Enviado ✓');
    const fallo = resultadoDelFin({
      ok: false,
      fallo: { codigo: 'TAPA_ABIERTA', titulo: 'Tapa abierta', queHacer: 'Ciérrala.' },
    });
    expect(fallo).toEqual({ ok: false, texto: 'Tapa abierta. Ciérrala.' });
  });

  it('un error inesperado se dice, no se calla', () => {
    expect(resultadoDeUnError(new Error('El documento salió vacío.'))).toEqual({
      ok: false,
      texto: 'El documento salió vacío.',
    });
    expect(resultadoDeUnError('algo').texto).toBe(
      'La prueba falló por algo inesperado. Reintenta.',
    );
  });
});
