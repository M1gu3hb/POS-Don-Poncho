import { afterEach, describe, expect, it, vi } from 'vitest';

import { avisoDeLoCortado, type CancelacionDelCorte } from './cancelaciones.ts';
import { cancelacionesDeLaCaja } from './cancelaciones-leidas.ts';
import { filtrarCancelaciones } from './filtrar-cancelaciones.ts';

/**
 * DP-12.4 · Registros y el corte heredado leen las cancelaciones del servidor, y Registros las
 * filtra por lo que el dueño busca. La lectura no adivina: una respuesta rara es un error.
 */

const fila = (cambios: Partial<CancelacionDelCorte>): CancelacionDelCorte => ({
  tipo: 'orden',
  folio: null,
  hora: '2026-10-31T20:00:00.000Z',
  usuario: 'Lupita',
  motivo: 'Se fueron sin pagar',
  producto: null,
  montoCentavos: '45000',
  mesa: 'Mesa 6',
  perdidaCentavos: '0',
  perdida: false,
  ...cambios,
});

const FILAS = [
  fila({ mesa: 'Mesa 6', perdidaCentavos: '45000', perdida: true }),
  fila({ tipo: 'linea', mesa: 'Mesa 5', producto: 'Sopa de tortilla', usuario: 'Beatriz' }),
];

describe('Registros · qué cancelaciones se enseñan', () => {
  it('sin búsqueda ni interruptor, todas', () => {
    expect(filtrarCancelaciones(FILAS, { busqueda: '', soloPerdidas: false })).toHaveLength(2);
  });

  it('«sólo pérdidas» deja las que ya estaban preparadas', () => {
    const solo = filtrarCancelaciones(FILAS, { busqueda: '', soloPerdidas: true });
    expect(solo.map((c) => c.mesa)).toEqual(['Mesa 6']);
  });

  it('busca por mesa, platillo o quién canceló, sin acentos ni mayúsculas', () => {
    expect(filtrarCancelaciones(FILAS, { busqueda: 'mesa 5', soloPerdidas: false })).toHaveLength(
      1,
    );
    expect(filtrarCancelaciones(FILAS, { busqueda: 'TORTILLA', soloPerdidas: false })).toHaveLength(
      1,
    );
    expect(filtrarCancelaciones(FILAS, { busqueda: 'beatríz', soloPerdidas: false })).toHaveLength(
      1,
    );
    expect(filtrarCancelaciones(FILAS, { busqueda: 'nadie', soloPerdidas: false })).toHaveLength(0);
  });
});

describe('la lectura del servidor', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function servidorResponde(cuerpo: unknown): void {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ ok: true, datos: cuerpo }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        ),
      ),
    );
  }

  it('devuelve las filas tal como las manda el servidor, con su alcance (DP-13.2)', async () => {
    servidorResponde({ cancelaciones: FILAS, alcance: 'dia' });
    expect(await cancelacionesDeLaCaja('s-1')).toEqual({ filas: FILAS, alcance: 'dia' });
  });

  it('sin el alcance (caja o día) tampoco se adivina', async () => {
    servidorResponde({ cancelaciones: FILAS });
    await expect(cancelacionesDeLaCaja('s-1')).rejects.toThrow(/forma esperada/);
  });

  it('una respuesta sin la lista, o con filas que no son cancelaciones, NO se toma por «ninguna»', async () => {
    servidorResponde({});
    await expect(cancelacionesDeLaCaja('s-1')).rejects.toThrow(/forma esperada/);
    servidorResponde({ cancelaciones: [{ tipo: 'otra' }] });
    await expect(cancelacionesDeLaCaja('s-1')).rejects.toThrow(/forma esperada/);
    // DP-13.2 · sin el valor de la pérdida tampoco: el corte no adivina cuánto se perdió.
    const sinPerdida = Object.fromEntries(
      Object.entries(fila({})).filter(([clave]) => clave !== 'perdidaCentavos'),
    );
    servidorResponde({ cancelaciones: [sinPerdida] });
    await expect(cancelacionesDeLaCaja('s-1')).rejects.toThrow(/forma esperada/);
  });
});

describe('DP-14.6 · la lista cortada se dice, con el total completo', () => {
  const fila = {
    tipo: 'orden' as const,
    folio: null,
    hora: null,
    usuario: 'Rosa',
    motivo: 'x',
    producto: null,
    montoCentavos: '1000',
    mesa: 'Mesa 1',
    perdidaCentavos: '0',
    perdida: false,
  };

  it('si llegaron menos filas que las del corte, las tablas avisan cuántas hay de verdad', () => {
    const aviso = avisoDeLoCortado([fila], {
      cuantas: 501,
      montoCentavos: '501000',
      perdidaCentavos: '0',
    });
    expect(aviso).toContain('sólo se muestran 1 de 501');
    expect(aviso).toContain('5,010.00');
  });

  it('si cupieron todas, no dice nada', () => {
    expect(
      avisoDeLoCortado([fila], { cuantas: 1, montoCentavos: '1000', perdidaCentavos: '0' }),
    ).toBe('');
    expect(avisoDeLoCortado([fila], undefined)).toBe('');
  });
});
