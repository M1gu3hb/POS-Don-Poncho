import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  adondeVa,
  crearArrastreDeUnDedo,
  TOQUE_PX,
  type Agarre,
  type Arrastre,
  type Destinos,
  type Medidas,
} from './arrastre-de-un-dedo';

/**
 * DP-13.4 · UN SEGUNDO DEDO NO MUEVE EL ORIGEN DEL PRIMERO.
 *
 * Con la lógica fuera de React se prueba con objetos planos: dos punteros, dos mesas, y en cada
 * secuencia lo que importa es qué recibe la pantalla (`alArrastrar`), qué se suelta y qué se toca.
 */

const MEDIDAS: Medidas = { escala: 1, anchoDelPlano: 900, altoDelPlano: 500 };
const uno = { id: 'uno', x: 100, y: 100, ancho: 80, alto: 80 };
const dos = { id: 'dos', x: 400, y: 200, ancho: 80, alto: 80 };

const dedo = (pointerId: number, clientX: number, clientY: number) => ({
  pointerId,
  clientX,
  clientY,
});

function agarreVivo(): Agarre & { soltar(): void } {
  let capturado = true;
  return {
    isConnected: true,
    hasPointerCapture: () => capturado,
    soltar() {
      capturado = false;
    },
  };
}

function armar() {
  const arrastres: (Arrastre | null)[] = [];
  const soltadas: { id: string; x: number; y: number }[] = [];
  const tocadas: string[] = [];
  const destinos: Destinos = {
    alArrastrar: (a) => arrastres.push(a),
    alSoltar: (id, x, y) => soltadas.push({ id, x, y }),
    alTocar: (id) => tocadas.push(id),
  };
  return { control: crearArrastreDeUnDedo(), arrastres, soltadas, tocadas, destinos };
}

describe('un dedo lleva la mesa 1:1', () => {
  it('menos que el umbral es un toque: al subir toca la mesa', () => {
    const { control, arrastres, soltadas, tocadas, destinos } = armar();
    expect(control.bajar(uno, dedo(1, 200, 200), agarreVivo())).toBe(true);
    control.mover(uno, dedo(1, 200 + TOQUE_PX - 1, 200), MEDIDAS, false, destinos);
    control.subir(dedo(1, 200, 200), destinos);
    expect(arrastres).toEqual([null]);
    expect(soltadas).toEqual([]);
    expect(tocadas).toEqual(['uno']);
  });

  it('con exactamente el umbral ya es un arrastre, no un toque', () => {
    const { control, arrastres, tocadas, destinos } = armar();
    control.bajar(uno, dedo(1, 200, 200), agarreVivo());
    control.mover(uno, dedo(1, 200 + TOQUE_PX, 200), MEDIDAS, false, destinos);
    expect(arrastres).toEqual([{ id: 'uno', x: 100 + TOQUE_PX, y: 100 }]);
    control.subir(dedo(1, 200 + TOQUE_PX, 200), destinos);
    expect(tocadas).toEqual([]);
  });

  it('al pasar el umbral sigue al dedo y al subir se suelta donde iba', () => {
    const { control, arrastres, soltadas, tocadas, destinos } = armar();
    control.bajar(uno, dedo(1, 200, 200), agarreVivo());
    control.mover(uno, dedo(1, 230, 190), MEDIDAS, false, destinos);
    expect(arrastres).toEqual([{ id: 'uno', x: 130, y: 90 }]);
    control.subir(dedo(1, 230, 190), destinos);
    expect(soltadas).toEqual([{ id: 'uno', x: 130, y: 90 }]);
    expect(tocadas).toEqual([]);
  });

  it('una mesa quieta (la unida) no se arrastra, sólo se toca', () => {
    const { control, arrastres, tocadas, destinos } = armar();
    control.bajar(uno, dedo(1, 200, 200), agarreVivo());
    control.mover(uno, dedo(1, 300, 300), MEDIDAS, true, destinos);
    expect(arrastres).toEqual([]);
    control.subir(dedo(1, 300, 300), destinos);
    expect(tocadas).toEqual(['uno']);
  });

  it('cancelar el gesto a medio arrastre deja la mesa donde iba, sin tocarla', () => {
    const { control, arrastres, soltadas, tocadas, destinos } = armar();
    control.bajar(uno, dedo(1, 200, 200), agarreVivo());
    control.mover(uno, dedo(1, 260, 200), MEDIDAS, false, destinos);
    control.cancelar(dedo(1, 260, 200), destinos);
    expect(arrastres.at(-1)).toBeNull();
    expect(soltadas).toEqual([{ id: 'uno', x: 160, y: 100 }]);
    expect(tocadas).toEqual([]);
  });

  it('cancelar un toque que no se movió no hace nada: ni suelta ni toca', () => {
    const { control, arrastres, soltadas, tocadas, destinos } = armar();
    control.bajar(uno, dedo(1, 200, 200), agarreVivo());
    control.cancelar(dedo(1, 200, 200), destinos);
    expect(arrastres).toEqual([null]);
    expect(soltadas).toEqual([]);
    expect(tocadas).toEqual([]);
  });

  it('perder la captura a medio arrastre también deja la mesa donde iba', () => {
    const { control, arrastres, soltadas, tocadas, destinos } = armar();
    control.bajar(uno, dedo(1, 200, 200), agarreVivo());
    control.mover(uno, dedo(1, 260, 200), MEDIDAS, false, destinos);
    control.perderCaptura(dedo(1, 260, 200), destinos);
    expect(arrastres.at(-1)).toBeNull();
    expect(soltadas).toEqual([{ id: 'uno', x: 160, y: 100 }]);
    expect(tocadas).toEqual([]);
  });

  it('la mesa no se sale del plano', () => {
    const { control, arrastres, destinos } = armar();
    control.bajar(uno, dedo(1, 200, 200), agarreVivo());
    control.mover(uno, dedo(1, -5000, 5000), MEDIDAS, false, destinos);
    expect(arrastres.at(-1)).toEqual({ id: 'uno', x: 0, y: 420 });
  });
});

