import { describe, expect, it } from 'vitest';

import {
  AVISO_SIN_FOLIO,
  CAMPOS_DEL_PAPEL,
  IDS_DE_CAMPOS,
  LO_QUE_NUNCA_SE_QUITA,
  PAPEL_POR_OMISION,
  avisoAlQuitar,
  camposDelPapel,
  completarPapel,
  papelIgual,
  seEnsena,
} from './campos-del-papel.ts';

/**
 * DP-21 · Bloque 12 · la regla de «el ticket a tu gusto»: qué sale con cada interruptor, y lo que
 * nunca se quita.
 */
describe('qué se enseña', () => {
  it('por omisión sale TODO, en la precuenta y en el ticket', () => {
    for (const papel of ['precuenta', 'ticket'] as const) {
      for (const campo of IDS_DE_CAMPOS) {
        expect(seEnsena(undefined, papel, campo), `${papel} ${campo}`).toBe(true);
        expect(seEnsena({}, papel, campo)).toBe(true);
        expect(seEnsena(PAPEL_POR_OMISION, papel, campo)).toBe(true);
      }
    }
  });

  it('sólo un false explícito lo quita, y sólo en ese papel', () => {
    const elegido = { ticket: { direccion: false } };
    expect(seEnsena(elegido, 'ticket', 'direccion')).toBe(false);
    expect(seEnsena(elegido, 'precuenta', 'direccion')).toBe(true);
    expect(seEnsena(elegido, 'ticket', 'telefono')).toBe(true);
  });

  it('un valor dañado (nulo, texto, número) se lee como «sale»', () => {
    for (const raro of [null, 'no', 0, undefined, []]) {
      expect(seEnsena({ ticket: { mensaje: raro } }, 'ticket', 'mensaje')).toBe(true);
    }
    expect(seEnsena({ ticket: null }, 'ticket', 'mensaje')).toBe(true);
  });

  it('completarPapel llena todos los renglones, conservando lo apagado', () => {
    const completo = completarPapel({ precuenta: { logo: false }, ticket: { folio: false } });
    expect(completo.precuenta.logo).toBe(false);
    expect(completo.ticket.folio).toBe(false);
    expect(Object.keys(completo.ticket)).toEqual([...IDS_DE_CAMPOS]);
    expect(papelIgual(completarPapel(undefined), PAPEL_POR_OMISION)).toBe(true);
    expect(papelIgual(completo, PAPEL_POR_OMISION)).toBe(false);
  });
});

describe('lo que nunca se quita', () => {
  it('ni los platillos, ni el subtotal, ni el TOTAL, ni el IVA tienen interruptor', () => {
    const ids = new Set<string>(IDS_DE_CAMPOS);
    for (const prohibido of ['platillos', 'productos', 'subtotal', 'total', 'iva', 'impuestos']) {
      expect(ids.has(prohibido), prohibido).toBe(false);
    }
    expect(LO_QUE_NUNCA_SE_QUITA).toEqual([
      'los platillos con su importe',
      'el subtotal',
      'el TOTAL',
    ]);
  });

  it('los diecinueve renglones del encargo, sin repetir', () => {
    expect(CAMPOS_DEL_PAPEL).toHaveLength(19);
    expect(new Set(IDS_DE_CAMPOS).size).toBe(19);
  });

  it('la precuenta no ofrece lo del cobro: forma de pago, efectivo recibido y cambio', () => {
    const enLaPrecuenta = camposDelPapel('precuenta').map((c) => c.id);
    for (const delCobro of ['forma_de_pago', 'efectivo_recibido', 'cambio']) {
      expect(enLaPrecuenta).not.toContain(delCobro);
      expect(camposDelPapel('ticket').map((c) => c.id)).toContain(delCobro);
    }
    expect(camposDelPapel('ticket')).toHaveLength(19);
  });
});

describe('quitar el folio', () => {
  it('del ticket de venta se permite con su aviso; de la precuenta o cualquier otro, sin aviso', () => {
    expect(avisoAlQuitar('ticket', 'folio')).toBe(AVISO_SIN_FOLIO);
    expect(AVISO_SIN_FOLIO).toBe('Sin folio, el cliente no podrá reclamar ni pedir factura.');
    expect(avisoAlQuitar('precuenta', 'folio')).toBeNull();
    expect(avisoAlQuitar('ticket', 'telefono')).toBeNull();
  });
});
