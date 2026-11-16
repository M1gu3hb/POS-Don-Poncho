import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * DP-21 · Bloque 9 · O4/M2 · EL MAPA DE MESAS ESCALABLE: el cableado, leído.
 *
 * La cuenta de la escala tiene su prueba unitaria (`escala-del-mapa.test.ts`). Esto comprueba que el
 * mapa del mesero la USA, que escala con `transform` (las posiciones guardadas no se tocan) y que
 * compensa la caja de layout con un contenedor del tamaño ya escalado, que es lo que hace que el
 * desplazamiento funcione. Se valida mutando el código real.
 */

const RAIZ = process.cwd().endsWith('web') ? process.cwd() : join(process.cwd(), 'apps', 'web');
const leer = (ruta: string): string => readFileSync(join(RAIZ, ruta), 'utf8');
const MESERO = leer('heredado/pages/Mesero.jsx');
const MAPA = leer('src/tacto/MapaDeMesas.tsx');

describe('el mapa del mesero usa el mapa escalable', () => {
  it('Mesero pinta <MapaDeMesas> y ya no tiene el alto fijo de 600 con overflow-hidden', () => {
    expect(MESERO).toMatch(/<MapaDeMesas\b/);
    expect(MESERO).not.toMatch(/\bMAP_HEIGHT\b/);
  });

  it('le pasa las cajas que de verdad se pintan (con la caja fundida de las uniones)', () => {
    expect(MESERO).toMatch(/cajasDelMapa\(/);
    expect(MESERO).toMatch(/cajaDeLaUnion\(/);
  });

  it('sigue montando la pulsación larga en el contenedor del mapa', () => {
    expect(MESERO).toMatch(/agarre=\{pulsacionLarga\}/);
    expect(MAPA).toMatch(/\{\.\.\.agarre\}/);
  });

  it('las posiciones guardadas no se tocan: cada MesaShape sigue recibiendo posicion_x/posicion_y', () => {
    expect(MESERO).toMatch(
      /mesa=\{caja \? \{ \.\.\.mesa, posicion_x: caja\.x, posicion_y: caja\.y \} : mesa\}/,
    );
  });
});

describe('el mapa escalable', () => {
  it('usa la cuenta pura y un ResizeObserver', () => {
    expect(MAPA).toMatch(/calcularEscalaDelMapa\(/);
    expect(MAPA).toMatch(/new ResizeObserver\(/);
  });

  it('escala con transform (no con left/top ni con zoom), desde la esquina de arriba a la izquierda', () => {
    expect(MAPA).toMatch(/`scale\(\$\{String\(escala\)\}\)`/);
    expect(MAPA).toMatch(/origin-top-left/);
    expect(MAPA).not.toMatch(/\bzoom\b/);
  });

  it('a escala 1 no pone transform: no cambia nada de lo que ya se veía (ni un bloque de contención)', () => {
    expect(MAPA).toMatch(/escala === 1 \? undefined/);
  });

  it('envuelve el dibujo en un contenedor del tamaño YA escalado, que es el que desplaza', () => {
    expect(MAPA).toMatch(/width: medida\.pantalla\.ancho/);
    expect(MAPA).toMatch(/height: medida\.pantalla\.alto/);
  });

  it('desplaza con el dedo sólo cuando hace falta: overflow-auto si desplaza, y sin él, hidden', () => {
    expect(MAPA).toMatch(/medida\.desplaza \? 'overflow-auto/);
    expect(MAPA).toMatch(/: 'overflow-hidden'/);
    expect(MAPA).toMatch(/overscroll-contain/);
  });

  it('el mapa que se desplaza se puede alcanzar con el teclado y tiene nombre', () => {
    expect(MAPA).toMatch(/tabIndex=\{medida\.desplaza \? 0 : undefined\}/);
    expect(MAPA).toMatch(/aria-label=\{medida\.desplaza \? 'Mapa de mesas' : undefined\}/);
  });

  it('no mide con el ancho de lo que se ve menos la barra: el ancho no depende de si hay scroll', () => {
    expect(MAPA).toMatch(/offsetWidth - 2 \* /);
    expect(MAPA).not.toMatch(/\.clientWidth/);
  });

  it('marca su escala para que las pruebas del navegador la lean', () => {
    expect(MAPA).toMatch(/data-escala=/);
    expect(MAPA).toMatch(/data-mapa-de-mesas/);
  });
});
