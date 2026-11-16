import { describe, expect, it } from 'vitest';

import {
  alUsarEsa,
  elMeseroEligeLaPropina,
  entradaDeFijarPropina,
  estaDecidida,
  laCajaEligeLaPropina,
  propinaDelConflicto,
  propinaDeOtraPantalla,
  textoDelAviso,
} from './propina-en-la-caja.ts';

/**
 * DP-21 · Bloque 4 · «Si los comensales eligen después, la Caja se entera» (M11, O8).
 */
const ABIERTA = { propina_tipo: null, propina_porcentaje: 0, propina_origen: null, version: 3 };
const DEL_PORTAL = {
  propina_tipo: 'porcentaje',
  propina_porcentaje: 10,
  propina_origen: 'portal_qr',
  version: 4,
  total: 520,
};

describe('propinaDeOtraPantalla', () => {
  it('los comensales eligieron mientras la Caja tenía el cobro abierto: avisa', () => {
    expect(propinaDeOtraPantalla(ABIERTA, DEL_PORTAL)).toEqual({
      quien: 'comensales',
      tipo: 'porcentaje',
      porcentaje: 10,
      monto: 52,
      origen: 'portal_qr',
      version: 4,
    });
  });

  it('el mesero la registró: también avisa', () => {
    const delMesero = { ...DEL_PORTAL, propina_origen: 'mesero', propina_porcentaje: 15 };
    expect(propinaDeOtraPantalla(ABIERTA, delMesero)?.quien).toBe('mesero');
  });

  it('«sin propina» de los comensales es una decisión: avisa, con $0', () => {
    const sin = { ...DEL_PORTAL, propina_tipo: 'sin_propina', propina_porcentaje: 0 };
    expect(propinaDeOtraPantalla(ABIERTA, sin)).toMatchObject({ tipo: 'sin_propina', monto: 0 });
  });

  it('si la Caja ya la tiene a la vista (tocó «Usar ésa»), no vuelve a avisar', () => {
    expect(propinaDeOtraPantalla({ ...DEL_PORTAL, version: 3 }, DEL_PORTAL)).toBeNull();
  });

  it('lo que eligió la propia Caja no es de otra pantalla', () => {
    const deLaCaja = { ...DEL_PORTAL, propina_origen: 'caja' };
    expect(propinaDeOtraPantalla(ABIERTA, deLaCaja)).toBeNull();
  });

  it('un «todavía no» (pendiente, decidir en caja) no avisa', () => {
    for (const propina_tipo of ['pendiente', 'pendiente_cliente', 'decidir_en_caja', null]) {
      expect(
        propinaDeOtraPantalla(ABIERTA, { ...DEL_PORTAL, propina_tipo, propina_porcentaje: 0 }),
      ).toBeNull();
    }
  });

  it('si la Caja tenía OTRA elegida y llega la del portal, avisa (no la pisa en silencio)', () => {
    const laDeLaCaja = {
      propina_tipo: 'porcentaje',
      propina_porcentaje: 15,
      propina_origen: 'caja',
    };
    expect(propinaDeOtraPantalla(laDeLaCaja, DEL_PORTAL)?.porcentaje).toBe(10);
  });

  it('el monto se redondea al centavo', () => {
    const aviso = propinaDeOtraPantalla(ABIERTA, {
      ...DEL_PORTAL,
      total: 133.33,
      propina_porcentaje: 15,
    });
    expect(aviso?.monto).toBe(20);
  });
});

describe('propinaDelConflicto (el 409 del servidor)', () => {
  it('lee la propina vigente que trae el rechazo', () => {
    const datos = {
      regla: 'PROPINA_VIGENTE',
      propinaTipo: 'porcentaje',
      propinaPuntosBase: 1000,
      propinaOrigen: 'portal_qr',
      version: 7,
    };
    expect(propinaDelConflicto(datos, 520)).toEqual({
      quien: 'comensales',
      tipo: 'porcentaje',
      porcentaje: 10,
      monto: 52,
      origen: 'portal_qr',
      version: 7,
    });
  });

  it('otro rechazo no es un aviso de propina', () => {
    expect(propinaDelConflicto({ regla: 'ORDEN_NO_EDITABLE' }, 520)).toBeNull();
    expect(propinaDelConflicto(undefined, 520)).toBeNull();
    expect(propinaDelConflicto({}, 520)).toBeNull();
  });
});

