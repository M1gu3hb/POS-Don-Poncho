import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { crearGloboSostenido } from './globo-sostenido';
import {
  MS_PARA_MANTENER,
  mesaDeLaPulsacion,
  SELECTOR_DE_GLOBO,
  TOLERANCIA_PX,
  type ElementoDelMapa,
} from './portal-mesero/pulsacion-larga';

/**
 * DP-13.4 · MANTENER PRESIONADO UN GLOBO ATIENDE LA SOLICITUD Y NO ABRE EL MENÚ DE LA MESA.
 */

/** Un documento mínimo: cada nodo tiene su padre y sus atributos; `closest` sube por los padres. */
class Nodo implements ElementoDelMapa {
  private readonly atributos: Readonly<Record<string, string>>;
  private readonly padre: Nodo | null;

  constructor(atributos: Readonly<Record<string, string>> = {}, padre: Nodo | null = null) {
    this.atributos = atributos;
    this.padre = padre;
  }

  hijo(atributos: Readonly<Record<string, string>> = {}): Nodo {
    return new Nodo(atributos, this);
  }

  closest(selectores: string): Nodo | null {
    const atributo = /^\[([\w-]+)\]$/.exec(selectores)?.[1];
    if (atributo === undefined) throw new Error(`Selector no soportado: ${selectores}`);
    if (atributo in this.atributos) return this;
    return this.padre?.closest(selectores) ?? null;
  }

  getAttribute(nombre: string): string | null {
    return this.atributos[nombre] ?? null;
  }
}

describe('qué mesa es lo que se mantuvo presionado', () => {
  const mapa = new Nodo();
  const caja = mapa.hijo({ 'data-mesa-id': 'mesa-5' });

  it('la caja de la mesa y lo que lleva dentro son la mesa', () => {
    expect(mesaDeLaPulsacion(caja)).toBe('mesa-5');
    expect(mesaDeLaPulsacion(caja.hijo())).toBe('mesa-5');
    expect(mesaDeLaPulsacion(caja.hijo().hijo())).toBe('mesa-5');
  });

  it('lo que está dentro de un globo de solicitud NO es la mesa, aunque cuelgue de su caja', () => {
    const globos = caja.hijo({ 'data-globo-de-solicitud': '' });
    const boton = globos.hijo();
    expect(mesaDeLaPulsacion(globos)).toBeNull();
    expect(mesaDeLaPulsacion(boton)).toBeNull();
    expect(mesaDeLaPulsacion(boton.hijo())).toBeNull();
  });

  it('el fondo del mapa no es una mesa, ni lo que no existe', () => {
    expect(mesaDeLaPulsacion(mapa)).toBeNull();
    expect(mesaDeLaPulsacion(mapa.hijo())).toBeNull();
    expect(mesaDeLaPulsacion(null)).toBeNull();
  });

  it('la marca del globo es la que pinta el componente', () => {
    expect(SELECTOR_DE_GLOBO).toBe('[data-globo-de-solicitud]');
    const raiz = process.cwd().endsWith('web') ? process.cwd() : join(process.cwd(), 'apps', 'web');
    const componente = readFileSync(join(raiz, 'src/restaurante/GlobosDeSolicitud.tsx'), 'utf8');
    expect(componente).toMatch(/<div\s+data-globo-de-solicitud\b/);
  });
});

