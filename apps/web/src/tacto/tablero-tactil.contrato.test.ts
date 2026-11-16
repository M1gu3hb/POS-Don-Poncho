import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * DP-21 · Bloque 16 · LOS DOS HALLAZGOS DEL TABLERO: el cableado, leído.
 *
 * El barrido midió en el tablero 8 enlaces de la guía de 32 px (con el dedo se fallan) y un importe
 * cortado a 1024 px (`$0.00` con puntos suspensivos en una tarjeta angosta). Se valida mutando.
 */

const RAIZ = process.cwd().endsWith('web') ? process.cwd() : join(process.cwd(), 'apps', 'web');
const leer = (ruta: string): string => readFileSync(join(RAIZ, ruta), 'utf8');

describe('la guía de primeros pasos', () => {
  it('sus enlaces miden 44 px con el dedo (el token), y con ratón la densidad de siempre', () => {
    const guia = leer('heredado/components/dashboard/PrimerosPasosCard.jsx');
    const enlace = guia.slice(guia.indexOf('<Link'), guia.indexOf('</Link>'));
    expect(enlace).toContain('any-pointer-coarse:min-h-(--altura-tactil)');
  });
});

describe('las tarjetas de cifras del tablero', () => {
  const tablero = leer('heredado/pages/Dashboard.jsx');
  const valor = tablero.slice(
    tablero.indexOf('font-heading font-black mt-1') - 60,
    tablero.indexOf('font-heading font-black mt-1') + 140,
  );

  it('el importe no se corta con puntos suspensivos: se parte si no cabe', () => {
    expect(valor).not.toMatch(/\btruncate\b/);
    expect(valor).toMatch(/\bbreak-words\b/);
  });

  it('el icono cede su sitio: la fila se envuelve y el texto tiene un mínimo de renglón', () => {
    expect(tablero).toContain('flex flex-wrap items-start justify-between gap-2');
    expect(tablero).toContain('grow basis-28 min-w-0');
  });
});
