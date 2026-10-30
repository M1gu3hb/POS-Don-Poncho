import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { ESTILOS_CONSTRUIDOS, PERILLAS } from './contrato';
import { ESTILOS } from './estilos';
import { leerArchivo, leerReglas, partirSelectores, resolverTokens } from './leerCss';

/**
 * DP-11.4 · EL LENGUAJE DE CAPAS, comprobado sin navegador.
 *
 * Lo que flota es vidrio y lo que está en el piso es sólido; el vidrio pasa solo a superficie
 * opaca cuando el aparato no da o la persona pide menos transparencia; la presión, el tacto y
 * el halo cuelgan de atributos que cualquier estilo lee igual; y `retro` dice lo de su época
 * con tokens, no con componentes propios.
 */

const CARPETA = join(dirname(fileURLToPath(import.meta.url)), '..', 'estilos');
const base = leerArchivo(join(CARPETA, 'base.css'));
const reglas = leerReglas(readFileSync(join(CARPETA, 'lenguaje.css'), 'utf8'));
const CON_VIDRIO: readonly string[] = ['capas', 'aero'];

/** Lo único que puede ser vidrio: lo que flota. Una tarjeta de una lista nunca. */
const LO_QUE_FLOTA = [
  "[data-nivel='3']",
  "[data-nivel='4']",
  "[data-slot='dialog-content']",
  "[data-slot='alert-dialog-content']",
  "[data-slot='sheet-content']",
  "[data-slot='popover-content']",
  "[data-slot='dropdown-menu-content']",
  "[data-capa='flotante']",
  "[data-capa='lateral']",
  '[data-sonner-toast]',
];

function conElevacion(valor: string, ...mas: string[]): Map<string, string> {
  return resolverTokens(base, [':root', `[data-elevacion='${valor}']`, ...mas]);
}

function tokensDelEstilo(estilo: string): Map<string, string> {
  const hoja = leerArchivo(join(CARPETA, `${estilo}.css`));
  return resolverTokens([...base, ...hoja], [':root', `[data-estilo='${estilo}']`]);
}

describe('el vidrio: sólo con capas o aero, y sólo en lo que flota', () => {
  it('capas y aero lo encienden; las demás elevaciones se quedan como estaban', () => {
    for (const valor of PERILLAS.elevacion) {
      const tokens = conElevacion(valor);
      const conVidrio = CON_VIDRIO.includes(valor);
      expect(tokens.get('filtro-vidrio') !== 'none', valor).toBe(conVidrio);
      expect(Number(tokens.get('vidrio-alfa')) < 1, valor).toBe(conVidrio);
    }
  });

  it('un aparato que no da, o que pide menos transparencia, queda sólido con el mismo diseño', () => {
    for (const valor of CON_VIDRIO) {
      const solido = conElevacion(valor, "[data-vidrio='solido']");
      expect(solido.get('filtro-vidrio'), valor).toBe('none');
      expect(solido.get('vidrio-alfa'), valor).toBe('1');
    }
    const pedido = base.find((bloque) => bloque.selector.includes('prefers-reduced-transparency'));
    expect(pedido, 'falta @media (prefers-reduced-transparency: reduce)').toBeDefined();
    expect(pedido?.tokens.get('filtro-vidrio')).toBe('none');
    expect(pedido?.tokens.get('vidrio-alfa')).toBe('1');
  });

  it('lo sólido va DESPUÉS de las elevaciones: con la misma especificidad gana el último', () => {
    const posicion = (prueba: (selector: string) => boolean): number =>
      base.findIndex((bloque) => prueba(bloque.selector));
    const ultimaElevacion = Math.max(
      ...CON_VIDRIO.map((valor) => posicion((s) => s === `[data-elevacion='${valor}']`)),
    );
    expect(posicion((s) => s === "[data-vidrio='solido']")).toBeGreaterThan(ultimaElevacion);
    expect(posicion((s) => s.includes('prefers-reduced-transparency'))).toBeGreaterThan(
      ultimaElevacion,
    );
  });

  it('cada desenfoque usa el token (así lo sólido llega a todos) y cuelga sólo de lo que flota', () => {
    const conDesenfoque = reglas.filter((regla) => regla.cuerpo.includes('backdrop-filter'));
    expect(conDesenfoque.length, 'el lenguaje no pone vidrio en ningún lado').toBeGreaterThan(0);

    const piezas = new Set<string>();
    for (const regla of conDesenfoque) {
      for (const declaracion of regla.cuerpo.split(';')) {
        if (!declaracion.includes('backdrop-filter')) continue;
        expect(declaracion.split(':')[1]?.trim(), regla.selector).toBe('var(--filtro-vidrio)');
      }
      for (const selector of partirSelectores(regla.selector)) {
        const prefijo = CON_VIDRIO.find((valor) =>
          selector.startsWith(`[data-elevacion='${valor}']`),
        );
        expect(prefijo, `${selector}: el vidrio sólo con capas o aero`).toBeDefined();
        const resto = selector.slice(`[data-elevacion='${prefijo ?? ''}']`.length);
        for (const atributo of resto.match(/\[[^\]]+\]/g) ?? []) {
          expect(LO_QUE_FLOTA, `${selector}: ${atributo} no flota`).toContain(atributo);
          piezas.add(atributo);
        }
      }
    }
    for (const pieza of [
      "[data-slot='dialog-content']",
      "[data-nivel='4']",
      "[data-capa='flotante']",
    ]) {
      expect([...piezas], `${pieza} debería ser vidrio`).toContain(pieza);
    }
  });
});

