import { IDS_DE_CAMPOS, PAPEL_POR_OMISION, completarPapel } from '@morphiqpos/domain/venta';
import { describe, expect, it } from 'vitest';

import {
  apagadosDe,
  cambiosDelPapel,
  esquemaPapelATuGusto,
  papelATuGustoEn,
} from './papel-a-tu-gusto.ts';

/** DP-21 · Bloque 12 · lo que se lee, lo que se acepta y lo que se audita del papel a tu gusto. */
const apagando = (papel: 'precuenta' | 'ticket', ...campos: (typeof IDS_DE_CAMPOS)[number][]) => {
  const completo = completarPapel(undefined);
  return {
    ...completo,
    [papel]: { ...completo[papel], ...Object.fromEntries(campos.map((c) => [c, false])) },
  };
};

describe('papelATuGustoEn', () => {
  it('sin nada, o con algo que no es un documento, sale todo', () => {
    for (const valores of [
      undefined,
      null,
      5,
      [],
      {},
      { papel_a_tu_gusto: 'x' },
      { papel_a_tu_gusto: [] },
    ]) {
      expect(papelATuGustoEn(valores)).toEqual(PAPEL_POR_OMISION);
    }
  });

  it('lee lo guardado renglón por renglón; lo dañado sale', () => {
    const leido = papelATuGustoEn({
      papel_a_tu_gusto: { ticket: { folio: false, mensaje: 'no' }, precuenta: null },
    });
    expect(leido.ticket.folio).toBe(false);
    expect(leido.ticket.mensaje).toBe(true);
    expect(leido.precuenta.folio).toBe(true);
  });
});

describe('esquemaPapelATuGusto', () => {
  it('pide los dos papeles con todos sus renglones, y es estricto', () => {
    const bueno = completarPapel(undefined);
    expect(esquemaPapelATuGusto.safeParse(bueno).success).toBe(true);
    expect(esquemaPapelATuGusto.safeParse({ ...bueno, extra: 1 }).success).toBe(false);
    expect(esquemaPapelATuGusto.safeParse({ ticket: bueno.ticket }).success).toBe(false);
    const sinUnRenglon = Object.fromEntries(
      Object.entries(bueno.ticket).filter(([campo]) => campo !== 'folio'),
    );
    expect(
      esquemaPapelATuGusto.safeParse({ ...bueno, ticket: sinUnRenglon }).success,
      'le falta un renglón',
    ).toBe(false);
    expect(
      esquemaPapelATuGusto.safeParse({ ...bueno, ticket: { ...bueno.ticket, subtotal: false } })
        .success,
    ).toBe(false);
    expect(
      esquemaPapelATuGusto.safeParse({ ...bueno, ticket: { ...bueno.ticket, logo: 'no' } }).success,
    ).toBe(false);
  });

  it('no tiene renglón para el total, el subtotal, los platillos ni el IVA: no se pueden mandar', () => {
    const bueno = completarPapel(undefined);
    for (const prohibido of ['total', 'subtotal', 'platillos', 'iva']) {
      expect(
        esquemaPapelATuGusto.safeParse({
          ...bueno,
          ticket: { ...bueno.ticket, [prohibido]: false },
        }).success,
        prohibido,
      ).toBe(false);
    }
  });
});

describe('cambiosDelPapel (la auditoría)', () => {
  it('dice qué se apagó y qué se volvió a encender, por papel', () => {
    const antes = apagando('precuenta', 'logo');
    const despues = apagando('ticket', 'folio', 'telefono');
    expect(cambiosDelPapel(antes, despues)).toEqual({
      apagados: ['ticket.telefono', 'ticket.folio'],
      encendidos: ['precuenta.logo'],
    });
    expect(cambiosDelPapel(antes, antes)).toEqual({ apagados: [], encendidos: [] });
  });
});

describe('apagadosDe (lo que va a la auditoría)', () => {
  it('lista lo apagado por nombre, incluida la propina que el saneado redactaría como clave', () => {
    expect(apagadosDe(completarPapel(undefined))).toEqual({ precuenta: [], ticket: [] });
    expect(apagadosDe(apagando('ticket', 'propina', 'folio'))).toEqual({
      precuenta: [],
      ticket: ['folio', 'propina'],
    });
  });
});
