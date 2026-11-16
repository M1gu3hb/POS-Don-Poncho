import { describe, expect, it } from 'vitest';

import {
  QUIEN_ELIGE_POR_OMISION,
  decidirPropina,
  propinaDecidida,
  puedeElegir,
  quienLaDecidio,
  quienPuedeElegirEn,
  type PropinaDeLaCuenta,
} from './una-sola-verdad.ts';

/**
 * DP-21 · Bloque 4 · «Si una se elige, se aplica sí o sí; la otra se entera y se cierra» (M11).
 */
const SIN_ELEGIR: PropinaDeLaCuenta = { tipo: null, puntosBase: 0, origen: null };
const DEL_PORTAL: PropinaDeLaCuenta = { tipo: 'porcentaje', puntosBase: 1000, origen: 'portal_qr' };
const DE_LA_CAJA: PropinaDeLaCuenta = { tipo: 'porcentaje', puntosBase: 1500, origen: 'caja' };
const DEL_MESERO: PropinaDeLaCuenta = { tipo: 'porcentaje', puntosBase: 500, origen: 'mesero' };

describe('propinaDecidida', () => {
  it('un porcentaje, un monto a mano y «sin propina» son decisiones', () => {
    expect(propinaDecidida(DEL_PORTAL)).toBe(true);
    expect(propinaDecidida({ tipo: 'monto_manual', puntosBase: 413, origen: 'portal_qr' })).toBe(
      true,
    );
    expect(propinaDecidida({ tipo: 'sin_propina', puntosBase: 0, origen: 'caja' })).toBe(true);
  });

  it('«pendiente», «decidir en caja» y nada todavía no lo son', () => {
    expect(propinaDecidida(SIN_ELEGIR)).toBe(false);
    for (const tipo of ['pendiente', 'pendiente_cliente', 'decidir_en_caja']) {
      expect(propinaDecidida({ tipo, puntosBase: 0, origen: 'pendiente_portal_qr' })).toBe(false);
    }
  });
});

describe('quienLaDecidio', () => {
  it('dice la pantalla que la eligió', () => {
    expect(quienLaDecidio(DEL_PORTAL)).toBe('portal_qr');
    expect(quienLaDecidio(DE_LA_CAJA)).toBe('caja');
    expect(quienLaDecidio(DEL_MESERO)).toBe('mesero');
  });

  it('una cuenta «tradicional» (sin mesero ni portal) es de la Caja', () => {
    expect(quienLaDecidio({ tipo: 'porcentaje', puntosBase: 1000, origen: 'tradicional' })).toBe(
      'caja',
    );
  });

  it('sin decisión no hay autor, diga lo que diga el origen', () => {
    expect(quienLaDecidio(SIN_ELEGIR)).toBeNull();
    expect(
      quienLaDecidio({ tipo: 'pendiente_cliente', puntosBase: 0, origen: 'pendiente_portal_qr' }),
    ).toBeNull();
  });
});

describe('decidirPropina · la primera que se confirma gana', () => {
  it('si nadie había elegido, la que llega se aplica: sea de quien sea', () => {
    for (const quien of ['caja', 'mesero', 'portal_qr'] as const) {
      expect(decidirPropina(SIN_ELEGIR, { quien, cambiar: false })).toEqual({
        aplicar: true,
        esCambio: false,
      });
    }
  });

  it('la Caja eligió primero: el portal no la pisa y se entera de la vigente', () => {
    expect(decidirPropina(DE_LA_CAJA, { quien: 'portal_qr', cambiar: false })).toEqual({
      aplicar: false,
      vigente: DE_LA_CAJA,
    });
  });

  it('el portal eligió primero: la Caja no la pisa en silencio', () => {
    expect(decidirPropina(DEL_PORTAL, { quien: 'caja', cambiar: false })).toEqual({
      aplicar: false,
      vigente: DEL_PORTAL,
    });
  });

  it('…pero la Caja sí puede cambiarla a propósito, y queda como un cambio', () => {
    expect(decidirPropina(DEL_PORTAL, { quien: 'caja', cambiar: true })).toEqual({
      aplicar: true,
      esCambio: true,
    });
  });

  it('«cambiar» es sólo de la Caja: ni el portal ni el mesero pisan la de otro', () => {
    expect(decidirPropina(DE_LA_CAJA, { quien: 'portal_qr', cambiar: true }).aplicar).toBe(false);
    expect(decidirPropina(DEL_PORTAL, { quien: 'mesero', cambiar: true }).aplicar).toBe(false);
    expect(decidirPropina(DEL_MESERO, { quien: 'portal_qr', cambiar: true }).aplicar).toBe(false);
  });

  it('quien la eligió puede arrepentirse antes de cobrar, sin que cuente como pisar a otro', () => {
    expect(decidirPropina(DE_LA_CAJA, { quien: 'caja', cambiar: false })).toEqual({
      aplicar: true,
      esCambio: false,
    });
    expect(decidirPropina(DEL_PORTAL, { quien: 'portal_qr', cambiar: false })).toEqual({
      aplicar: true,
      esCambio: false,
    });
  });

  it('«decidir en caja» del comensal no es una decisión: la Caja elige sin «cambiar»', () => {
    const decidirEnCaja = { tipo: 'decidir_en_caja', puntosBase: 0, origen: 'portal_qr' };
    expect(decidirPropina(decidirEnCaja, { quien: 'caja', cambiar: false })).toEqual({
      aplicar: true,
      esCambio: false,
    });
  });
});

describe('quién puede elegir la propina (M12)', () => {
  it('por omisión: los comensales y la Caja, sin el mesero', () => {
    expect(quienPuedeElegirEn({})).toEqual({ comensales: true, mesero: false, caja: true });
    expect(quienPuedeElegirEn(null)).toEqual(QUIEN_ELIGE_POR_OMISION);
  });

  it('lee las tres casillas; la de los comensales es la que ya tenía el portal', () => {
    expect(
      quienPuedeElegirEn({
        portal_qr_permitir_propina_cliente: false,
        propina_la_elige_mesero: true,
        propina_la_elige_caja: false,
      }),
    ).toEqual({ comensales: false, mesero: true, caja: false });
  });

  it('con las propinas apagadas nadie elige, digan lo que digan las casillas', () => {
    expect(
      quienPuedeElegirEn({
        propinas_activas: false,
        propina_la_elige_mesero: true,
        propina_la_elige_caja: true,
      }),
    ).toEqual({ comensales: false, mesero: false, caja: false });
  });

  it('un valor que no es sí o no cuenta como si no estuviera', () => {
    expect(quienPuedeElegirEn({ propina_la_elige_mesero: 'sí' }).mesero).toBe(false);
    expect(quienPuedeElegirEn({ propina_la_elige_caja: 0 }).caja).toBe(true);
  });

  it('puedeElegir cruza la pantalla con las casillas', () => {
    const sinMesero = { comensales: true, mesero: false, caja: true };
    expect(puedeElegir('mesero', sinMesero)).toBe(false);
    expect(puedeElegir('caja', sinMesero)).toBe(true);
    expect(puedeElegir('portal_qr', sinMesero)).toBe(true);
    expect(puedeElegir('portal_qr', { ...sinMesero, comensales: false })).toBe(false);
  });
});
