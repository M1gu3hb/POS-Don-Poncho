import { describe, expect, it } from 'vitest';

import {
  MARCA_DE_ESCANEAR,
  documentoConCamara,
  sinLaMarca,
  urlParaEscanear,
} from './escaner-del-documento';

/**
 * DP-13.2 · LA CÁMARA ES DEL DOCUMENTO: quien entró a `/mesero` o `/pos` desde otra pantalla sin
 * recargar sigue con la cabecera de aquélla (`camera=()`), y abrir el escáner recarga una vez.
 */

const ORIGEN = 'https://pos-don-poncho.vercel.app';

describe('¿el documento trae la cámara?', () => {
  it('cargado en el mesero o en el cobro, sí (también con su consulta)', () => {
    expect(documentoConCamara(`${ORIGEN}/mesero`)).toBe(true);
    expect(documentoConCamara(`${ORIGEN}/pos?escanear=1`)).toBe(true);
  });

  it('cargado en la caja, la entrada por PIN o el tablero, no: entrar después sin recargar no la abre', () => {
    for (const ruta of ['/caja', '/login-pos', '/', '/n/don-poncho/login-pos', '/pos/x']) {
      expect(documentoConCamara(`${ORIGEN}${ruta}`), ruta).toBe(false);
    }
  });

  it('sin saber dónde se cargó, se intenta la cámara en vez de recargar a ciegas', () => {
    expect(documentoConCamara(undefined)).toBe(true);
    expect(documentoConCamara('no es una dirección')).toBe(true);
  });
});

describe('la marca que abre el escáner al llegar', () => {
  it('se pone sin perder la consulta, y se quita dejando la dirección como estaba', () => {
    const conMarca = urlParaEscanear(`${ORIGEN}/mesero?zona=terraza`);
    expect(new URL(conMarca).searchParams.get(MARCA_DE_ESCANEAR)).toBe('1');
    expect(new URL(conMarca).searchParams.get('zona')).toBe('terraza');
    expect(sinLaMarca(conMarca)).toBe(`${ORIGEN}/mesero?zona=terraza`);
  });

  it('sin la marca no hay nada que limpiar ni escáner que abrir', () => {
    expect(sinLaMarca(`${ORIGEN}/mesero`)).toBeNull();
  });
});
