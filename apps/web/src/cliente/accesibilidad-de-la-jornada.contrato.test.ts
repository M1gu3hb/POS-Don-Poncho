import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

/**
 * LO QUE ENCONTRÓ EL SIMULADOR DE JORNADA (A15, A16, A17), atado al código.
 *
 *   · A15 — la mesa del mapa de tableta/escritorio (`MesaShape`) es un botón: rol, foco y
 *           Enter/Espacio; y «Cambiar de mesa» es UN control, no un botón dentro de un enlace.
 *   · A16 — el diálogo «Portal de la mesa · modo mesero» cabe a 360 px: su columna se encoge
 *           (`minmax(0,1fr)`), el carrito puede achicarse y los renglones se acomodan.
 *   · A17 — los seis campos del pago mixto (venta y propina) tienen su etiqueta asociada.
 *
 * Son contratos de lectura (el repo no pinta pantallas heredadas en pruebas de unidad): se lee
 * el árbol del analizador de TypeScript, sin comentarios y sin espacios, para que reformatear no
 * cuente y un comentario que nombre la pieza no la dé por puesta. La prueba de que muerden está
 * en el informe del corte: cada arreglo se revirtió a mano y su prueba falló.
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
function texto(nodo: ts.Node, fuente: ts.SourceFile): string {
  return impresora
    .printNode(ts.EmitHint.Unspecified, nodo, fuente)
    .replace(/\s+/g, '')
    .replace(/,([)\]}])/g, '$1');
}

function buscar<T extends ts.Node>(
  fuente: ts.SourceFile,
  quiero: (nodo: ts.Node) => nodo is T,
): T[] {
  const halladas: T[] = [];
  const visitar = (nodo: ts.Node): void => {
    if (quiero(nodo)) halladas.push(nodo);
    ts.forEachChild(nodo, visitar);
  };
  visitar(fuente);
  return halladas;
}

/** Los `<Nombre …>…</Nombre>` del archivo (con hijos). */
function elementos(fuente: ts.SourceFile, nombre: string): ts.JsxElement[] {
  return buscar(
    fuente,
    (n): n is ts.JsxElement => ts.isJsxElement(n) && n.openingElement.tagName.getText() === nombre,
  );
}