describe('textoDelAviso', () => {
  it('dice quién, cuánto por ciento y cuánto en pesos', () => {
    const aviso = propinaDeOtraPantalla(ABIERTA, DEL_PORTAL);
    expect(aviso && textoDelAviso(aviso)).toBe('Los comensales eligieron 10 % de propina ($52.00)');
  });

  it('sin propina, lo dice sin importe', () => {
    const sin = propinaDeOtraPantalla(ABIERTA, {
      ...DEL_PORTAL,
      propina_tipo: 'sin_propina',
      propina_porcentaje: 0,
    });
    expect(sin && textoDelAviso(sin)).toBe('Los comensales eligieron: sin propina');
  });

  it('la del mesero', () => {
    const delMesero = propinaDeOtraPantalla(ABIERTA, { ...DEL_PORTAL, propina_origen: 'mesero' });
    expect(delMesero && textoDelAviso(delMesero)).toBe(
      'El mesero registró 10 % de propina ($52.00)',
    );
  });
});

describe('alUsarEsa', () => {
  it('deja a la vista la propina de la otra pantalla, con su versión', () => {
    const aviso = propinaDeOtraPantalla(ABIERTA, DEL_PORTAL);
    expect(aviso && alUsarEsa(aviso)).toEqual({
      propina_tipo: 'porcentaje',
      propina_porcentaje: 10,
      propina_origen: 'portal_qr',
      propina_monto: 52,
      version: 4,
    });
  });
});

describe('entradaDeFijarPropina', () => {
  it('manda puntos base, nunca un importe', () => {
    expect(
      entradaDeFijarPropina(
        'orden-1',
        4,
        { propina_tipo: 'porcentaje', propina_porcentaje: 12.5 },
        false,
      ),
    ).toEqual({
      ordenId: 'orden-1',
      version: 4,
      propinaTipo: 'porcentaje',
      propinaPuntosBase: 1250,
      cambiar: false,
    });
  });

  it('un 0 % o un tipo que no es una decisión viaja como «sin propina»', () => {
    expect(
      entradaDeFijarPropina('o', 1, { propina_tipo: 'porcentaje', propina_porcentaje: 0 }, false),
    ).toMatchObject({ propinaTipo: 'sin_propina', propinaPuntosBase: 0 });
    expect(
      entradaDeFijarPropina(
        'o',
        1,
        { propina_tipo: 'decidir_en_caja', propina_porcentaje: 10 },
        true,
      ),
    ).toMatchObject({ propinaTipo: 'sin_propina', propinaPuntosBase: 0, cambiar: true });
  });

  it('el monto a mano viaja con su porcentaje derivado, recortado al 100 %', () => {
    expect(
      entradaDeFijarPropina(
        'o',
        1,
        { propina_tipo: 'monto_manual', propina_porcentaje: 250 },
        false,
      ),
    ).toMatchObject({ propinaTipo: 'monto_manual', propinaPuntosBase: 10_000 });
  });
});

describe('quién elige la propina, en la pantalla', () => {
  it('la Caja elige salvo que el negocio lo apague', () => {
    expect(laCajaEligeLaPropina({})).toBe(true);
    expect(laCajaEligeLaPropina(null)).toBe(true);
    expect(laCajaEligeLaPropina({ propina_la_elige_caja: false })).toBe(false);
  });

  it('el mesero no elige salvo que el negocio lo encienda', () => {
    expect(elMeseroEligeLaPropina({})).toBe(false);
    expect(elMeseroEligeLaPropina(undefined)).toBe(false);
    expect(elMeseroEligeLaPropina({ propina_la_elige_mesero: true })).toBe(true);
  });

  it('estaDecidida distingue una elección de un «todavía no»', () => {
    expect(estaDecidida({ propina_tipo: 'porcentaje' })).toBe(true);
    expect(estaDecidida({ propina_tipo: 'sin_propina' })).toBe(true);
    expect(estaDecidida({ propina_tipo: 'pendiente_cliente' })).toBe(false);
    expect(estaDecidida(null)).toBe(false);
  });
});
