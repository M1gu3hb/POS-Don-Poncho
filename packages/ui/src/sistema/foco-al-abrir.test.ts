import { describe, expect, it, vi } from 'vitest';

import { crearFocoAlAbrir, hayPunteroGrueso, puedeEnfocarAlAbrir } from './foco-al-abrir';

function evento() {
  const contenedor = { focus: vi.fn() };
  const e = {
    defaultPrevented: false,
    currentTarget: contenedor,
    preventDefault() {
      this.defaultPrevented = true;
    },
  };
  return { e: e as unknown as Event, contenedor, preventado: () => e.defaultPrevented };
}

describe('el foco al abrir un diálogo', () => {
  it('con puntero fino (ratón) no toca nada: Radix enfoca el primer campo como siempre', () => {
    const { e, contenedor, preventado } = evento();
    crearFocoAlAbrir(() => false)()(e);
    expect(preventado()).toBe(false);
    expect(contenedor.focus).not.toHaveBeenCalled();
  });

  it('con puntero grueso (dedo) cancela el foco en el primer campo y lo manda al contenedor', () => {
    const { e, contenedor, preventado } = evento();
    crearFocoAlAbrir(() => true)()(e);
    expect(preventado()).toBe(true);
    expect(contenedor.focus).toHaveBeenCalledTimes(1);
    expect(contenedor.focus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it('respeta al que llama: se ejecuta su manejador, una vez, antes de decidir', () => {
    const orden: string[] = [];
    const { e, contenedor } = evento();
    contenedor.focus.mockImplementation(() => orden.push('contenedor'));
    const suyo = vi.fn(() => orden.push('suyo'));
    crearFocoAlAbrir(() => true)(suyo)(e);
    expect(suyo).toHaveBeenCalledTimes(1);
    expect(suyo).toHaveBeenCalledWith(e);
    expect(orden).toEqual(['suyo', 'contenedor']);
  });

  it('si el que llama ya decidió dónde va el foco (preventDefault), no se lo pisa', () => {
    const { e, contenedor } = evento();
    const suyo = vi.fn((evt: Event) => {
      evt.preventDefault();
    });
    crearFocoAlAbrir(() => true)(suyo)(e);
    expect(contenedor.focus).not.toHaveBeenCalled();
  });

  it('con puntero fino también corre el manejador del que llama', () => {
    const { e } = evento();
    const suyo = vi.fn();
    crearFocoAlAbrir(() => false)(suyo)(e);
    expect(suyo).toHaveBeenCalledTimes(1);
  });
});

describe('¿hay un dedo en este aparato?', () => {
  it('sin matchMedia (servidor, motor raro) no hay: se queda el comportamiento de siempre', () => {
    expect(hayPunteroGrueso(undefined)).toBe(false);
  });

  it('pregunta por `(any-pointer: coarse)`, no por `pointer`: una PC con pantalla táctil también cuenta', () => {
    const preguntas: string[] = [];
    const ventana = {
      matchMedia: (q: string) => {
        preguntas.push(q);
        return { matches: true };
      },
    };
    expect(hayPunteroGrueso(ventana)).toBe(true);
    expect(preguntas).toEqual(['(any-pointer: coarse)']);
  });
});

describe('el `autoFocus` de un campo de texto', () => {
  it('con ratón se puede enfocar al abrir (la PC teclea de inmediato)', () => {
    expect(puedeEnfocarAlAbrir(() => false)).toBe(true);
  });

  it('con dedo no: el teclado saldría solo y taparía lo que se está llenando', () => {
    expect(puedeEnfocarAlAbrir(() => true)).toBe(false);
  });
});
