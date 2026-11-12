import { describe, expect, it } from 'vitest';

import { abiertaDesde, dondeEsta, textoDelCupo } from './cajas-en-otros-aparatos.ts';

/** DP-18 · Cómo dice la Caja que hay otra caja abierta en otro aparato (DP-D111). */
describe('la caja abierta en otro aparato, dicha', () => {
  const ahora = new Date('2026-11-11T17:00:00-06:00');

  it('dónde está: el nombre de la terminal, o «Otro aparato»', () => {
    expect(dondeEsta({ terminalNombre: 'Caja 2' })).toBe('«Caja 2»');
    expect(dondeEsta({ terminalNombre: '  ' })).toBe('Otro aparato');
    expect(dondeEsta({ terminalNombre: null })).toBe('Otro aparato');
  });

  it('desde cuándo, en la hora de CDMX; otro día lleva la fecha', () => {
    expect(abiertaDesde({ abiertaPor: 'Ana', abiertaEn: '2026-11-11T16:14:15Z' }, ahora)).toBe(
      'abierta por Ana desde las 10:14',
    );
    expect(abiertaDesde({ abiertaPor: null, abiertaEn: '2026-11-11T16:14:15Z' }, ahora)).toBe(
      'abierta desde las 10:14',
    );
    expect(abiertaDesde({ abiertaPor: 'Ana', abiertaEn: '2026-11-11T04:05:00Z' }, ahora)).toMatch(
      /^abierta por Ana desde el 10 nov\.? a las 22:05$/,
    );
  });

  it('el cupo: si cabe otra lo ofrece; si no, dice cuántas hay', () => {
    expect(textoDelCupo({ puedoAbrir: true, cupo: 2, abiertas: 1 })).toBe(
      'Hay 1 caja abierta y caben 2: puedes abrir otra aquí o trasladar una.',
    );
    expect(textoDelCupo({ puedoAbrir: false, cupo: 1, abiertas: 1 })).toBe(
      'Ya hay 1 caja abierta de 1: trasládala aquí o ciérrala en su aparato.',
    );
    expect(textoDelCupo({ puedoAbrir: false, cupo: 2, abiertas: 2 })).toMatch(
      /^Ya hay 2 cajas abiertas de 2/,
    );
  });
});
