import { describe, expect, it } from 'vitest';

import { montarTieneDeRespaldo, motorSinHas, refrescarMarcas } from './tiene-de-respaldo';

function elemento(dentro: { checked?: boolean; foco?: boolean }) {
  const atributos = new Set<string>();
  return {
    atributos,
    querySelector: (selector: string) =>
      (selector === ':checked' && dentro.checked === true) ||
      (selector === ':focus-visible' && dentro.foco === true)
        ? {}
        : null,
    setAttribute: (n: string) => atributos.add(n),
    removeAttribute: (n: string) => atributos.delete(n),
  };
}

const raizCon = (porSelector: Record<string, ReturnType<typeof elemento>[]>) => ({
  querySelectorAll: (selector: string) => porSelector[selector] ?? [],
});

describe('¿el motor entiende :has()?', () => {
  it('lo pregunta con CSS.supports; sin CSS.supports, se asume que sí (no se instala nada)', () => {
    expect(motorSinHas({ supports: (c: string) => c !== 'selector(:has(a))' })).toBe(true);
    expect(motorSinHas({ supports: () => true })).toBe(false);
    expect(motorSinHas(undefined)).toBe(false);
  });
});

describe('las marcas que sustituyen a :has()', () => {
  it('marca la tarjeta que tiene lo elegido y desmarca la que no', () => {
    const elegida = elemento({ checked: true });
    const otra = elemento({ checked: false });
    otra.atributos.add('data-tiene-checked');
    refrescarMarcas(raizCon({ '[class*="has-checked:"]': [elegida, otra] }));
    expect([...elegida.atributos]).toEqual(['data-tiene-checked']);
    expect(otra.atributos.size).toBe(0);
  });

  it('lo mismo con el foco del teclado', () => {
    const conFoco = elemento({ foco: true });
    refrescarMarcas(raizCon({ '[class*="has-focus-visible:"]': [conFoco] }));
    expect([...conFoco.atributos]).toEqual(['data-tiene-focus-visible']);
  });
});

describe('el montaje', () => {
  function mundo(sinHas: boolean) {
    const oyentes = new Map<string, () => void>();
    const tarjeta = elemento({ checked: true });
    const documento = {
      addEventListener: (t: string, o: () => void) => oyentes.set(t, o),
      removeEventListener: (t: string) => oyentes.delete(t),
      querySelectorAll: (s: string) => (s === '[class*="has-checked:"]' ? [tarjeta] : []),
    };
    const observados: string[] = [];
    const desmontar = montarTieneDeRespaldo(documento, {
      supports: () => !sinHas,
      observar: () => {
        observados.push('observa');
        return () => observados.push('suelta');
      },
    });
    return { oyentes, tarjeta, desmontar, observados };
  }

  it('en un motor con :has() no instala nada', () => {
    const { oyentes, observados } = mundo(false);
    expect(oyentes.size).toBe(0);
    expect(observados).toEqual([]);
  });

  it('en uno sin :has() marca al montar y en cada cambio, y al desmontar suelta todo', () => {
    const { oyentes, tarjeta, desmontar, observados } = mundo(true);
    expect(tarjeta.atributos.has('data-tiene-checked')).toBe(true);
    expect([...oyentes.keys()].sort()).toEqual(['change', 'focusin', 'focusout']);
    expect(observados).toEqual(['observa']);
    desmontar();
    expect(oyentes.size).toBe(0);
    expect(observados).toEqual(['observa', 'suelta']);
  });
});