describe('mantener presionado un globo atiende', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('atiende al cumplirse el tiempo, sin esperar a que el dedo se levante', () => {
    const atender = vi.fn();
    const globo = crearGloboSostenido();
    globo.bajar(100, 100, atender);
    vi.advanceTimersByTime(MS_PARA_MANTENER - 1);
    expect(atender).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(atender).toHaveBeenCalledTimes(1);
  });

  it('un toque corto no lo atiende por el reloj: lo atiende el clic de siempre', () => {
    const atender = vi.fn();
    const globo = crearGloboSostenido();
    globo.bajar(100, 100, atender);
    vi.advanceTimersByTime(MS_PARA_MANTENER - 100);
    globo.cancelar();
    vi.advanceTimersByTime(MS_PARA_MANTENER);
    expect(atender).not.toHaveBeenCalled();
    expect(globo.tirarElClic()).toBe(false);
  });

  it('deslizar el dedo más que la tolerancia cancela; un temblor no', () => {
    const atender = vi.fn();
    const globo = crearGloboSostenido();
    globo.bajar(100, 100, atender);
    globo.mover(100 + TOLERANCIA_PX, 100);
    vi.advanceTimersByTime(MS_PARA_MANTENER);
    expect(atender).toHaveBeenCalledTimes(1);

    const otro = vi.fn();
    globo.bajar(100, 100, otro);
    globo.mover(100 + TOLERANCIA_PX + 1, 100);
    vi.advanceTimersByTime(MS_PARA_MANTENER * 2);
    expect(otro).not.toHaveBeenCalled();
  });

  it('el clic que llega al soltar, después de mantener, se tira una sola vez', () => {
    const globo = crearGloboSostenido();
    globo.bajar(100, 100, vi.fn());
    vi.advanceTimersByTime(MS_PARA_MANTENER);
    expect(globo.tirarElClic()).toBe(true);
    expect(globo.tirarElClic()).toBe(false);
  });

  it('volver a bajar el dedo olvida el clic pendiente: el siguiente toque sí atiende', () => {
    const globo = crearGloboSostenido();
    globo.bajar(100, 100, vi.fn());
    vi.advanceTimersByTime(MS_PARA_MANTENER);
    globo.bajar(100, 100, vi.fn());
    expect(globo.tirarElClic()).toBe(false);
  });

  it('bajar dos veces seguidas deja un solo reloj', () => {
    const atender = vi.fn();
    const globo = crearGloboSostenido();
    globo.bajar(100, 100, atender);
    vi.advanceTimersByTime(MS_PARA_MANTENER / 2);
    globo.bajar(100, 100, atender);
    vi.advanceTimersByTime(MS_PARA_MANTENER);
    expect(atender).toHaveBeenCalledTimes(1);
  });
});

describe('el componente de los globos', () => {
  const raiz = process.cwd().endsWith('web') ? process.cwd() : join(process.cwd(), 'apps', 'web');
  const componente = readFileSync(join(raiz, 'src/restaurante/GlobosDeSolicitud.tsx'), 'utf8');

  it('cada globo manda sus punteros al reloj de mantener y tira el clic que ya atendió', () => {
    expect(componente).toMatch(/crearGloboSostenido/);
    expect(componente).toMatch(/onPointerDown=/);
    expect(componente).toMatch(/onPointerMove=/);
    expect(componente).toMatch(/onPointerUp=/);
    expect(componente).toMatch(/onPointerCancel=/);
    expect(componente).toMatch(/tirarElClic\(\)/);
  });

  it('el menú del navegador no se abre sobre un globo', () => {
    expect(componente).toMatch(/onContextMenu=\{[^}]*preventDefault\(\)/);
  });

  it('el clic de un globo nunca llega a la mesa de abajo', () => {
    expect(componente).toMatch(/evento\.stopPropagation\(\)/);
  });

  it('si el globo se va a media pulsación, el reloj se cancela al desmontarse', () => {
    expect(componente).toMatch(/useEffect\(\(\) => sostenido\.cancelar, \[sostenido\]\);/);
  });
});

describe('la pulsación larga del mapa', () => {
  const raiz = process.cwd().endsWith('web') ? process.cwd() : join(process.cwd(), 'apps', 'web');
  const gancho = readFileSync(
    join(raiz, 'src/restaurante/portal-mesero/use-pulsacion-larga.ts'),
    'utf8',
  );

  it('reconoce la mesa con `mesaDeLaPulsacion`, que deja fuera a los globos', () => {
    expect(gancho).toMatch(/destino instanceof Element \? mesaDeLaPulsacion\(destino\) : null;/);
    expect(gancho).not.toMatch(/closest\('\[data-mesa-id\]'\)/);
  });

  it('un clic por tirar de la pulsación anterior no se come el siguiente toque', () => {
    // Se olvida ANTES de mirar qué se tocó: también si lo tocado es un globo.
    expect(gancho).toMatch(/tirarElClic\.current = false;\s*const mesaId = mesaDe\(e\.target\);/);
  });
});
