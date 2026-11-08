import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { aislarParaImprimir, documentoAImprimir } from './aislar.ts';
import { anchoDeLasClases, anchoDelPapel, medidasDelTicket, paginaDeImpresion } from './papel.ts';

/**
 * DP-15 · F2 (auditoría 2, M7) · EL TICKET POR EL NAVEGADOR EN 58 Y 80 MM, SIN HOJAS EN BLANCO.
 *
 * `print.js` sólo conocía 80 mm o A4; el ticket medía 72 mm fijos (se cortaba en 58) y, dentro de
 * su diálogo, el CSS escondía lo demás con `visibility` (que sigue ocupando hojas) y dejaba el
 * ticket a 434 px del borde: hojas en blanco antes del ticket. Estas pruebas leen el código real
 * (se validan mutándolo) y prueban el aislamiento con un DOM mínimo. La prueba con Chromium real
 * (`page.pdf` en 58 y 80) corre aparte: ver el informe de DP-15 F2.
 */

const RAIZ = process.cwd().endsWith('web') ? process.cwd() : join(process.cwd(), 'apps', 'web');
const leer = (ruta: string): string => readFileSync(join(RAIZ, ruta), 'utf8');

describe('el papel (58 / 80 mm)', () => {
  it('sólo 58 es 58; lo demás es el rollo de siempre', () => {
    expect(anchoDelPapel(58)).toBe(58);
    expect(anchoDelPapel('58')).toBe(58);
    expect(anchoDelPapel(80)).toBe(80);
    for (const raro of [undefined, null, 0, 57, '58mm', {}]) expect(anchoDelPapel(raro)).toBe(80);
  });

  it('la página térmica es del ancho del rollo', () => {
    expect(paginaDeImpresion('thermal', 58)).toBe('@page { size: 58mm auto; margin: 3mm; }');
    expect(paginaDeImpresion('thermal', 80)).toBe('@page { size: 80mm auto; margin: 4mm; }');
    expect(paginaDeImpresion('letter', 58)).toBe('@page { size: A4; margin: 12mm; }');
  });

  it('en 58 el texto útil mide 48 mm y la letra es más chica; en 80, 68 mm', () => {
    expect(medidasDelTicket(58)).toMatchObject({ cajaMm: 52, utilMm: 48 });
    expect(medidasDelTicket(80)).toMatchObject({ cajaMm: 72, utilMm: 68 });
    expect(medidasDelTicket(58).letraPx).toBeLessThan(medidasDelTicket(80).letraPx);
  });

  it('el ticket dice su rollo por su clase', () => {
    expect(anchoDeLasClases('ticket-printable thermal-58 mx-auto')).toBe(58);
    expect(anchoDeLasClases('ticket-printable thermal-80')).toBe(80);
  });
});

describe('print.js usa el rollo y aísla el documento', () => {
  const printJs = leer('heredado/lib/print.js');

  it('la página sale de `paginaDeImpresion` con el ancho del ticket', () => {
    expect(printJs).toMatch(/paginaDeImpresion\(modo, rollo\)/);
    expect(printJs).toMatch(/anchoDeLasClases\(objetivo\.className\)/);
    expect(printJs).not.toMatch(/'@page { size: 80mm/);
  });

  it('aísla el documento antes de imprimir y lo deshace al terminar', () => {
    expect(printJs).toMatch(/aislarParaImprimir\(document, objetivo\)/);
    expect(printJs).toMatch(/deshacerAislado\(\)/);
  });
});

describe('index.css · medidas por rollo y nada que ocupe hojas', () => {
  const css = leer('heredado/index.css');

  it('el ticket de 58 mide 52 mm con letra más chica', () => {
    expect(css).toMatch(
      /html\[data-print-mode='thermal'\] \.ticket-printable\.thermal-58 \{[^}]*width: 52mm !important;[^}]*font-size: 9\.5px !important/,
    );
  });

  it('el de 80 sigue en 72 mm', () => {
    expect(css).toMatch(
      /html\[data-print-mode='thermal'\] \.ticket-printable\.thermal-80 \{[^}]*width: 72mm !important/,
    );
  });

  it('lo que sobra sale del flujo (display: none), no sólo se esconde', () => {
    expect(css).toMatch(/\[data-sin-imprimir\] \{\s*display: none !important;/);
  });

  it('el diálogo del ticket pierde posición y transformación al imprimir', () => {
    expect(css).toMatch(
      /\[data-ruta-impresion\] \{[^}]*position: static !important;[^}]*transform: none !important/,
    );
    expect(css).toMatch(/\[data-objetivo-impresion\] \{?[^}]*position: static !important/);
  });
});

