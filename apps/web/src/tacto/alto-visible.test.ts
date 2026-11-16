import { describe, expect, it, vi } from 'vitest';

import {
  ATRIBUTO_DEL_TECLADO,
  UMBRAL_DEL_TECLADO_PX,
  VARIABLE_DEL_ALTO,
  altoVisible,
  hayTecladoEnPantalla,
  montarAltoVisible,
  type VentanaConAlto,
} from './alto-visible';

function visualFalso(height: number) {
  const oyentes = new Map<string, () => void>();
  return {
    height,
    addEventListener: (tipo: string, oyente: () => void) => oyentes.set(tipo, oyente),
    removeEventListener: (tipo: string) => oyentes.delete(tipo),
    emitir: (tipo: string) => oyentes.get(tipo)?.(),
    oyentes,
  };
}

function ventanaFalsa(innerHeight: number, visual: ReturnType<typeof visualFalso> | null) {
  const oyentes = new Map<string, () => void>();
  const ventana: VentanaConAlto = {
    innerHeight,
    visualViewport: visual,
    addEventListener: (tipo, oyente) => {
      oyentes.set(tipo, oyente);
    },
    removeEventListener: (tipo) => {
      oyentes.delete(tipo);
    },
  };
  return { ventana, oyentes };
}

function raizFalsa() {
  const valores = new Map<string, string>();
  const atributos = new Set<string>();
  return {
    valores,
    atributos,
    style: {
      setProperty: (n: string, v: string) => valores.set(n, v),
      removeProperty: (n: string) => valores.delete(n),
    },
    setAttribute: (n: string) => atributos.add(n),
    removeAttribute: (n: string) => atributos.delete(n),
  };
}

describe('el alto que de verdad se ve', () => {
  it('es el del visualViewport: con el teclado en pantalla es menor que el de la ventana', () => {
    expect(altoVisible({ innerHeight: 800, visualViewport: { height: 480 } })).toBe(480);
  });

  it('sin visualViewport, el de la ventana (motores viejos)', () => {
    expect(altoVisible({ innerHeight: 800, visualViewport: null })).toBe(800);
    expect(altoVisible({ innerHeight: 800 })).toBe(800);
  });

  it('un visualViewport sin alto utilizable no manda: vuelve al de la ventana', () => {
    expect(altoVisible({ innerHeight: 800, visualViewport: { height: 0 } })).toBe(800);
    expect(altoVisible({ innerHeight: 800, visualViewport: { height: Number.NaN } })).toBe(800);
  });
});

describe('--alto-visible en la raíz', () => {
  it('se escribe al montar, redondeado y en px', () => {
    const visual = visualFalso(479.6);
    const { ventana } = ventanaFalsa(800, visual);
    const raiz = raizFalsa();
    montarAltoVisible(ventana, raiz);
    expect(raiz.valores.get(VARIABLE_DEL_ALTO)).toBe('480px');
  });

  it('se actualiza con `resize` del visualViewport (el teclado sube y baja)', () => {
    const visual = visualFalso(800);
    const { ventana } = ventanaFalsa(800, visual);
    const raiz = raizFalsa();
    montarAltoVisible(ventana, raiz);
    visual.height = 500;
    visual.emitir('resize');
    expect(raiz.valores.get(VARIABLE_DEL_ALTO)).toBe('500px');
    visual.height = 800;
    visual.emitir('resize');
    expect(raiz.valores.get(VARIABLE_DEL_ALTO)).toBe('800px');
  });

  it('sin visualViewport escucha el `resize` de la ventana', () => {
    const { ventana, oyentes } = ventanaFalsa(800, null);
    const raiz = raizFalsa();
    montarAltoVisible(ventana, raiz);
    expect(oyentes.has('resize')).toBe(true);
    (ventana as { innerHeight: number }).innerHeight = 600;
    oyentes.get('resize')?.();
    expect(raiz.valores.get(VARIABLE_DEL_ALTO)).toBe('600px');
  });

  it('al desmontar quita la variable y los oyentes', () => {
    const visual = visualFalso(700);
    const { ventana, oyentes } = ventanaFalsa(800, visual);
    const raiz = raizFalsa();
    const desmontar = montarAltoVisible(ventana, raiz);
    desmontar();
    expect(raiz.valores.has(VARIABLE_DEL_ALTO)).toBe(false);
    expect(visual.oyentes.size).toBe(0);
    expect(oyentes.size).toBe(0);
  });

  it('no escribe dos veces el mismo valor', () => {
    const visual = visualFalso(700);
    const { ventana } = ventanaFalsa(800, visual);
    const escribir = vi.fn();
    const raiz = {
      style: { setProperty: escribir, removeProperty: vi.fn() },
      setAttribute: vi.fn(),
      removeAttribute: vi.fn(),
    };
    montarAltoVisible(ventana, raiz);
    visual.emitir('resize');
    visual.emitir('resize');
    expect(escribir).toHaveBeenCalledTimes(1);
  });
});

describe('el teclado en pantalla, como marca del <html>', () => {
  it('hay teclado cuando el visualViewport es bastante más bajo que la ventana', () => {
    expect(
      hayTecladoEnPantalla({
        innerHeight: 800,
        visualViewport: { height: 800 - UMBRAL_DEL_TECLADO_PX },
      }),
    ).toBe(true);
    expect(hayTecladoEnPantalla({ innerHeight: 800, visualViewport: { height: 480 } })).toBe(true);
  });

  it('una barra del navegador que se esconde (pocos píxeles) no es un teclado', () => {
    expect(
      hayTecladoEnPantalla({
        innerHeight: 800,
        visualViewport: { height: 800 - UMBRAL_DEL_TECLADO_PX + 1 },
      }),
    ).toBe(false);
    expect(hayTecladoEnPantalla({ innerHeight: 800, visualViewport: { height: 800 } })).toBe(false);
  });

  it('sin visualViewport no se puede saber: no hay marca', () => {
    expect(hayTecladoEnPantalla({ innerHeight: 800, visualViewport: null })).toBe(false);
  });

  it('se pone y se quita con el teclado, y al desmontar no queda', () => {
    const visual = visualFalso(800);
    const { ventana } = ventanaFalsa(800, visual);
    const raiz = raizFalsa();
    const desmontar = montarAltoVisible(ventana, raiz);
    expect(raiz.atributos.has(ATRIBUTO_DEL_TECLADO)).toBe(false);
    visual.height = 450;
    visual.emitir('resize');
    expect(raiz.atributos.has(ATRIBUTO_DEL_TECLADO)).toBe(true);
    visual.height = 800;
    visual.emitir('resize');
    expect(raiz.atributos.has(ATRIBUTO_DEL_TECLADO)).toBe(false);
    visual.height = 450;
    visual.emitir('resize');
    desmontar();
    expect(raiz.atributos.size).toBe(0);
  });
});