describe('un segundo dedo no pisa al primero', () => {
  it('al bajar el segundo dedo, el origen del primero sigue siendo el suyo', () => {
    const { control, arrastres, soltadas, destinos } = armar();
    control.bajar(uno, dedo(1, 200, 200), agarreVivo());
    // El segundo dedo baja sobre OTRA mesa y sobre la MISMA: ninguno la toma.
    expect(control.bajar(dos, dedo(2, 500, 300), agarreVivo())).toBe(false);
    expect(control.bajar(uno, dedo(2, 150, 150), agarreVivo())).toBe(false);
    control.mover(uno, dedo(1, 230, 200), MEDIDAS, false, destinos);
    // 1:1 desde el origen del primer dedo (200,200), no desde donde bajó el segundo.
    expect(arrastres).toEqual([{ id: 'uno', x: 130, y: 100 }]);
    control.subir(dedo(1, 230, 200), destinos);
    expect(soltadas).toEqual([{ id: 'uno', x: 130, y: 100 }]);
  });

  it('el segundo dedo no arrastra ni a su mesa ni a la del primero', () => {
    const { control, arrastres, destinos } = armar();
    control.bajar(uno, dedo(1, 200, 200), agarreVivo());
    control.bajar(dos, dedo(2, 500, 300), agarreVivo());
    control.mover(dos, dedo(2, 600, 400), MEDIDAS, false, destinos);
    control.mover(uno, dedo(2, 600, 400), MEDIDAS, false, destinos);
    expect(arrastres).toEqual([]);
  });

  it('que el segundo dedo suba no termina el arrastre del primero', () => {
    const { control, arrastres, soltadas, tocadas, destinos } = armar();
    control.bajar(uno, dedo(1, 200, 200), agarreVivo());
    control.mover(uno, dedo(1, 240, 200), MEDIDAS, false, destinos);
    control.bajar(dos, dedo(2, 500, 300), agarreVivo());
    control.subir(dedo(2, 500, 300), destinos);
    expect(arrastres.at(-1)).toEqual({ id: 'uno', x: 140, y: 100 });
    expect(soltadas).toEqual([]);
    expect(tocadas).toEqual([]);
    control.mover(uno, dedo(1, 260, 200), MEDIDAS, false, destinos);
    control.subir(dedo(1, 260, 200), destinos);
    expect(soltadas).toEqual([{ id: 'uno', x: 160, y: 100 }]);
  });

  it('que el navegador cancele al segundo dedo no termina el arrastre del primero', () => {
    const { control, arrastres, soltadas, destinos } = armar();
    control.bajar(uno, dedo(1, 200, 200), agarreVivo());
    control.mover(uno, dedo(1, 240, 200), MEDIDAS, false, destinos);
    control.cancelar(dedo(2, 500, 300), destinos);
    expect(arrastres.at(-1)).toEqual({ id: 'uno', x: 140, y: 100 });
    expect(soltadas).toEqual([]);
  });

  it('que el segundo dedo pierda la captura no termina el arrastre del primero', () => {
    const { control, arrastres, destinos } = armar();
    control.bajar(uno, dedo(1, 200, 200), agarreVivo());
    control.mover(uno, dedo(1, 240, 200), MEDIDAS, false, destinos);
    control.perderCaptura(dedo(2, 500, 300), destinos);
    expect(arrastres.at(-1)).toEqual({ id: 'uno', x: 140, y: 100 });
  });

  it('terminado el arrastre, otro dedo puede arrastrar otra mesa', () => {
    const { control, soltadas, destinos } = armar();
    control.bajar(uno, dedo(1, 200, 200), agarreVivo());
    control.subir(dedo(1, 200, 200), destinos);
    expect(control.bajar(dos, dedo(2, 500, 300), agarreVivo())).toBe(true);
    control.mover(dos, dedo(2, 540, 300), MEDIDAS, false, destinos);
    control.subir(dedo(2, 540, 300), destinos);
    expect(soltadas).toEqual([{ id: 'dos', x: 440, y: 200 }]);
  });
});

