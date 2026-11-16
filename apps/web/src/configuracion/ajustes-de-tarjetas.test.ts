import { describe, expect, it } from 'vitest';

import {
  AJUSTES_DE_TARJETAS,
  comoSeGuarda,
  errorDelFormulario,
  formularioDe,
  parcheDe,
} from './ajustes-de-tarjetas.ts';

/** DP-21 · Bloque 20 · el RFC en «Datos del negocio»: se teclea y se valida como RFC. */
const DATOS = AJUSTES_DE_TARJETAS['datos-del-negocio'];

describe('el RFC de «Datos del negocio»', () => {
  const campo = DATOS?.campos.find((c) => c.clave === 'rfc');

  it('es un campo de la tarjeta, vacío por omisión', () => {
    expect(campo).toBeDefined();
    expect(DATOS === undefined ? null : formularioDe(DATOS, null)['rfc']).toBe('');
  });

  it('lo tecleado queda en mayúsculas y sin espacios', () => {
    if (campo === undefined) throw new Error('falta el campo');
    expect(comoSeGuarda(campo, ' abc 850101 ab1')).toBe('ABC850101AB1');
  });

  it('con una forma que no es, no se guarda; vacío o bueno, sí', () => {
    if (DATOS === undefined) throw new Error('falta la tarjeta');
    const base = formularioDe(DATOS, null);
    expect(errorDelFormulario(DATOS, { ...base, rfc: 'ABC85' })).toMatch(/12 caracteres/);
    expect(errorDelFormulario(DATOS, { ...base, rfc: 'ABC850101AB1' })).toBeNull();
    expect(errorDelFormulario(DATOS, { ...base, rfc: '' })).toBeNull();
  });

  it('manda sólo el RFC cuando es lo único que cambió', () => {
    if (DATOS === undefined) throw new Error('falta la tarjeta');
    const guardado = {
      nombre_negocio: 'Don Poncho',
      direccion: '',
      telefono: '',
      correo: '',
      rfc: '',
    };
    const base = formularioDe(DATOS, guardado);
    expect(parcheDe(DATOS, { ...base, rfc: 'ABC850101AB1' }, guardado)).toEqual({
      rfc: 'ABC850101AB1',
    });
  });
});
