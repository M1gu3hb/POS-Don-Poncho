import { describe, expect, it } from 'vitest';

import {
  cajaYDonde,
  cualCaja,
  porQuienYDesde,
  textoDeAbrir,
  textoDeTraer,
} from './cajas-en-otros-aparatos';

/**
 * DP-21 · Bloque 5 · La pantalla dice la CAJA por su nombre y el aparato aparte (M1).
 */
describe('la caja por su nombre', () => {
  const principal = {
    lugar: 1,
    nombreDeLaCaja: 'Caja principal',
    terminalNombre: 'iMin mostrador',
  };

  it('«Caja principal · abierta en «iMin mostrador»»', () => {
    expect(cajaYDonde(principal)).toBe('Caja principal · abierta en «iMin mostrador»');
  });

  it('sin nombre de aparato, «abierta en otro aparato»', () => {
    expect(cajaYDonde({ ...principal, terminalNombre: null })).toBe(
      'Caja principal · abierta en otro aparato',
    );
  });

  it('el nombre nunca es el del aparato: 20 aparatos, la misma caja', () => {
    const vistos = new Set<string>();
    for (let n = 1; n <= 20; n += 1) {
      vistos.add(cualCaja({ ...principal, terminalNombre: `Aparato ${String(n)}` } as never));
    }
    expect([...vistos]).toEqual(['Caja principal']);
  });

  it('una sesión de antes (sin lugar) es «La caja», no el nombre de su aparato', () => {
    expect(cualCaja({ lugar: null, nombreDeLaCaja: 'Caja 33' })).toBe('La caja');
    expect(cualCaja({})).toBe('La caja');
    expect(cajaYDonde({ lugar: null, nombreDeLaCaja: 'Caja 33', terminalNombre: 'Caja 33' })).toBe(
      'La caja · abierta en «Caja 33»',
    );
  });

  it('«Traer Caja principal a este aparato» y «Abrir Caja 2 aquí»', () => {
    expect(textoDeTraer(principal)).toBe('Traer Caja principal a este aparato');
    expect(textoDeTraer({ lugar: null })).toBe('Traer la caja a este aparato');
    expect(textoDeAbrir({ nombre: 'Caja 2' })).toBe('Abrir Caja 2 aquí');
  });

  it('quién y desde cuándo, sin repetir «abierta»', () => {
    const ahora = new Date('2026-11-16T18:00:00Z');
    expect(porQuienYDesde({ abiertaPor: 'Ana', abiertaEn: '2026-11-16T16:14:00Z' }, ahora)).toBe(
      'por Ana desde las 10:14',
    );
    expect(porQuienYDesde({ abiertaPor: null, abiertaEn: '2026-11-16T16:14:00Z' }, ahora)).toBe(
      'desde las 10:14',
    );
  });
});
