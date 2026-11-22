import { describe, expect, it } from 'vitest';

import {
  alConfirmarElAgregado,
  crearLanzador,
  ESCALON_MS,
  planearBolita,
  SE_AGREGO,
  TOPE_DE_BOLITAS,
  VUELO_MS,
  type Entorno,
  type Punto,
} from './bolita';

/**
 * LA BOLITA DE «AGREGADO AL PEDIDO» (DP-25 · Parte 5) · la lógica, sin DOM.
 * Un entorno falso anota lo que se le pide: cuántas bolitas volaron, con qué retardo, y cuántos rebotes.
 */

const ORIGEN: Punto = { x: 100, y: 400 };
const DESTINO: Punto = { x: 300, y: 700 };

interface Vuelo {
  readonly retardoMs: number;
  readonly desde: Punto;
  readonly hasta: Punto;
  readonly terminar: () => void;
}

function entornoFalso(
  parcial: Partial<{
    reducido: boolean;
    hayWaapi: boolean;
    hayCuadros: boolean;
    destino: Punto | null;
    ahora: number;
  }> = {},
) {
  const estado = { ahora: parcial.ahora ?? 1_000 };
  const vuelos: Vuelo[] = [];
  let rebotes = 0;
  const entorno: Entorno = {
    ahora: () => estado.ahora,
    reducido: () => parcial.reducido ?? false,
    hayWaapi: () => parcial.hayWaapi ?? true,
    hayCuadros: () => parcial.hayCuadros ?? true,
    destino: () => (parcial.destino === undefined ? DESTINO : parcial.destino),
    volar: (desde, hasta, retardoMs, alTerminar) => {
      vuelos.push({ retardoMs, desde, hasta, terminar: alTerminar });
    },
    rebotar: () => {
      rebotes += 1;
    },
  };
  return { entorno, estado, vuelos, rebotes: () => rebotes };
}

describe('planearBolita', () => {
  const base = {
    destino: DESTINO,
    activas: 0,
    ultimaSalida: null,
    ahora: 1_000,
    reducido: false,
    hayWaapi: true,
    hayCuadros: true,
  } as const;

  it('vuela cuando hay destino y nada lo impide', () => {
    expect(planearBolita(base)).toEqual({ tipo: 'vuelo', retardoMs: 0 });
  });

  it('no hace nada si no hay a dónde ir (la barra del pedido no se ve)', () => {
    expect(planearBolita({ ...base, destino: null })).toEqual({ tipo: 'nada' });
  });

  it('con movimiento reducido sólo rebota el número', () => {
    expect(planearBolita({ ...base, reducido: true })).toEqual({ tipo: 'rebote' });
  });

  it('pasado el tope de bolitas a la vez, sólo rebota', () => {
    expect(planearBolita({ ...base, activas: TOPE_DE_BOLITAS })).toEqual({ tipo: 'rebote' });
    expect(planearBolita({ ...base, activas: TOPE_DE_BOLITAS - 1 }).tipo).toBe('vuelo');
  });

  it('sin la API de animación ni cuadros de animación, sólo rebota', () => {
    expect(planearBolita({ ...base, hayWaapi: false, hayCuadros: false })).toEqual({
      tipo: 'rebote',
    });
    expect(planearBolita({ ...base, hayWaapi: false }).tipo).toBe('vuelo');
    expect(planearBolita({ ...base, hayCuadros: false }).tipo).toBe('vuelo');
  });

  it('una bolita que sale pegada a la anterior espera su escalón', () => {
    const plan = planearBolita({ ...base, ultimaSalida: 1_000 - 20 });
    expect(plan).toEqual({ tipo: 'vuelo', retardoMs: ESCALON_MS - 20 });
  });

  it('el vuelo dura menos de 400 ms', () => {
    expect(VUELO_MS).toBeLessThan(400);
  });
});

