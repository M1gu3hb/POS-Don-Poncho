import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MS_DEL_QR_EN_PANTALLA, programarCierre, tituloDelQr } from './qr-en-pantalla';

/** DP-13.4 · El QR en la pantalla se cierra solo a los 60 s y su título dice la mesa. */

describe('el QR se cierra solo', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('a los 60 segundos, ni un milisegundo antes', () => {
    const alCerrar = vi.fn();
    programarCierre(alCerrar);
    expect(MS_DEL_QR_EN_PANTALLA).toBe(60_000);
    vi.advanceTimersByTime(59_999);
    expect(alCerrar).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(alCerrar).toHaveBeenCalledTimes(1);
  });

  it('cierra una sola vez', () => {
    const alCerrar = vi.fn();
    programarCierre(alCerrar);
    vi.advanceTimersByTime(MS_DEL_QR_EN_PANTALLA * 5);
    expect(alCerrar).toHaveBeenCalledTimes(1);
  });

  it('cancelarlo (cerrado a mano) evita el cierre tardío', () => {
    const alCerrar = vi.fn();
    const cancelar = programarCierre(alCerrar);
    vi.advanceTimersByTime(30_000);
    cancelar();
    vi.advanceTimersByTime(MS_DEL_QR_EN_PANTALLA);
    expect(alCerrar).not.toHaveBeenCalled();
  });

  it('acepta otro plazo', () => {
    const alCerrar = vi.fn();
    programarCierre(alCerrar, 5_000);
    vi.advanceTimersByTime(5_000);
    expect(alCerrar).toHaveBeenCalledTimes(1);
  });
});

describe('el título del QR dice la mesa', () => {
  it('con el número desde que abre', () => {
    expect(tituloDelQr({ numero: 5 })).toBe('QR de la mesa 5');
    expect(tituloDelQr({ numero: 12 })).toBe('QR de la mesa 12');
  });

  it('la mesa 0 también es un número', () => {
    expect(tituloDelQr({ numero: 0 })).toBe('QR de la mesa 0');
  });

  it('sin número que decir no deja «undefined» ni un hueco', () => {
    expect(tituloDelQr(null)).toBe('QR de la mesa');
    expect(tituloDelQr({ numero: Number.NaN })).toBe('QR de la mesa');
    expect(tituloDelQr({ numero: undefined as unknown as number })).toBe('QR de la mesa');
  });
});

/**
 * El contrato del componente (no hay navegador en estas pruebas): el cierre se programa por la
 * MESA, no por la función que llega —la pantalla del mesero se vuelve a pintar cada pocos
 * segundos y una dependencia en `alCerrar` reiniciaría el minuto para siempre—, y el título sale
 * de la mesa que se recuerda, no de la que ya se fue.
 */
const RAIZ = process.cwd().endsWith('web') ? process.cwd() : join(process.cwd(), 'apps', 'web');
const componente = readFileSync(
  join(RAIZ, 'src/restaurante/portal-mesero/QrDeLaMesaEnPantalla.tsx'),
  'utf8',
);

describe('QrDeLaMesaEnPantalla', () => {
  it('programa el cierre con la mesa abierta y lo cancela al limpiar', () => {
    expect(componente).toMatch(/programarCierre\(/);
    expect(componente).toMatch(/return programarCierre\(/);
  });

  it('el efecto del cierre depende del id de la mesa y no de `alCerrar`', () => {
    const efecto =
      /useEffect\(\(\) => \{\s*if \(id === null\) return;[\s\S]*?\}, \[([^\]]*)\]\);/.exec(
        componente,
      );
    expect(efecto?.[1]).toBe('id');
  });

  it('el título y el texto de la imagen salen de la mesa recordada', () => {
    expect(componente).toMatch(/tituloDelQr\(/);
    expect(componente).not.toMatch(/mesa\?\.numero/);
    // Mientras el diálogo se cierra `mesa` ya es null: se enseña la última abierta.
    expect(componente).toMatch(/const enPantalla = mesa \?\? recordada;/);
    expect(componente).toMatch(/if \(mesa !== null && mesa !== recordada\) setRecordada\(mesa\);/);
  });

  it('cierra con la función vigente, no con la de cuando se abrió', () => {
    expect(componente).toMatch(/alCerrarVigente\.current = alCerrar;/);
    expect(componente).toMatch(/alCerrarVigente\.current\(\);/);
  });
});
