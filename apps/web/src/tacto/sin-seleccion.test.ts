import { describe, expect, it, vi } from 'vitest';

import {
  ATRIBUTO_DEL_POS,
  elMenuNativoSeQueda,
  montarSinMenuNativo,
  type DocumentoDelPos,
} from './sin-seleccion';

/** Un nodo falso que contesta `closest` como el navegador: el selector ya viene resuelto a mano. */
function nodo(etiqueta: string, editable = false): EventTarget {
  const falso = {
    closest: (selector: string) => {
      const campos = selector.split(',').map((s) => s.trim());
      if (campos.includes(etiqueta)) return falso;
      if (editable && campos.some((c) => c.startsWith('[contenteditable'))) return falso;
      return null;
    },
  };
  return falso as unknown as EventTarget;
}

describe('qué menú nativo se queda', () => {
  it.each(['input', 'textarea'])('en un %s se queda: ahí se copia y se pega', (etiqueta) => {
    expect(elMenuNativoSeQueda(nodo(etiqueta))).toBe(true);
  });

  it('en un contenteditable se queda', () => {
    expect(elMenuNativoSeQueda(nodo('div', true))).toBe(true);
  });

  it.each(['button', 'div', 'span', 'a'])('en un %s se cancela', (etiqueta) => {
    expect(elMenuNativoSeQueda(nodo(etiqueta))).toBe(false);
  });

  it('sin destino, o con un destino que no es un elemento, se cancela', () => {
    expect(elMenuNativoSeQueda(null)).toBe(false);
    expect(elMenuNativoSeQueda({} as EventTarget)).toBe(false);
  });
});

describe('el oyente del armazón', () => {
  function documentoFalso() {
    const oyentes = new Map<string, (e: Event) => void>();
    const atributos = new Set<string>();
    const documento: DocumentoDelPos = {
      addEventListener: (tipo, oyente) => {
        oyentes.set(tipo, oyente);
      },
      removeEventListener: (tipo) => {
        oyentes.delete(tipo);
      },
      documentElement: {
        setAttribute: (nombre) => {
          atributos.add(nombre);
        },
        removeAttribute: (nombre) => {
          atributos.delete(nombre);
        },
      },
    };
    return { documento, oyentes, atributos };
  }
  const evento = (destino: EventTarget | null) => {
    const preventDefault = vi.fn();
    return { target: destino, preventDefault } as unknown as Event & {
      preventDefault: ReturnType<typeof vi.fn>;
    };
  };

  it('marca el documento como POS y cancela el menú de un botón', () => {
    const { documento, oyentes, atributos } = documentoFalso();
    montarSinMenuNativo(documento);
    expect(atributos.has(ATRIBUTO_DEL_POS)).toBe(true);
    const e = evento(nodo('button'));
    oyentes.get('contextmenu')?.(e);
    expect(e.preventDefault.mock.calls).toHaveLength(1);
  });

  it('no toca el menú de un campo de texto', () => {
    const { documento, oyentes } = documentoFalso();
    montarSinMenuNativo(documento);
    const e = evento(nodo('input'));
    oyentes.get('contextmenu')?.(e);
    expect(e.preventDefault.mock.calls).toHaveLength(0);
  });

  it('al desmontar quita el oyente y la marca: el portal del comensal queda fuera', () => {
    const { documento, oyentes, atributos } = documentoFalso();
    const desmontar = montarSinMenuNativo(documento);
    desmontar();
    expect(oyentes.size).toBe(0);
    expect(atributos.size).toBe(0);
  });
});