describe('crearLanzador', () => {
  it('tres toques seguidos son tres bolitas, una tras otra', () => {
    const { entorno, vuelos } = entornoFalso();
    const lanzar = crearLanzador(entorno);
    lanzar(ORIGEN);
    lanzar(ORIGEN);
    lanzar(ORIGEN);
    expect(vuelos).toHaveLength(3);
    expect(vuelos.map((v) => v.retardoMs)).toEqual([0, ESCALON_MS, ESCALON_MS * 2]);
    expect(vuelos[0]?.desde).toEqual(ORIGEN);
    expect(vuelos[0]?.hasta).toEqual(DESTINO);
  });

  it('al aterrizar una bolita, el número rebota y libera su lugar', () => {
    const { entorno, vuelos, rebotes } = entornoFalso();
    const lanzar = crearLanzador(entorno);
    lanzar(ORIGEN);
    expect(rebotes()).toBe(0);
    vuelos[0]?.terminar();
    expect(rebotes()).toBe(1);
  });

  it('con el tope lleno la siguiente no vuela y sólo rebota; al aterrizar una, vuelve a volar', () => {
    const { entorno, estado, vuelos, rebotes } = entornoFalso();
    const lanzar = crearLanzador(entorno);
    for (let i = 0; i < TOPE_DE_BOLITAS; i++) {
      estado.ahora += 1_000;
      lanzar(ORIGEN);
    }
    expect(vuelos).toHaveLength(TOPE_DE_BOLITAS);
    estado.ahora += 1_000;
    lanzar(ORIGEN);
    expect(vuelos).toHaveLength(TOPE_DE_BOLITAS);
    expect(rebotes()).toBe(1);
    vuelos[0]?.terminar();
    estado.ahora += 1_000;
    lanzar(ORIGEN);
    expect(vuelos).toHaveLength(TOPE_DE_BOLITAS + 1);
  });

  it('con movimiento reducido no vuela ninguna y rebota en el acto', () => {
    const { entorno, vuelos, rebotes } = entornoFalso({ reducido: true });
    const lanzar = crearLanzador(entorno);
    lanzar(ORIGEN);
    lanzar(ORIGEN);
    expect(vuelos).toHaveLength(0);
    expect(rebotes()).toBe(2);
  });

  it('sin WAAPI pero con cuadros de animación sigue volando (el motor viejo)', () => {
    const { entorno, vuelos } = entornoFalso({ hayWaapi: false });
    crearLanzador(entorno)(ORIGEN);
    expect(vuelos).toHaveLength(1);
  });

  it('sin WAAPI ni cuadros de animación sólo rebota', () => {
    const { entorno, vuelos, rebotes } = entornoFalso({ hayWaapi: false, hayCuadros: false });
    crearLanzador(entorno)(ORIGEN);
    expect(vuelos).toHaveLength(0);
    expect(rebotes()).toBe(1);
  });

  it('sin destino visible no hace nada ni lanza error', () => {
    const { entorno, vuelos, rebotes } = entornoFalso({ destino: null });
    expect(() => {
      crearLanzador(entorno)(ORIGEN);
    }).not.toThrow();
    expect(vuelos).toHaveLength(0);
    expect(rebotes()).toBe(0);
  });

  it('SE_AGREGO es el único valor que pide bolita', () => {
    expect(SE_AGREGO).toBe('se-agrego');
  });
});

describe('alConfirmarElAgregado', () => {
  it('con un resultado síncrono SE_AGREGO avisa en el acto', () => {
    const avisos: string[] = [];
    alConfirmarElAgregado(SE_AGREGO, () => avisos.push('a'));
    expect(avisos).toEqual(['a']);
  });

  it('cualquier otro resultado (undefined, true, false, otro texto) no avisa', () => {
    const avisos: string[] = [];
    for (const valor of [undefined, true, false, 'otro', 1, null]) {
      alConfirmarElAgregado(valor, () => avisos.push('x'));
    }
    expect(avisos).toEqual([]);
  });

  it('con una promesa avisa cuando se resuelve con SE_AGREGO, no antes', async () => {
    const avisos: string[] = [];
    let resolver: (v: unknown) => void = () => undefined;
    const promesa = new Promise((r) => {
      resolver = r;
    });
    alConfirmarElAgregado(promesa, () => avisos.push('a'));
    expect(avisos).toEqual([]);
    resolver(SE_AGREGO);
    await promesa;
    await Promise.resolve();
    expect(avisos).toEqual(['a']);
  });

  it('una promesa que se resuelve sin SE_AGREGO (opciones, agotado) no avisa', async () => {
    const avisos: string[] = [];
    const promesa = Promise.resolve(undefined);
    alConfirmarElAgregado(promesa, () => avisos.push('x'));
    await promesa;
    await Promise.resolve();
    expect(avisos).toEqual([]);
  });

  it('una promesa rechazada no avisa y el rechazo sigue siendo de quien llamó', async () => {
    const avisos: string[] = [];
    const promesa = Promise.reject(new Error('falló'));
    alConfirmarElAgregado(promesa, () => avisos.push('x'), { yaSeAtiendeElRechazo: true });
    await expect(promesa).rejects.toThrow('falló');
    await Promise.resolve();
    expect(avisos).toEqual([]);
  });
});
