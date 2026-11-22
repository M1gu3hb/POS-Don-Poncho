import { describe, expect, it } from 'vitest';

import {
  accionesDe,
  avisoDeVisibilidad,
  cambioDe,
  textoDeDondeSeVe,
  visibilidadDe,
} from './donde-se-ve';

/** DP-25 · Parte 8 · DP-D227 · Dónde se ve cada platillo y qué se puede ocultar o mostrar. */

describe('visibilidadDe', () => {
  it('lo que no dice nada se ve en los dos lugares', () => {
    expect(visibilidadDe({})).toEqual({ portal: true, pos: true });
    expect(visibilidadDe({ visible_en_menu_digital: null, visible_en_pos: null })).toEqual({
      portal: true,
      pos: true,
    });
  });

  it('cada lugar se lee de su columna, por separado', () => {
    expect(visibilidadDe({ visible_en_menu_digital: false, visible_en_pos: true })).toEqual({
      portal: false,
      pos: true,
    });
    expect(visibilidadDe({ visible_en_menu_digital: true, visible_en_pos: false })).toEqual({
      portal: true,
      pos: false,
    });
  });
});

describe('textoDeDondeSeVe', () => {
  it.each([
    [{ portal: true, pos: true }, 'Se ve en: POS y portal QR'],
    [{ portal: false, pos: true }, 'Se ve en: POS'],
    [{ portal: true, pos: false }, 'Se ve en: portal QR'],
    [{ portal: false, pos: false }, 'Oculto en todo'],
  ])('%j → %s', (visibilidad, texto) => {
    expect(textoDeDondeSeVe(visibilidad)).toBe(texto);
  });
});

describe('accionesDe', () => {
  const textos = (portal: boolean, pos: boolean) => accionesDe({ portal, pos }).map((a) => a.texto);

  it('visible en todo: se oculta de uno o de todo', () => {
    expect(textos(true, true)).toEqual([
      'Ocultar del portal QR',
      'Ocultar del POS (mesero y Caja)',
      'Ocultar de todo',
    ]);
  });

  it('oculto del POS: se muestra ahí, se oculta del portal o se oculta de todo', () => {
    expect(textos(true, false)).toEqual([
      'Ocultar del portal QR',
      'Mostrar en el POS (mesero y Caja)',
      'Ocultar de todo',
    ]);
  });

  it('oculto del portal: se muestra ahí, se oculta del POS o se oculta de todo', () => {
    expect(textos(false, true)).toEqual([
      'Mostrar en el portal QR',
      'Ocultar del POS (mesero y Caja)',
      'Ocultar de todo',
    ]);
  });

  it('oculto en todo: se muestra en uno o en todo', () => {
    expect(textos(false, false)).toEqual([
      'Mostrar en el portal QR',
      'Mostrar en el POS (mesero y Caja)',
      'Mostrar en todo',
    ]);
  });
});

describe('cambioDe', () => {
  it('manda al comando sólo lo que cambia, cada lugar con su campo', () => {
    expect(cambioDe('ocultar-portal')).toEqual({ visible: false });
    expect(cambioDe('mostrar-portal')).toEqual({ visible: true });
    expect(cambioDe('ocultar-pos')).toEqual({ visibleEnPos: false });
    expect(cambioDe('mostrar-pos')).toEqual({ visibleEnPos: true });
    expect(cambioDe('ocultar-todo')).toEqual({ visible: false, visibleEnPos: false });
    expect(cambioDe('mostrar-todo')).toEqual({ visible: true, visibleEnPos: true });
  });
});

describe('avisoDeVisibilidad', () => {
  it('dice el platillo y dónde quedó', () => {
    expect(avisoDeVisibilidad('Flan', { portal: true, pos: false })).toBe(
      '«Flan» · Se ve en: portal QR',
    );
    expect(avisoDeVisibilidad('Flan', { portal: false, pos: false })).toBe(
      '«Flan» · Oculto en todo',
    );
  });
});