/** Los atributos de una etiqueta, impresos por nombre (el texto de un atributo sin valor es ''). */
function atributos(
  etiqueta: ts.JsxOpeningElement | ts.JsxSelfClosingElement,
  fuente: ts.SourceFile,
): Record<string, string> {
  const props: Record<string, string> = {};
  for (const a of etiqueta.attributes.properties) {
    if (!ts.isJsxAttribute(a)) continue;
    const valor = a.initializer;
    props[a.name.getText()] =
      valor === undefined
        ? ''
        : ts.isJsxExpression(valor)
          ? valor.expression === undefined
            ? ''
            : texto(valor.expression, fuente)
          : valor.getText(fuente).replace(/^["']|["']$/g, '');
  }
  return props;
}

/** El texto de un elemento, sin etiquetas ni expresiones (lo que se lee como letrero). */
function letrero(el: ts.JsxElement): string {
  return el.children
    .filter(ts.isJsxText)
    .map((t) => t.text)
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

describe('A15 · la mesa del mapa es un botón y «Cambiar de mesa» un solo control', () => {
  const mesa = leer('heredado/components/mesas/MesaShape.jsx');
  const sinEspacios = texto(mesa, mesa);

  it('la mesa con clic lleva rol de botón, foco y el teclado', () => {
    expect(sinEspacios).toContain("role:'button'");
    expect(sinEspacios).toContain('tabIndex:0');
    expect(sinEspacios).toContain('onKeyDown:alTeclear');
    // Enter y Espacio hacen lo que el clic (el texto va sin espacios: «' '» queda como «''»).
    expect(sinEspacios).toContain("e.key!=='Enter'&&e.key!==''");
    expect(sinEspacios).toContain('onClick(e)');
  });

  it('el rol de botón va sólo si hay clic y los globos no quedan dentro de él', () => {
    expect(sinEspacios).toContain("esBoton=typeofonClick==='function'");
    // Los globos son botones: cuelgan de la caja de afuera, antes del elemento con `role`.
    expect(sinEspacios.indexOf('{globos}')).toBeGreaterThan(-1);
    expect(sinEspacios.indexOf('{globos}')).toBeLessThan(sinEspacios.indexOf('esBoton?{role'));
  });

  it('el nombre sale de lo que pinta: el número y el estado, y no los emojis decorativos', () => {
    expect(sinEspacios).toContain('{mesa.numero}');
    expect(sinEspacios).toContain('{cfg.label}');
    const emojis = buscar(mesa, (n): n is ts.JsxElement => ts.isJsxElement(n)).filter((e) =>
      /🎉|⚠️/u.test(letrero(e)),
    );
    expect(emojis).toHaveLength(2);
    for (const e of emojis) expect(atributos(e.openingElement, mesa)).toHaveProperty('aria-hidden');
  });

  for (const ruta of [
    'heredado/pages/Mesero.jsx',
    'heredado/components/mesero/MesaActivaView.jsx',
  ]) {
    it(`${ruta}: ningún botón dentro de un enlace`, () => {
      const fuente = leer(ruta);
      const anidados = elementos(fuente, 'Link').filter(
        (enlace) =>
          elementos(
            ts.createSourceFile(
              'x.jsx',
              enlace.getText(fuente),
              ts.ScriptTarget.Latest,
              true,
              ts.ScriptKind.JSX,
            ),
            'Button',
          ).length > 0,
      );
      expect(anidados.map((a) => a.getText(fuente).slice(0, 80))).toEqual([]);
    });
  }

  it('«Cambiar de mesa» es el enlace con la forma del botón (`Button asChild`)', () => {
    const mesero = leer('heredado/pages/Mesero.jsx');
    const conEnlace = elementos(mesero, 'Button').filter((b) =>
      b.children.some((h) => ts.isJsxElement(h) && h.openingElement.tagName.getText() === 'Link'),
    );
    expect(conEnlace.length).toBeGreaterThan(0);
    for (const b of conEnlace)
      expect(atributos(b.openingElement, mesero)).toHaveProperty('asChild');
  });
});

describe('A16 · el diálogo del portal en modo mesero cabe a 360 px', () => {
  const clases = (ruta: string, etiqueta: string): string[] => {
    const fuente = leer(ruta);
    return buscar(
      fuente,
      (n): n is ts.JsxOpeningElement | ts.JsxSelfClosingElement =>
        (ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) &&
        n.tagName.getText() === etiqueta,
    ).map((e) => atributos(e, fuente)['className'] ?? '');
  };

  it('la columna de la rejilla del diálogo se encoge', () => {
    const [contenido] = clases(
      'src/restaurante/portal-mesero/DialogoDelPortalModoMesero.tsx',
      'DialogContent',
    );
    expect(contenido).toContain('grid-cols-[minmax(0,1fr)]');
  });

  it('el carrito puede achicarse y su pie envuelve', () => {
    const [superficie] = clases(
      'src/restaurante/portal-mesero/CarritoDelPortalParaElMesero.tsx',
      'Superficie',
    );
    expect(superficie).toContain('min-w-0');
    const [pie] = clases(
      'src/restaurante/portal-mesero/CarritoDelPortalParaElMesero.tsx',
      'footer',
    );
    expect(pie).toContain('flex-wrap');
  });

  it('el renglón se acomoda en dos líneas y su nombre no empuja a los demás', () => {
    const fuente = leer('src/restaurante/portal-mesero/RenglonDelCarritoDelMesero.tsx');
    const [li] = elementos(fuente, 'li');
    expect(li).toBeDefined();
    expect(atributos(li!.openingElement, fuente)['className']).toContain('flex-wrap');
    const [nombre] = buscar(
      fuente,
      (n): n is ts.JsxElement =>
        ts.isJsxElement(n) &&
        n.openingElement.tagName.getText() === 'span' &&
        (atributos(n.openingElement, fuente)['className'] ?? '').includes('min-w-0'),
    );
    expect(atributos(nombre!.openingElement, fuente)['className']).toContain('basis-40');
  });
});

describe('A17 · el pago mixto: cada campo con su etiqueta', () => {
  const caja = leer('heredado/pages/Caja.jsx');
  const rotulos = new Set(['Efectivo', 'Tarjeta', 'Transfer.']);
  const etiquetas = elementos(caja, 'Label').filter((l) => rotulos.has(letrero(l)));

  it('hay seis etiquetas (tres de la venta, tres de la propina), todas con `htmlFor`', () => {
    expect(etiquetas).toHaveLength(6);
    for (const l of etiquetas) expect(atributos(l.openingElement, caja)['htmlFor']).toBeTruthy();
  });

  it('ningún `htmlFor` se repite y cada uno es el `id` de un campo', () => {
    const paraId = etiquetas.map((l) => atributos(l.openingElement, caja)['htmlFor']);
    expect(new Set(paraId).size).toBe(6);
    const idsDeCampos = buscar(
      caja,
      (n): n is ts.JsxSelfClosingElement =>
        ts.isJsxSelfClosingElement(n) && n.tagName.getText() === 'NumericInput',
    ).map((c) => atributos(c, caja)['id']);
    for (const id of paraId) expect(idsDeCampos).toContain(id);
  });

  it('los dos grupos se distinguen: cada uno es un fieldset con su legend', () => {
    const grupos = buscar(
      caja,
      (n): n is ts.JsxElement =>
        ts.isJsxElement(n) && n.openingElement.tagName.getText() === 'fieldset',
    );
    const leyendas = grupos.map((g) => texto(g, caja));
    expect(leyendas.some((t) => t.includes('aria-label="Pagodelaventa,pormétodo"'))).toBe(true);
    expect(leyendas.some((t) => t.includes('¿Cómosepagólapropina?'))).toBe(true);
  });
});
