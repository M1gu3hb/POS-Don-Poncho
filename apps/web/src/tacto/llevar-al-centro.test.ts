import { describe, expect, it } from 'vitest';

import {
  MARGEN_DEL_CAMPO_PX,
  crearLlevarAlCentro,
  esCampoDeTexto,
  estaALaVista,
  type DepsDelCentro,
} from './llevar-al-centro';

describe('qué es un campo donde sale el teclado', () => {
  const campo = (tagName: string, type = '', isContentEditable = false) => ({
    tagName,
    type,
    isContentEditable,
  });

  it.each(['text', 'search', 'tel', 'email', 'url', 'password', 'number', ''])(
    'un input «%s» sí',
    (type) => {
      expect(esCampoDeTexto(campo('INPUT', type))).toBe(true);
    },
  );

  it.each(['checkbox', 'radio', 'button', 'submit', 'file', 'range', 'color'])(
    'un input «%s» no: no abre teclado',
    (type) => {
      expect(esCampoDeTexto(campo('INPUT', type))).toBe(false);
    },
  );

  it('un textarea y un contenteditable sí; un botón o un select no', () => {
    expect(esCampoDeTexto(campo('TEXTAREA'))).toBe(true);
    expect(esCampoDeTexto(campo('DIV', '', true))).toBe(true);
    expect(esCampoDeTexto(campo('BUTTON'))).toBe(false);
    expect(esCampoDeTexto(campo('SELECT'))).toBe(false);
    expect(esCampoDeTexto(null)).toBe(false);
  });
});

describe('¿el campo ya está a la vista?', () => {
  const visible = { top: 0, height: 400 };

  it('dentro, con su margen, sí: no hay nada que mover', () => {
    expect(estaALaVista({ top: 100, bottom: 160 }, visible)).toBe(true);
  });

  it('tapado por el teclado (debajo del alto visible) no', () => {
    expect(estaALaVista({ top: 380, bottom: 440 }, visible)).toBe(false);
  });

  it('pegado al borde, sin su margen, no: queda a medias bajo el teclado o el encabezado', () => {
    expect(estaALaVista({ top: 300, bottom: 400 - MARGEN_DEL_CAMPO_PX + 1 }, visible)).toBe(false);
    expect(estaALaVista({ top: MARGEN_DEL_CAMPO_PX - 1, bottom: 60 }, visible)).toBe(false);
  });

  it('cuenta el desplazamiento del visualViewport (offsetTop)', () => {
    expect(estaALaVista({ top: 520, bottom: 580 }, { top: 300, height: 400 })).toBe(true);
    expect(estaALaVista({ top: 120, bottom: 180 }, { top: 300, height: 400 })).toBe(false);
  });
});

/** Un reloj y un visualViewport a mano: nada espera de verdad. */
function mundo(opciones: { reducir?: boolean; sinVisual?: boolean; alALaVista?: boolean } = {}) {
  const temporizadores = new Map<number, () => void>();
  let siguiente = 1;
  const oyentes = new Set<() => void>();
  const llamadas: { campo: unknown; comportamiento: string }[] = [];
  const deps: DepsDelCentro = {
    visual:
      opciones.sinVisual === true
        ? null
        : {
            addEventListener: (_t, o) => oyentes.add(o),
            removeEventListener: (_t, o) => oyentes.delete(o),
          },
    programar: (f) => {
      const id = siguiente++;
      temporizadores.set(id, f);
      return id;
    },
    cancelar: (id) => temporizadores.delete(id as number),
    reducirMovimiento: () => opciones.reducir === true,
    medir: () => ({
      campo: opciones.alALaVista === true ? { top: 100, bottom: 160 } : { top: 500, bottom: 560 },
      visible: { top: 0, height: 400 },
    }),
    llevar: (campo, comportamiento) => llamadas.push({ campo, comportamiento }),
  };
  const correrTodo = () => {
    for (const [id, f] of [...temporizadores]) {
      if (!temporizadores.has(id)) continue; // ya lo canceló uno anterior
      temporizadores.delete(id);
      f();
    }
  };
  return {
    deps,
    llamadas,
    pendientes: () => temporizadores.size,
    oyentes: () => oyentes.size,
    redimensionar: () => {
      [...oyentes].forEach((o) => {
        o();
      });
    },
    correrTodo,
  };
}

describe('llevar el campo al centro, una vez', () => {
  it('al enfocar NO salta de golpe: espera a que el visualViewport cambie', () => {
    const m = mundo();
    crearLlevarAlCentro(m.deps).alEnfocar('campo-1');
    expect(m.llamadas).toHaveLength(0);
    expect(m.oyentes()).toBe(1);
  });

  it('cuando el visualViewport cambia y se asienta, lo lleva al centro UNA sola vez', () => {
    const m = mundo();
    crearLlevarAlCentro(m.deps).alEnfocar('campo-1');
    m.redimensionar();
    m.redimensionar();
    m.redimensionar();
    m.correrTodo();
    expect(m.llamadas).toEqual([{ campo: 'campo-1', comportamiento: 'smooth' }]);
    expect(m.oyentes()).toBe(0);
    m.correrTodo();
    expect(m.llamadas).toHaveLength(1);
  });

  it('si el teclado ya estaba arriba (nada cambia) lo lleva igual al vencer la espera', () => {
    const m = mundo();
    crearLlevarAlCentro(m.deps).alEnfocar('campo-1');
    m.correrTodo();
    expect(m.llamadas).toHaveLength(1);
  });

  it('si el campo ya está a la vista, no lo mueve: nada de saltos', () => {
    const m = mundo({ alALaVista: true });
    crearLlevarAlCentro(m.deps).alEnfocar('campo-1');
    m.redimensionar();
    m.correrTodo();
    expect(m.llamadas).toHaveLength(0);
  });

  it('con «reducir movimiento» no anima', () => {
    const m = mundo({ reducir: true });
    crearLlevarAlCentro(m.deps).alEnfocar('campo-1');
    m.correrTodo();
    expect(m.llamadas).toEqual([{ campo: 'campo-1', comportamiento: 'auto' }]);
  });

  it('sin visualViewport (motor viejo) usa la espera sola', () => {
    const m = mundo({ sinVisual: true });
    crearLlevarAlCentro(m.deps).alEnfocar('campo-1');
    expect(m.oyentes()).toBe(0);
    m.correrTodo();
    expect(m.llamadas).toHaveLength(1);
  });

  it('es cancelable: si se pierde el foco antes, no se mueve nada', () => {
    const m = mundo();
    const centro = crearLlevarAlCentro(m.deps);
    centro.alEnfocar('campo-1');
    centro.cancelar();
    m.redimensionar();
    m.correrTodo();
    expect(m.llamadas).toHaveLength(0);
    expect(m.oyentes()).toBe(0);
    expect(m.pendientes()).toBe(0);
  });

  it('un foco nuevo cancela el pendiente del anterior: sólo se lleva el último campo', () => {
    const m = mundo();
    const centro = crearLlevarAlCentro(m.deps);
    centro.alEnfocar('campo-1');
    centro.alEnfocar('campo-2');
    m.redimensionar();
    m.correrTodo();
    expect(m.llamadas).toEqual([{ campo: 'campo-2', comportamiento: 'smooth' }]);
  });

  it('con muchos cambios seguidos del visualViewport, igual una sola vez', () => {
    const m = mundo();
    crearLlevarAlCentro(m.deps).alEnfocar('campo-1');
    for (let i = 0; i < 5; i += 1) {
      m.redimensionar();
    }
    m.correrTodo();
    expect(m.llamadas).toHaveLength(1);
  });
});
