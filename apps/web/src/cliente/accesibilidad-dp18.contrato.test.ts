import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import { nombresParaBotones } from '../restaurante/nombres-para-botones.ts';

/**
 * LO QUE ENCONTRÓ EL SIMULADOR EN DP-18 (A13, A14, A9), atado al código.
 *
 *   · A13 — los «−», «+» y «Quitar» del carrito del mesero dicen de qué platillo son.
 *   · A14 — dos rondas del mismo platillo en «Dividir la cuenta» no dan botones con el mismo nombre.
 *   · A9  — el diálogo de cobro y el de propina no están abiertos a la vez (Radix escondería uno).
 *
 * A13 y A9 son contratos de lectura sobre el árbol de TypeScript (sin comentarios ni espacios);
 * A14 es una prueba unitaria de la función que arma los nombres.
 */

const RAIZ_WEB = process.cwd().endsWith('web') ? process.cwd() : join(process.cwd(), 'apps', 'web');

function leer(ruta: string): ts.SourceFile {
  const archivo = join(RAIZ_WEB, ruta);
  return ts.createSourceFile(
    archivo,
    readFileSync(archivo, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    archivo.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.JSX,
  );
}

const impresora = ts.createPrinter({ removeComments: true });
const texto = (nodo: ts.Node, fuente: ts.SourceFile): string =>
  impresora.printNode(ts.EmitHint.Unspecified, nodo, fuente).replace(/\s+/g, '');

/** Los `<button …>…</button>` del archivo que contienen un icono con ese nombre. */
function botonesConIcono(fuente: ts.SourceFile, icono: string): ts.JsxElement[] {
  const halladas: ts.JsxElement[] = [];
  const visitar = (n: ts.Node): void => {
    if (ts.isJsxElement(n) && n.openingElement.tagName.getText() === 'button') {
      let tiene = false;
      const buscarIcono = (h: ts.Node): void => {
        if (ts.isJsxSelfClosingElement(h) && h.tagName.getText() === icono) tiene = true;
        ts.forEachChild(h, buscarIcono);
      };
      buscarIcono(n);
      if (tiene) halladas.push(n);
    }
    ts.forEachChild(n, visitar);
  };
  visitar(fuente);
  return halladas;
}

function atributo(el: ts.JsxElement, nombre: string, fuente: ts.SourceFile): string | undefined {
  for (const a of el.openingElement.attributes.properties) {
    if (ts.isJsxAttribute(a) && a.name.getText() === nombre) {
      return a.initializer === undefined ? '' : texto(a.initializer, fuente);
    }
  }
  return undefined;
}

describe('A13 · el carrito del mesero: los ± y «Quitar» llevan el nombre del platillo', () => {
  const casos: readonly (readonly [string, string])[] = [
    ['heredado/components/mesero/ProductoFichaExpandible.jsx', 'Minus'],
    ['heredado/components/mesero/ProductoFichaExpandible.jsx', 'Plus'],
    ['heredado/components/mesero/MesaActivaView.jsx', 'Minus'],
    ['heredado/components/mesero/MesaActivaView.jsx', 'Plus'],
  ];
  for (const [ruta, icono] of casos) {
    it(`${ruta} · botón con <${icono}> tiene aria-label con el nombre`, () => {
      const fuente = leer(ruta);
      const botones = botonesConIcono(fuente, icono);
      expect(botones.length).toBeGreaterThanOrEqual(1);
      for (const b of botones) {
        const etiqueta = atributo(b, 'aria-label', fuente);
        expect(etiqueta).toBeDefined();
        expect(etiqueta).toContain('item?.nombre');
      }
    });
  }

  it('«Quitar línea» sigue como title y además dice de qué platillo es', () => {
    const fuente = leer('heredado/components/mesero/ProductoFichaExpandible.jsx');
    const [quitar] = botonesConIcono(fuente, 'X');
    expect(atributo(quitar!, 'title', fuente)).toContain('Quitarlínea');
    expect(atributo(quitar!, 'aria-label', fuente)).toContain('item?.nombre');
  });
});

describe('A14 · Dividir la cuenta: nombres de botón únicos entre rondas', () => {
  const linea = (id: string, nombre: string) => ({ id, nombre, cantidad: 1 });

  it('un platillo repetido lleva el número de ronda, por orden de aparición', () => {
    const nombres = nombresParaBotones([
      linea('a', 'Tacos al pastor'),
      linea('b', 'Refresco'),
      linea('c', 'Tacos al pastor'),
    ]);
    expect(nombres['a']).toBe('Tacos al pastor (ronda 1)');
    expect(nombres['c']).toBe('Tacos al pastor (ronda 2)');
    expect(new Set(Object.values(nombres)).size).toBe(3);
  });

  it('el diálogo da a los botones el nombre único, no `linea.nombre`', () => {
    const fuente = leer('src/restaurante/DividirCuentaDialog.tsx');
    expect(texto(fuente, fuente)).toContain('nombre={nombresDeBotones[linea.id]??linea.nombre}');
  });

  it('un platillo que sale una sola vez conserva su nombre', () => {
    expect(nombresParaBotones([linea('a', 'Refresco')])['a']).toBe('Refresco');
  });
});

describe('A9 · el cobro y la propina no se abren a la vez', () => {
  it('el diálogo de cobro se oculta mientras el de propina está abierto', () => {
    const caja = leer('heredado/pages/Caja.jsx');
    const abiertos: string[] = [];
    const visitar = (n: ts.Node): void => {
      if (ts.isJsxOpeningElement(n) && n.tagName.getText() === 'Dialog') {
        for (const a of n.attributes.properties) {
          if (ts.isJsxAttribute(a) && a.name.getText() === 'open' && a.initializer)
            abiertos.push(texto(a.initializer, caja));
        }
      }
      ts.forEachChild(n, visitar);
    };
    visitar(caja);
    expect(abiertos).toContain('{!!ventaSeleccionada&&!showPropinaCaja}');
  });
});
