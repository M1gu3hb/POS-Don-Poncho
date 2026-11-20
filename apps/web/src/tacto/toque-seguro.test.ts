import { describe, expect, it } from 'vitest';

import {
  MS_PARA_MANTENER,
  REPOSO_MS,
  TOLERANCIA_PX,
  decidirToque,
  type EstadoDelBoton,
  type GestoMedido,
} from './toque-seguro';

const LIBRE: EstadoDelBoton = { ahora: 10_000, ultimoAgregado: null, enCurso: false };
const TOQUE: GestoMedido = {
  alejamientoPx: 0,
  desplazamientoPx: 0,
  duracionMs: 90,
  cancelado: false,
};
const con = (cambio: Partial<GestoMedido>): GestoMedido => ({ ...TOQUE, ...cambio });

describe('decidirToque · qué cuenta como tocar', () => {
  it('un toque quieto y corto agrega', () => {
    expect(decidirToque(TOQUE, LIBRE)).toEqual({ agrega: true, motivo: 'toque' });
  });

  it('usa la tolerancia de las pulsaciones del mesero: 10 px aún es tocar, 11 es deslizar', () => {
    expect(TOLERANCIA_PX).toBe(10);
    expect(decidirToque(con({ alejamientoPx: TOLERANCIA_PX }), LIBRE).agrega).toBe(true);
    expect(decidirToque(con({ alejamientoPx: TOLERANCIA_PX + 1 }), LIBRE)).toEqual({
      agrega: false,
      motivo: 'se-movio',
    });
  });

  it('arrastrar de 40 a 200 px no agrega, ni se mueva el dedo hacia arriba o hacia abajo', () => {
    for (const px of [40, 120, 200]) {
      expect(decidirToque(con({ alejamientoPx: px }), LIBRE).agrega).toBe(false);
    }
  });

  it('si algún contenedor se desplazó entre bajar y soltar, no agrega aunque el dedo vuelva', () => {
    expect(decidirToque(con({ desplazamientoPx: 1 }), LIBRE)).toEqual({
      agrega: false,
      motivo: 'se-desplazo',
    });
  });

  it('mantener presionado nunca agrega: 500 ms ya es mantener, 499 todavía es tocar', () => {
    expect(MS_PARA_MANTENER).toBe(500);
    expect(decidirToque(con({ duracionMs: MS_PARA_MANTENER - 1 }), LIBRE).agrega).toBe(true);
    expect(decidirToque(con({ duracionMs: MS_PARA_MANTENER }), LIBRE)).toEqual({
      agrega: false,
      motivo: 'mantenido',
    });
    expect(decidirToque(con({ duracionMs: 5_000 }), LIBRE).agrega).toBe(false);
  });

  it('un gesto que el navegador canceló (empezó a desplazar) no agrega', () => {
    expect(decidirToque(con({ cancelado: true }), LIBRE)).toEqual({
      agrega: false,
      motivo: 'cancelado',
    });
  });
});

describe('decidirToque · rebotes y acciones en curso', () => {
  it('un segundo agregado en menos de 350 ms se ignora; a los 350 ya cuenta', () => {
    expect(REPOSO_MS).toBe(350);
    const hace = (ms: number): EstadoDelBoton => ({ ...LIBRE, ultimoAgregado: LIBRE.ahora - ms });
    expect(decidirToque(TOQUE, hace(REPOSO_MS - 1))).toEqual({ agrega: false, motivo: 'repetido' });
    expect(decidirToque(TOQUE, hace(REPOSO_MS)).agrega).toBe(true);
  });

  it('el reposo se puede acortar (los + y – del pedido)', () => {
    const estado: EstadoDelBoton = { ...LIBRE, ultimoAgregado: LIBRE.ahora - 200 };
    expect(decidirToque(TOQUE, estado).agrega).toBe(false);
    expect(decidirToque(TOQUE, estado, { reposoMs: 150 }).agrega).toBe(true);
  });

  it('mientras la acción de ese botón se resuelve, no entra otro toque', () => {
    expect(decidirToque(TOQUE, { ...LIBRE, enCurso: true })).toEqual({
      agrega: false,
      motivo: 'en-curso',
    });
  });

  it('lo que la acción en curso manda sobre todo lo demás', () => {
    expect(decidirToque(con({ alejamientoPx: 99 }), { ...LIBRE, enCurso: true }).motivo).toBe(
      'en-curso',
    );
  });
});

describe('decidirToque · teclado y programático', () => {
  it('sin gesto de puntero (Enter, Espacio, lector de pantalla) agrega', () => {
    expect(decidirToque(null, LIBRE)).toEqual({ agrega: true, motivo: 'toque' });
  });

  it('el teclado también respeta el reposo y la acción en curso', () => {
    expect(decidirToque(null, { ...LIBRE, ultimoAgregado: LIBRE.ahora - 10 }).motivo).toBe(
      'repetido',
    );
    expect(decidirToque(null, { ...LIBRE, enCurso: true }).motivo).toBe('en-curso');
  });
});
