import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  INTRO_DE_LA_GUIA,
  NO_CONTIENEN,
  SECCIONES_DE_LA_GUIA,
  TITULO_DE_LA_GUIA,
  guiaEnMarkdown,
} from './guia-de-recetas-e-inventario.ts';

/**
 * DP-21 · Bloque 17 · LA GUÍA «¿CÓMO FUNCIONA?» DICE LO QUE EL SERVIDOR HACE.
 *
 * Tres cosas, leídas del código y validadas mutándolo:
 *
 *  1 · El documento del cliente (`docs/cliente/GUIA-RECETAS-E-INVENTARIO.md`) es EXACTAMENTE lo que
 *      sale de la fuente del panel: no pueden divergir.
 *  2 · Cada afirmación tiene su ancla —el archivo del servidor o de su prueba y el texto que lo
 *      comprueba—: si el código o la prueba cambian y la guía queda mintiendo, esto falla.
 *  3 · El lenguaje es el de la cocina: corto, sin palabras técnicas, con la marca de Don Poncho.
 */
const RAIZ = join(__dirname, '..', '..', '..', '..');
const leer = (ruta: string): string => readFileSync(join(RAIZ, ruta), 'utf8');

describe('el documento y el panel son la misma guía', () => {
  it('docs/cliente/GUIA-RECETAS-E-INVENTARIO.md es lo que sale de la fuente, carácter por carácter', () => {
    expect(leer('docs/cliente/GUIA-RECETAS-E-INVENTARIO.md')).toBe(guiaEnMarkdown());
  });

  it('el documento trae todos los títulos y todos los pasos del panel', () => {
    const documento = leer('docs/cliente/GUIA-RECETAS-E-INVENTARIO.md');
    expect(documento).toContain(TITULO_DE_LA_GUIA);
    for (const seccion of SECCIONES_DE_LA_GUIA) {
      expect(documento, seccion.id).toContain(seccion.titulo);
      for (const paso of seccion.pasos) expect(documento, seccion.id).toContain(paso);
    }
  });
});

describe('cada afirmación está atada a lo que hace el servidor', () => {
  it('cubre los ocho temas del encargo', () => {
    expect(SECCIONES_DE_LA_GUIA.map((s) => s.id)).toEqual([
      'receta',
      'descuento',
      'cancelar',
      'compra',
      'almacen',
      'conteo',
      'negativo',
      'valor',
    ]);
  });

  for (const seccion of SECCIONES_DE_LA_GUIA) {
    it(`«${seccion.titulo}»: todas sus anclas existen y dicen lo que la guía afirma`, () => {
      expect(seccion.anclas.length).toBeGreaterThan(0);
      for (const ancla of seccion.anclas) {
        expect(existsSync(join(RAIZ, ancla.archivo)), ancla.archivo).toBe(true);
        const texto = leer(ancla.archivo);
        for (const frase of ancla.contiene) {
          expect(texto.includes(frase), `${ancla.archivo} → «${frase}»`).toBe(true);
        }
      }
    });
  }

  it.each(NO_CONTIENEN)('«$archivo» no contiene «$texto»: $porque', ({ archivo, texto }) => {
    expect(leer(archivo).includes(texto)).toBe(false);
  });
});

describe('el lenguaje de la guía', () => {
  const todo = [
    TITULO_DE_LA_GUIA,
    INTRO_DE_LA_GUIA,
    ...SECCIONES_DE_LA_GUIA.flatMap((s) => [s.titulo, s.en_corto, ...s.pasos, s.ejemplo ?? '']),
  ].join('\n');

  it('no habla de Morphiq: la marca es Don Poncho', () => {
    expect(todo).not.toMatch(/morphiq/i);
    expect(todo).toContain('Don Poncho');
  });

  it('no usa palabras técnicas', () => {
    for (const tecnica of [
      'SKU',
      'ledger',
      'kardex',
      'API',
      'endpoint',
      'comando',
      'servidor',
      'base de datos',
      'transacción',
      'insumo_base',
      'estrategia',
      'puntos base',
    ]) {
      expect(todo.includes(tecnica), tecnica).toBe(false);
    }
  });

  it('cada paso es corto (una persona lo lee de pie, en la cocina)', () => {
    for (const s of SECCIONES_DE_LA_GUIA) {
      expect(s.pasos.length, s.id).toBeLessThanOrEqual(7);
      for (const paso of s.pasos) expect(paso.length, `${s.id}: ${paso}`).toBeLessThanOrEqual(260);
    }
  });

  it('los ejemplos son del menú de Don Poncho y no inventan cantidades de una receta', () => {
    const menu = leer('docs/cliente/menu-don-poncho.json');
    for (const nombre of ['Taco suave de barbacoa', 'Barbacoa de horno']) {
      expect(menu).toContain(`"${nombre}"`);
    }
    // El ejemplo de la receta dice que la cantidad la pone la cocina: ni un gramo inventado.
    const receta = SECCIONES_DE_LA_GUIA.find((s) => s.id === 'receta')?.ejemplo ?? '';
    expect(receta).not.toMatch(/\d+\s*(g|gramos|kg|ml|piezas?)\b/);
  });
});

describe('el botón «¿Cómo funciona?» está donde se pidió', () => {
  const botones: readonly [string, RegExp][] = [
    ['apps/web/heredado/pages/Recetas.jsx', /<BotonComoFunciona\b/],
    ['apps/web/heredado/pages/Inventario.jsx', /<BotonComoFunciona\b/],
    ['apps/web/heredado/pages/Compras.jsx', /<BotonComoFunciona\b/],
    ['apps/web/heredado/pages/Productos.jsx', /<BotonComoFunciona\b/],
  ];

  it.each(botones)('%s lo trae', (ruta, patron) => {
    const pagina = leer(ruta);
    expect(pagina).toMatch(patron);
    expect(pagina).toContain("from '~/guias/GuiaDeRecetasEInventario'");
  });

  it('el panel es un Sheet del sistema, con Superficie, y se abre con el foco que ya resuelve el sistema', () => {
    const panel = leer('apps/web/src/guias/GuiaDeRecetasEInventario.tsx');
    expect(panel).toContain("from '@morphiqpos/ui/primitivas/sheet'");
    expect(panel).toMatch(/<Superficie\b/);
    expect(panel).toContain('SECCIONES_DE_LA_GUIA');
    // El foco al abrir lo resuelven las primitivas (`focoAlAbrir`); aquí no se pisa con un `autoFocus`.
    expect(panel).not.toContain('autoFocus');
    expect(leer('packages/ui/src/primitivas/sheet.tsx')).toMatch(
      /onOpenAutoFocus=\{focoAlAbrir\(onOpenAutoFocus\)\}/,
    );
  });
});
