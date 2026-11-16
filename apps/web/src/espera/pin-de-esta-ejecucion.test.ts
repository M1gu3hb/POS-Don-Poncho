import { describe, expect, it, vi } from 'vitest';

import {
  CLAVE_DEL_PIN_DE_ESTA_EJECUCION,
  claseDelPuesto,
  marcarPin,
  minutosDelCandado,
  olvidarPin,
  pidePinAlAbrir,
  seCierraSinUso,
  suscribirAlPin,
  tecleoSuPin,
  venceElCandado,
} from './pin-de-esta-ejecucion.ts';

/** DP-21 · Bloque 2 · «El administrador siempre con PIN; las estaciones pueden recordarse» (M14). */

function almacenFalso(): Storage {
  const datos = new Map<string, string>();
  return {
    getItem: (clave: string) => datos.get(clave) ?? null,
    setItem: (clave: string, valor: string) => void datos.set(clave, valor),
    removeItem: (clave: string) => void datos.delete(clave),
    clear: () => {
      datos.clear();
    },
    key: () => null,
    get length() {
      return datos.size;
    },
  };
}

const ROTO = {
  getItem: () => {
    throw new Error('datos del sitio bloqueados');
  },
  setItem: () => {
    throw new Error('datos del sitio bloqueados');
  },
  removeItem: () => {
    throw new Error('datos del sitio bloqueados');
  },
};

describe('claseDelPuesto', () => {
  it('dueño, administrador y gerente llegan a la pantalla como «administrador»: mando', () => {
    expect(claseDelPuesto('administrador')).toBe('mando');
    expect(claseDelPuesto('dueno')).toBe('mando');
    expect(claseDelPuesto('gerente')).toBe('mando');
  });

  it('el cajero (que la pantalla llama «caja») y el almacén: caja', () => {
    expect(claseDelPuesto('caja')).toBe('caja');
    expect(claseDelPuesto('cajero')).toBe('caja');
    expect(claseDelPuesto('almacen')).toBe('caja');
  });

  it('mesero y cocina: estaciones', () => {
    expect(claseDelPuesto('mesero')).toBe('estacion');
    expect(claseDelPuesto('cocina')).toBe('estacion');
  });

  it('lo que no se reconoce cae en la más estricta', () => {
    expect(claseDelPuesto(undefined)).toBe('mando');
    expect(claseDelPuesto(null)).toBe('mando');
    expect(claseDelPuesto('inventado')).toBe('mando');
  });
});

describe('quién teclea su PIN al abrir y quién se cierra solo', () => {
  it('todos menos las estaciones teclean su PIN cada vez que se abre la app', () => {
    expect(pidePinAlAbrir('mando')).toBe(true);
    expect(pidePinAlAbrir('caja')).toBe(true);
    expect(pidePinAlAbrir('estacion')).toBe(false);
  });

  it('sólo el mando se cierra si nadie toca la pantalla', () => {
    expect(seCierraSinUso('mando')).toBe(true);
    expect(seCierraSinUso('caja')).toBe(false);
    expect(seCierraSinUso('estacion')).toBe(false);
  });
});

describe('la marca de esta ejecución', () => {
  it('una pantalla nueva no tiene marca: pide el PIN', () => {
    expect(tecleoSuPin(almacenFalso(), 'empleo-admin')).toBe(false);
  });

  it('tras teclear el PIN queda marcada para ESE empleo, y sólo guarda su id', () => {
    const almacen = almacenFalso();
    marcarPin(almacen, 'empleo-admin');
    expect(tecleoSuPin(almacen, 'empleo-admin')).toBe(true);
    expect(almacen.getItem(CLAVE_DEL_PIN_DE_ESTA_EJECUCION)).toBe('empleo-admin');
  });

  it('la marca de otra persona no cuenta', () => {
    const almacen = almacenFalso();
    marcarPin(almacen, 'empleo-gerente');
    expect(tecleoSuPin(almacen, 'empleo-admin')).toBe(false);
  });

  it('al salir o al cerrarse por falta de uso, la marca se va', () => {
    const almacen = almacenFalso();
    marcarPin(almacen, 'empleo-admin');
    olvidarPin(almacen);
    expect(tecleoSuPin(almacen, 'empleo-admin')).toBe(false);
  });

  it('sin almacén (o con los datos del sitio bloqueados) falla cerrado: pide el PIN', () => {
    expect(tecleoSuPin(null, 'empleo-admin')).toBe(false);
    expect(tecleoSuPin(ROTO, 'empleo-admin')).toBe(false);
    expect(() => {
      marcarPin(ROTO, 'empleo-admin');
    }).not.toThrow();
    expect(() => {
      olvidarPin(ROTO);
    }).not.toThrow();
  });

  it('marcar y olvidar avisan al candado, que así se entera sin recargar', () => {
    const oyente = vi.fn();
    const dejar = suscribirAlPin(oyente);
    const almacen = almacenFalso();
    marcarPin(almacen, 'empleo-admin');
    olvidarPin(almacen);
    expect(oyente).toHaveBeenCalledTimes(2);
    dejar();
    marcarPin(almacen, 'empleo-admin');
    expect(oyente).toHaveBeenCalledTimes(2);
  });
});

describe('el candado por falta de uso', () => {
  it('10 minutos por omisión; lo guardado vale si es un entero de 5 a 30', () => {
    expect(minutosDelCandado(undefined)).toBe(10);
    expect(minutosDelCandado(5)).toBe(5);
    expect(minutosDelCandado(30)).toBe(30);
    expect(minutosDelCandado(4)).toBe(10);
    expect(minutosDelCandado(31)).toBe(10);
    expect(minutosDelCandado(7.5)).toBe(10);
    expect(minutosDelCandado('15')).toBe(10);
  });

  it('vence justo al cumplirse los minutos, no antes', () => {
    const toque = 1_000_000;
    expect(venceElCandado(toque, toque + 10 * 60_000 - 1, 10)).toBe(false);
    expect(venceElCandado(toque, toque + 10 * 60_000, 10)).toBe(true);
    expect(venceElCandado(toque, toque + 5 * 60_000, 5)).toBe(true);
    expect(venceElCandado(toque, toque + 5 * 60_000, 10)).toBe(false);
  });
});