describe('la presión, el tacto y el halo', () => {
  it('la presión es un token: 0.97, y 1 cuando no hay movimiento', () => {
    expect(resolverTokens(base, [':root']).get('escala-presion')).toBe('0.97');
    expect(resolverTokens(base, [':root', "[data-movimiento='nula']"]).get('escala-presion')).toBe(
      '1',
    );
    const reducido = base.find((bloque) => bloque.selector.includes('prefers-reduced-motion'));
    expect(reducido?.tokens.get('escala-presion')).toBe('1');
  });

  it('cuelgan de atributos que cualquier pantalla pone, nunca del nombre de un estilo', () => {
    const selectores = reglas.flatMap((regla) => partirSelectores(regla.selector));
    for (const gancho of ['[data-tacto]', '[data-principal]', '[data-activa]']) {
      expect(
        selectores.some((s) => s.includes(gancho)),
        `nadie lee ${gancho}`,
      ).toBe(true);
    }
    expect(selectores.filter((s) => s.includes('[data-estilo='))).toEqual([]);
  });

  it('apretar algo con tacto escala con el token, y vuelve con la curva de resorte', () => {
    const conTacto = reglas.filter((regla) => regla.selector.includes('[data-tacto]'));
    const apretado = conTacto.filter((regla) => regla.selector.includes(':active'));
    expect(apretado.length).toBeGreaterThan(0);
    for (const regla of apretado) expect(regla.cuerpo).toContain('var(--escala-presion)');
    expect(conTacto.some((regla) => regla.cuerpo.includes('var(--curva-resorte)'))).toBe(true);
  });
});

describe('los estilos del lenguaje nuevo', () => {
  it('morphiq y don-poncho son capas; retro es aero', () => {
    expect(ESTILOS['morphiq']?.perillas.elevacion).toBe('capas');
    expect(ESTILOS['don-poncho']?.perillas.elevacion).toBe('capas');
    expect(ESTILOS['retro']?.perillas.elevacion).toBe('aero');
    expect(ESTILOS['retro']?.nombre).toBe('Retro');
  });

  it('morphiq lleva la marca: negro azulado #0A0E1A y azul eléctrico #1E5BFF', () => {
    const tokens = tokensDelEstilo('morphiq');
    expect(tokens.get('lateral-fondo')).toBe('225 44% 7%');
    expect(tokens.get('primario')).toBe('224 100% 56%');
  });

  it('retro fija el marco y el brillo de gel; los demás estilos los dejan vacíos', () => {
    for (const estilo of ESTILOS_CONSTRUIDOS) {
      const tokens = tokensDelEstilo(estilo);
      const propios = estilo === 'retro';
      for (const token of ['marco-ventana', 'brillo-gel']) {
        expect(tokens.get(token) !== 'none', `${estilo}: ${token}`).toBe(propios);
      }
    }
  });

  it('retro: la tipografía de la época sin descargar nada, y un escritorio de CSS propio', () => {
    const tokens = tokensDelEstilo('retro');
    expect(tokens.get('fuente-ui')).toMatch(/Segoe UI.*Lucida Grande.*Helvetica Neue.*Arial/);
    expect(tokens.get('fondo-escritorio')).toContain('gradient');
    const crudo = readFileSync(join(CARPETA, 'retro.css'), 'utf8');
    expect(crudo).not.toMatch(/@font-face|@import|url\(/);
  });

  it('retro: los títulos van directo sobre el escritorio, así que su cielo y su agua no lo tapan', () => {
    // Los tonos OPACOS del escritorio (sin `/ alfa`) son el cielo y el agua de fondo: en claro
    // la tinta oscura va encima y no bajan de 65 %; en oscuro, la tinta clara, y no pasan de 20 %.
    const hoja = leerArchivo(join(CARPETA, 'retro.css'));
    const claridades = (selectores: string[]): number[] => {
      const escritorio = resolverTokens([...base, ...hoja], selectores).get('fondo-escritorio');
      return [...(escritorio ?? '').matchAll(/hsl\(\d+ \d+% (\d+)%\)/g)].map((m) => Number(m[1]));
    };
    const claro = claridades([':root', "[data-estilo='retro']"]);
    const oscuro = claridades([
      ':root',
      "[data-estilo='retro']",
      "[data-estilo='retro'][data-modo='oscuro']",
    ]);
    expect(claro.length).toBeGreaterThan(0);
    expect(Math.min(...claro)).toBeGreaterThanOrEqual(65);
    expect(oscuro.length).toBeGreaterThan(0);
    expect(Math.max(...oscuro)).toBeLessThanOrEqual(20);
  });
});