describe('un arrastre sin dueño no bloquea para siempre', () => {
  it('si su mesa salió del documento, el dedo nuevo sí toma una mesa', () => {
    const { control } = armar();
    const fuera: Agarre = { isConnected: false, hasPointerCapture: () => true };
    control.bajar(uno, dedo(1, 200, 200), fuera);
    expect(control.bajar(dos, dedo(2, 500, 300), agarreVivo())).toBe(true);
  });

  it('si el navegador soltó la captura sin avisar, el dedo nuevo sí toma una mesa', () => {
    const { control } = armar();
    const agarre = agarreVivo();
    control.bajar(uno, dedo(1, 200, 200), agarre);
    agarre.soltar();
    expect(control.bajar(dos, dedo(2, 500, 300), agarreVivo())).toBe(true);
  });

  it('el mismo dedo que vuelve a bajar reinicia su origen', () => {
    const { control, arrastres, destinos } = armar();
    control.bajar(uno, dedo(1, 200, 200), agarreVivo());
    expect(control.bajar(uno, dedo(1, 300, 300), agarreVivo())).toBe(true);
    control.mover(uno, dedo(1, 330, 300), MEDIDAS, false, destinos);
    expect(arrastres).toEqual([{ id: 'uno', x: 130, y: 100 }]);
  });
});

describe('a dónde va la mesa (adondeVa)', () => {
  const inicio = { px: 200, py: 300, x0: 50, y0: 60 };

  it('se mueve lo mismo que el dedo entre la escala', () => {
    expect(adondeVa(inicio, { x: 230, y: 290 }, 0.5, { ancho: 900, alto: 500 })).toEqual({
      x: 110,
      y: 40,
    });
  });

  it('no se sale del plano', () => {
    expect(adondeVa(inicio, { x: -500, y: 2000 }, 1, { ancho: 900, alto: 500 })).toEqual({
      x: 0,
      y: 500,
    });
  });
});

/**
 * El envoltorio de React no se pinta en estas pruebas: su contrato lee el texto. Cada evento del
 * puntero va a la lógica de arriba CON su evento (así sabe de qué dedo es), y sólo el dedo que
 * toma la mesa la captura.
 */
describe('use-arrastre-de-mesas', () => {
  const raiz = process.cwd().endsWith('web') ? process.cwd() : join(process.cwd(), 'apps', 'web');
  const gancho = readFileSync(
    join(raiz, 'src/restaurante/unir-mesas/use-arrastre-de-mesas.ts'),
    'utf8',
  );

  it('sólo captura el puntero si la lógica lo tomó (un segundo dedo no se captura)', () => {
    expect(gancho).toMatch(
      /if \(controlador\.bajar\(m, e, e\.currentTarget\)\) e\.currentTarget\.setPointerCapture\(e\.pointerId\);/,
    );
  });

  it.each([
    ['onPointerMove', 'mover(m, e, medidas, quieta, destinos)'],
    ['onPointerUp', 'subir(e, destinos)'],
    ['onPointerCancel', 'cancelar(e, destinos)'],
    ['onLostPointerCapture', 'perderCaptura(e, destinos)'],
  ])('%s se lo pasa a la lógica con su evento', (manejador, llamada) => {
    const cuerpo = new RegExp(
      `${manejador}\\(e: PointerEvent<HTMLElement>\\) \\{\\s*controlador\\.${llamada.replace(/[()]/g, '\\$&')};`,
    );
    expect(gancho).toMatch(cuerpo);
  });
});
