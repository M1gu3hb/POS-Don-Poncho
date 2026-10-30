import { APARIENCIA_POR_OMISION, normalizarEstilo } from '@morphiqpos/app/configuracion';
import { ESTILOS, ESTILO_PREDETERMINADO } from '@morphiqpos/ui/tokens';
import { runInNewContext } from 'node:vm';

import { describe, expect, it } from 'vitest';

import { CLAVE_DEL_VIDRIO, CLAVE_TEMA, GUION_SIN_PARPADEO } from '../../heredado/tema-arranque';

/**
 * EL ESTILO CON QUE ARRANCA LA PRIMERA PINTURA Y LA PANTALLA DE ACCESO.
 *
 * Tres capas dicen «don-poncho» cuando no hay nada guardado, y tienen que decir lo mismo:
 *   · el servidor (`APARIENCIA_POR_OMISION` y `normalizarEstilo`, en la capa de datos);
 *   · el sistema de diseño (`ESTILO_PREDETERMINADO`, que usa el layout y el hook);
 *   · el guion que corre ANTES del primer pintado (`GUION_SIN_PARPADEO`).
 * Si una se desfasa, la pantalla de acceso sale de un estilo y el resto de otro.
 *
 * Lo que NO tiene que pasar es lo contrario: que alguna pise lo que un negocio guardó.
 */

/** Un `<html>` mínimo: atributos, clases y estilo en línea, lo que el guion toca. */
function htmlSimulado(atributos: Record<string, string> = {}) {
  const propios = new Map(Object.entries(atributos));
  const clases = new Set<string>();
  return {
    propios,
    clases,
    style: { colorScheme: '' },
    getAttribute: (nombre: string) => propios.get(nombre) ?? null,
    setAttribute: (nombre: string, valor: string) => {
      propios.set(nombre, valor);
    },
    classList: {
      toggle: (clase: string, activa: boolean) => {
        if (activa) clases.add(clase);
        else clases.delete(clase);
      },
    },
  };
}

interface AlmacenSimulado {
  getItem: (clave: string) => string | null;
}

/** Corre el guion como lo corre el navegador: texto suelto, con `document` y `localStorage`. */
function correrElGuion(
  html: ReturnType<typeof htmlSimulado>,
  almacen: AlmacenSimulado,
  sistemaOscuro?: boolean,
): void {
  // En un contexto aparte, con sólo `document`, `localStorage` y, si se da, `matchMedia`: como
  // lo ve una página (un navegador viejo no tiene `matchMedia`).
  runInNewContext(GUION_SIN_PARPADEO, {
    document: { documentElement: html },
    localStorage: almacen,
    ...(sistemaOscuro === undefined
      ? {}
      : {
          matchMedia: (consulta: string) => ({
            matches: consulta === '(prefers-color-scheme: dark)' && sistemaOscuro,
          }),
        }),
  });
}

/** Un almacén con sólo esas claves. */
function almacenCon(valores: Record<string, string>): AlmacenSimulado {
  return { getItem: (clave) => valores[clave] ?? null };
}

const SIN_PREFERENCIA: AlmacenSimulado = { getItem: () => null };
const ALMACEN_QUE_LANZA: AlmacenSimulado = {
  getItem: () => {
    throw new Error('SecurityError');
  },
};

describe('el predeterminado dicho por las tres capas', () => {
  it('el servidor y el sistema de diseño coinciden: don-poncho', () => {
    expect(APARIENCIA_POR_OMISION.estilo).toBe('don-poncho');
    expect(ESTILO_PREDETERMINADO).toBe(APARIENCIA_POR_OMISION.estilo);
  });

  it('y con las mismas perillas: la casa estrena el lenguaje de capas en los dos lados', () => {
    const { estilo, ...perillas } = APARIENCIA_POR_OMISION;
    expect(perillas).toEqual(ESTILOS[estilo]?.perillas);
  });

  it('un negocio sin estilo guardado, o con uno que ya no existe, es don-poncho', () => {
    for (const vacio of [undefined, null, '', 'desconocido', 'Don-Poncho']) {
      expect(normalizarEstilo(vacio)).toBe('don-poncho');
    }
  });

  it('los nombres de la Fase 1 que significaban «el base» siguen siendo morphiq', () => {
    // `premium` y `base` se guardaron a propósito: eran el estilo de Morphiq, no «ninguno».
    expect(normalizarEstilo('premium')).toBe('morphiq');
    expect(normalizarEstilo('base')).toBe('morphiq');
  });

  it('un negocio que guardó otro estilo conserva el suyo', () => {
    for (const estilo of [
      'morphiq',
      'cristal',
      'relieve',
      'taller',
      'bloque',
      'terminal',
      'papel',
      'noche',
    ]) {
      expect(normalizarEstilo(estilo)).toBe(estilo);
    }
  });

  it('los nombres de la Fase 1 se traducen: editorial es papel, no el predeterminado', () => {
    expect(normalizarEstilo('editorial')).toBe('papel');
  });
});