describe('el ticket y la configuración', () => {
  it('PreCuentaTicket toma su ancho del negocio y lo dice en su clase', () => {
    const ticket = leer('heredado/components/tickets/PreCuentaTicket.jsx');
    expect(ticket).toMatch(/anchoDelPapel\(config\?\.ancho_papel_ticket\)/);
    expect(ticket).toMatch(/thermal-\$\{String\(ancho\)\}/);
    expect(ticket).not.toMatch(/maxWidth: '80mm'/);
  });

  it('Configuración ofrece 58 / 80 mm junto a los datos del ticket', () => {
    const pagina = leer('heredado/pages/Configuracion.jsx');
    expect(pagina).toMatch(/ancho_papel_ticket: Number\(e\.target\.value\)/);
    expect(pagina).toContain('<option value={58}>58 mm</option>');
    expect(pagina).toContain('<option value={80}>80 mm</option>');
  });

  it('la precuenta usa el rollo del negocio si nadie le pasa otro', () => {
    const precuenta = leer('src/restaurante/Precuenta.tsx');
    expect(precuenta).toMatch(/const anchoMm = ancho \?\? delNegocio;/);
  });
});

/** Un DOM mínimo: sólo lo que `aislarParaImprimir` toca. */
class Nodo {
  readonly attrs = new Map<string, string>();
  readonly children: Nodo[] = [];
  parentElement: Nodo | null = null;
  constructor(
    readonly tagName: string,
    readonly clases = '',
  ) {}
  add(hijo: Nodo): Nodo {
    hijo.parentElement = this;
    this.children.push(hijo);
    return hijo;
  }
  setAttribute(k: string, v: string): void {
    this.attrs.set(k, v);
  }
  removeAttribute(k: string): void {
    this.attrs.delete(k);
  }
  closest(sel: string): Nodo | null {
    const oculto = sel === '[aria-hidden="true"]';
    if (oculto && this.attrs.get('aria-hidden') === 'true') return this;
    return this.parentElement?.closest(sel) ?? null;
  }
}

function pagina() {
  const body = new Nodo('BODY');
  const raiz = body.add(new Nodo('DIV'));
  const menu = raiz.add(new Nodo('NAV'));
  const portal = body.add(new Nodo('DIV'));
  const fondo = portal.add(new Nodo('DIV'));
  const dialogo = portal.add(new Nodo('DIV'));
  const cuerpo = dialogo.add(new Nodo('DIV'));
  const encabezado = dialogo.add(new Nodo('HEADER'));
  const ticket = cuerpo.add(new Nodo('DIV', 'ticket-printable thermal-58'));
  const estilo = body.add(new Nodo('STYLE'));
  return { body, raiz, menu, portal, fondo, dialogo, cuerpo, encabezado, ticket, estilo };
}

describe('aislarParaImprimir', () => {
  it('quita del flujo todo hermano de la ruta, marca la ruta y deja el ticket', () => {
    const p = pagina();
    aislarParaImprimir({ body: p.body } as never, p.ticket as never);
    for (const sobra of [p.raiz, p.fondo, p.encabezado]) {
      expect(sobra.attrs.has('data-sin-imprimir')).toBe(true);
    }
    for (const ruta of [p.portal, p.dialogo, p.cuerpo]) {
      expect(ruta.attrs.has('data-ruta-impresion')).toBe(true);
      expect(ruta.attrs.has('data-sin-imprimir')).toBe(false);
    }
    expect(p.ticket.attrs.has('data-objetivo-impresion')).toBe(true);
    expect(p.ticket.attrs.has('data-sin-imprimir')).toBe(false);
    // Los estilos no estorban y no se tocan.
    expect(p.estilo.attrs.size).toBe(0);
  });

  it('lo deshace por completo', () => {
    const p = pagina();
    const deshacer = aislarParaImprimir({ body: p.body } as never, p.ticket as never);
    deshacer();
    for (const n of [p.raiz, p.fondo, p.encabezado, p.portal, p.dialogo, p.cuerpo, p.ticket]) {
      expect(n.attrs.size).toBe(0);
    }
  });

  it('elige el documento visible, no la copia fuera de pantalla', () => {
    const copia = new Nodo('DIV', 'ticket-printable thermal-80');
    const oculto = new Nodo('DIV');
    oculto.setAttribute('aria-hidden', 'true');
    oculto.add(copia);
    const visible = new Nodo('DIV', 'ticket-printable thermal-58');
    const doc = { querySelectorAll: () => [copia, visible] };
    expect(documentoAImprimir(doc as never, '.ticket-printable')).toBe(visible);
  });
});
