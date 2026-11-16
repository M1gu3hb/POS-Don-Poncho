import { describe, expect, it } from 'vitest';

import { cierreDeLaPropina, textoDelCierre } from './propina-ya-registrada.ts';

/** DP-21 · Bloque 4 · «la otra se entera y se cierra» (M11), del lado del comensal. */
const ABIERTA = {
  id: 'orden-1',
  estado: 'cuenta_solicitada',
  propina_tipo: null,
  propina_origen: null,
};

describe('cierreDeLaPropina', () => {
  it('la cuenta sigue abierta y nadie decidió: la pantalla sigue', () => {
    expect(cierreDeLaPropina(ABIERTA, true, false)).toBeNull();
  });

  it('el mesero la dejó para el comensal: la pantalla sigue (es justo para eso)', () => {
    const esperando = {
      ...ABIERTA,
      propina_tipo: 'pendiente_cliente',
      propina_origen: 'pendiente_portal_qr',
    };
    expect(cierreDeLaPropina(esperando, true, false)).toBeNull();
  });

  it('la Caja ya la eligió: se cierra y dice que quedó registrada en caja', () => {
    const deLaCaja = { ...ABIERTA, propina_tipo: 'porcentaje', propina_origen: 'caja' };
    expect(cierreDeLaPropina(deLaCaja, true, false)).toBe('caja');
    expect(textoDelCierre('caja')).toBe('Tu propina ya quedó registrada en caja');
  });

  it('«sin propina» puesto en la caja también es una decisión', () => {
    const sin = { ...ABIERTA, propina_tipo: 'sin_propina', propina_origen: 'caja' };
    expect(cierreDeLaPropina(sin, true, false)).toBe('caja');
  });

  it('la que registró el mesero cuenta igual: ya está decidida', () => {
    const delMesero = { ...ABIERTA, propina_tipo: 'porcentaje', propina_origen: 'mesero' };
    expect(cierreDeLaPropina(delMesero, true, false)).toBe('caja');
  });

  it('la que eligió el propio comensal no le cierra su pantalla (puede corregirla)', () => {
    const suya = { ...ABIERTA, propina_tipo: 'porcentaje', propina_origen: 'portal_qr' };
    expect(cierreDeLaPropina(suya, true, false)).toBeNull();
  });

  it('«decidir en caja» del comensal no es una decisión: no se cierra', () => {
    const enCaja = { ...ABIERTA, propina_tipo: 'decidir_en_caja', propina_origen: 'portal_qr' };
    expect(cierreDeLaPropina(enCaja, true, false)).toBeNull();
  });

  it('la cuenta ya se cobró (ya no hay cuenta en la mesa): se cierra y da las gracias', () => {
    expect(cierreDeLaPropina(null, true, false)).toBe('pagada');
    expect(cierreDeLaPropina({ ...ABIERTA, estado: 'pagada' }, true, false)).toBe('pagada');
    expect(textoDelCierre('pagada')).toBe('Tu cuenta ya se pagó, ¡gracias!');
  });

  it('si nunca hubo cuenta, no se inventa un «ya se pagó»', () => {
    expect(cierreDeLaPropina(null, false, false)).toBeNull();
    expect(cierreDeLaPropina(undefined, false, false)).toBeNull();
  });

  it('si el comensal ya confirmó la suya aquí, no hay nada que cerrar', () => {
    const deLaCaja = { ...ABIERTA, propina_tipo: 'porcentaje', propina_origen: 'caja' };
    expect(cierreDeLaPropina(deLaCaja, true, true)).toBeNull();
    expect(cierreDeLaPropina(null, true, true)).toBeNull();
  });
});