describe('el guion de arranque, antes del primer pintado', () => {
  it('si el <html> llega sin estilo, le pone don-poncho', () => {
    const html = htmlSimulado();
    correrElGuion(html, SIN_PREFERENCIA);
    expect(html.getAttribute('data-estilo')).toBe('don-poncho');
  });

  it('si el <html> ya trae el estilo del negocio, NO lo pisa', () => {
    for (const estilo of ['noche', 'bloque', 'terminal', 'morphiq']) {
      const html = htmlSimulado({ 'data-estilo': estilo });
      correrElGuion(html, SIN_PREFERENCIA);
      expect(html.getAttribute('data-estilo')).toBe(estilo);
    }
  });

  it('el estilo queda puesto aunque localStorage lance (ventana privada)', () => {
    const html = htmlSimulado();
    expect(() => {
      correrElGuion(html, ALMACEN_QUE_LANZA);
    }).not.toThrow();
    expect(html.getAttribute('data-estilo')).toBe('don-poncho');
  });

  it('conserva la preferencia del dispositivo: el modo oscuro guardado sigue siendo oscuro', () => {
    const html = htmlSimulado();
    correrElGuion(html, { getItem: (clave) => (clave === CLAVE_TEMA ? 'dark' : null) });
    expect(html.clases.has('dark')).toBe(true);
    expect(html.style.colorScheme).toBe('dark');
    expect(html.getAttribute('data-estilo')).toBe('don-poncho');
  });

  it('sin preferencia de modo y con el sistema en claro (o sin saberlo), arranca en claro', () => {
    for (const sistemaOscuro of [false, undefined]) {
      const html = htmlSimulado();
      correrElGuion(html, SIN_PREFERENCIA, sistemaOscuro);
      expect(html.clases.has('dark')).toBe(false);
      expect(html.style.colorScheme).toBe('light');
    }
  });

  it('DP-11.4 · sin preferencia, o en «auto», sigue al sistema: oscuro si el sistema es oscuro', () => {
    for (const almacen of [SIN_PREFERENCIA, almacenCon({ [CLAVE_TEMA]: 'auto' })]) {
      const html = htmlSimulado();
      correrElGuion(html, almacen, true);
      expect(html.clases.has('dark')).toBe(true);
      expect(html.style.colorScheme).toBe('dark');
    }
  });

  it('DP-11.4 · «Claro» elegido a mano gana aunque el sistema esté en oscuro', () => {
    const html = htmlSimulado();
    correrElGuion(html, almacenCon({ [CLAVE_TEMA]: 'light' }), true);
    expect(html.clases.has('dark')).toBe(false);
  });

  it('DP-11.4 · el aparato que quedó en vidrio sólido arranca sólido; sin decisión, no se toca', () => {
    const solido = htmlSimulado();
    correrElGuion(solido, almacenCon({ [CLAVE_DEL_VIDRIO]: 'solido' }));
    expect(solido.getAttribute('data-vidrio')).toBe('solido');

    const nuevo = htmlSimulado();
    correrElGuion(nuevo, SIN_PREFERENCIA);
    expect(nuevo.getAttribute('data-vidrio')).toBeNull();
  });

  it('usa la misma clave de tema que el ThemeContext del heredado', () => {
    expect(CLAVE_TEMA).toBe('mh_theme');
  });
});
