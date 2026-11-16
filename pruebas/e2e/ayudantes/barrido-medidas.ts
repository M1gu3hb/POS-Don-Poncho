import type { Page } from '@playwright/test';

/**
 * DP-21 · Bloque 16 · LO QUE SE MIDE EN CADA PANTALLA DEL BARRIDO.
 *
 * Una sola función que corre DENTRO de la página y devuelve hallazgos con datos (selector, medidas),
 * para que el barrido falle diciendo qué y dónde. El criterio es el del encargo:
 *
 *  · `desborde`   — la página se desplaza a lo ancho;
 *  · `boton`      — un blanco táctil (botón, enlace, campo, pestaña) de menos de 44 px;
 *  · `cortado`    — un texto que no cabe en su caja (`scrollWidth > clientWidth` con recorte);
 *  · `fila`       — tarjetas de una misma fila de distinto alto;
 *  · `campos`     — campos de una misma fila que no se alinean por su caja;
 *  · `tapado`     — algo interactivo a la vista que otra cosa tapa (la barra, el teclado, un velo).
 *
 * Si hay un diálogo abierto, sólo se mide lo de dentro (lo de atrás está tapado a propósito).
 */

export type TipoDeHallazgo = 'desborde' | 'boton' | 'cortado' | 'fila' | 'campos' | 'tapado';

export interface Hallazgo {
  readonly tipo: TipoDeHallazgo;
  readonly donde: string;
  readonly detalle: string;
}

export interface OpcionesDeMedida {
  /** El alto del teclado en pantalla que se simula (px): lo de abajo no se ve. */
  readonly tecladoPx: number;
}

export async function medirLaPantalla(
  page: Page,
  opciones: OpcionesDeMedida = { tecladoPx: 0 },
): Promise<Hallazgo[]> {
  return page.evaluate((op) => {
    const MIN = 44;
    const hallazgos: { tipo: string; donde: string; detalle: string }[] = [];
    const dialogo = document.querySelector<HTMLElement>(
      '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]',
    );
    const raiz: ParentNode = dialogo ?? document.body;
    const vista = { ancho: innerWidth, alto: innerHeight - op.tecladoPx };

    const nombre = (e: Element): string => {
      const texto = (e.getAttribute('aria-label') ?? e.textContent ?? '')
        .trim()
        .replace(/\s+/g, ' ');
      const id = e.id !== '' ? `#${e.id}` : '';
      return `${e.tagName.toLowerCase()}${id}«${texto.slice(0, 28)}»`;
    };
    /** ¿Lo recorta un contenedor que se desplaza (su centro cae fuera de la caja del contenedor)? */
    const recortada = (e: Element): boolean => {
      const c = e.getBoundingClientRect();
      const [x, y] = [c.left + c.width / 2, c.top + c.height / 2];
      for (let p = e.parentElement; p !== null && p !== document.body; p = p.parentElement) {
        const est = getComputedStyle(p);
        if (est.overflowX === 'visible' && est.overflowY === 'visible') continue;
        const pc = p.getBoundingClientRect();
        if (x < pc.left || x > pc.right || y < pc.top || y > pc.bottom) return true;
      }
      return false;
    };
    const visible = (e: Element): DOMRect | null => {
      const est = getComputedStyle(e);
      if (est.visibility === 'hidden' || est.display === 'none' || Number(est.opacity) === 0)
        return null;
      const c = e.getBoundingClientRect();
      if (c.width < 1 || c.height < 1) return null;
      if (c.bottom < 0 || c.right < 0 || c.top > innerHeight || c.left > innerWidth) return null;
      if (recortada(e)) return null;
      return c;
    };
    const enLaPagina = (e: Element): boolean =>
      raiz.contains(e) && !e.closest('[aria-hidden="true"]');

    // 1 · desborde de la página
    const de = document.documentElement;
    if (de.scrollWidth > innerWidth + 1) {
      const culpables = Array.from(document.body.querySelectorAll('*'))
        .filter((e) => e.getBoundingClientRect().right > innerWidth + 1 && !recortada(e))
        .slice(0, 3)
        .map((e) => `${nombre(e)} →${String(Math.round(e.getBoundingClientRect().right))}`);
      hallazgos.push({
        tipo: 'desborde',
        donde: 'página',
        detalle: `scrollWidth ${String(de.scrollWidth)} > ${String(innerWidth)}: ${culpables.join(' · ')}`,
      });
    }

    // 2 · blancos táctiles de menos de 44 px
    const blancos = raiz.querySelectorAll<HTMLElement>(
      'button, a[href], [role="button"], [role="tab"], [role="menuitem"], [role="option"], input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]), select, textarea, [role="combobox"]',
    );
    for (const b of Array.from(blancos)) {
      if (!enLaPagina(b) || b.closest('[data-barrido-ignora]') !== null) continue;
      // Interruptores y casillas: su caja es el riel; el blanco es un área de 44 px (`blancos-tactiles.css`).
      if (['switch', 'checkbox'].includes(b.getAttribute('role') ?? '')) continue;
      const c = visible(b);
      if (c === null) continue;
      if (c.height < MIN - 0.5 || c.width < MIN - 0.5) {
        hallazgos.push({
          tipo: 'boton',
          donde: nombre(b),
          detalle: `${String(Math.round(c.width))}×${String(Math.round(c.height))}`,
        });
      }
    }

    // 3 · texto que no cabe
    for (const e of Array.from(raiz.querySelectorAll<HTMLElement>('*'))) {
      if (!enLaPagina(e) || e.children.length > 0 || (e.textContent ?? '').trim() === '') continue;
      const est = getComputedStyle(e);
      const recorta =
        est.overflow !== 'visible' ||
        est.overflowX !== 'visible' ||
        est.textOverflow === 'ellipsis';
      // Lo de lectores de pantalla (`sr-only`, 1 px) se recorta a propósito.
      if (
        e.clientWidth <= 2 ||
        !recorta ||
        e.scrollWidth <= e.clientWidth + 1 ||
        visible(e) === null
      )
        continue;
      hallazgos.push({
        tipo: 'cortado',
        donde: nombre(e),
        detalle: `scrollWidth ${String(e.scrollWidth)} > ${String(e.clientWidth)}`,
      });
    }

    // 4 · tarjetas de una fila, del mismo alto
    const esTarjeta = (e: Element): boolean => {
      const est = getComputedStyle(e);
      const caja = Number.parseFloat(est.borderTopWidth) > 0 || est.boxShadow !== 'none';
      // Una tarjeta tiene cuerpo: los adornos (el cuadro de un icono) no cuentan.
      return (
        caja &&
        Number.parseFloat(est.borderTopLeftRadius) > 0 &&
        e.getBoundingClientRect().width >= 100
      );
    };
    for (const padre of Array.from(raiz.querySelectorAll<HTMLElement>('*'))) {
      if (!enLaPagina(padre) || padre.children.length < 2) continue;
      const hijas = Array.from(padre.children).filter((h) => esTarjeta(h) && visible(h) !== null);
      if (hijas.length < 2) continue;
      const filas = new Map<number, DOMRect[]>();
      for (const h of hijas) {
        const c = h.getBoundingClientRect();
        const clave = Math.round(c.top / 6);
        filas.set(clave, [...(filas.get(clave) ?? []), c]);
      }
      for (const fila of filas.values()) {
        if (fila.length < 2) continue;
        const altos = fila.map((c) => Math.round(c.height));
        if (Math.max(...altos) - Math.min(...altos) > 2) {
          hallazgos.push({
            tipo: 'fila',
            donde: nombre(padre),
            detalle: `altos ${altos.join(' / ')} · ${hijas.slice(0, 4).map(nombre).join(' | ')}`,
          });
        }
      }
    }

    // 5 · campos de una misma fila alineados por su caja
    const campos = Array.from(
      raiz.querySelectorAll<HTMLElement>(
        'input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]), select, textarea, [role="combobox"]',
      ),
    ).filter((c) => enLaPagina(c) && visible(c) !== null);
    const porPadre = new Map<Element, HTMLElement[]>();
    for (const c of campos) {
      const abuelo = c.closest('div[class*="grid"], div[class*="flex"]');
      if (abuelo === null) continue;
      porPadre.set(abuelo, [...(porPadre.get(abuelo) ?? []), c]);
    }
    for (const [padre, lista] of porPadre) {
      const cajas = lista.map((c) => c.getBoundingClientRect());
      const mismaFila = cajas.filter((c) => Math.abs(c.top - (cajas[0]?.top ?? 0)) < 40);
      if (mismaFila.length < 2) continue;
      const altos = mismaFila.map((c) => Math.round(c.height));
      const bajos = mismaFila.map((c) => Math.round(c.bottom));
      if (
        Math.max(...altos) - Math.min(...altos) > 2 ||
        Math.max(...bajos) - Math.min(...bajos) > 2
      ) {
        hallazgos.push({
          tipo: 'campos',
          donde: nombre(padre),
          detalle: `altos ${altos.join(' / ')} · bordes de abajo ${bajos.join(' / ')}`,
        });
      }
    }

    // 6 · tapado: lo interactivo a la vista que otra cosa tapa, o que cae bajo el teclado
    for (const b of Array.from(blancos)) {
      if (!enLaPagina(b) || b.closest('[data-barrido-ignora]') !== null) continue;
      const c = visible(b);
      if (c === null) continue;
      const x = Math.min(Math.max(c.left + c.width / 2, 0), innerWidth - 1);
      const y = Math.min(Math.max(c.top + c.height / 2, 0), innerHeight - 1);
      const encima = document.elementFromPoint(x, y);
      const tapado = encima !== null && !b.contains(encima) && !encima.contains(b);
      // Un botón flotante fijo (el del menú del administrador) tapa lo que hay debajo mientras la
      // página no se desplaza: no es lo de la barra ni lo del teclado, y se alcanza desplazando.
      let esFlotante = false;
      for (let p: Element | null = encima; p !== null; p = p.parentElement) {
        if (['fixed', 'sticky'].includes(getComputedStyle(p).position)) esFlotante = true;
      }
      if (tapado && dialogo === null && !(esFlotante && de.scrollHeight > innerHeight)) {
        hallazgos.push({ tipo: 'tapado', donde: nombre(b), detalle: `lo tapa ${nombre(encima)}` });
      }
      if (
        op.tecladoPx > 0 &&
        dialogo !== null &&
        c.bottom > vista.alto + 1 &&
        c.top < innerHeight
      ) {
        hallazgos.push({
          tipo: 'tapado',
          donde: nombre(b),
          detalle: `queda bajo el teclado (${String(Math.round(c.bottom))} > ${String(Math.round(vista.alto))})`,
        });
      }
    }

    return hallazgos;
  }, opciones) as Promise<Hallazgo[]>;
}

export interface Tamano {
  readonly nombre: string;
  readonly ancho: number;
  readonly alto: number;
  /** En iMin y teléfono se mira también con el teclado abierto. */
  readonly conTeclado: boolean;
}

export const TAMANOS: readonly Tamano[] = [
  { nombre: '1920x1080', ancho: 1920, alto: 1080, conTeclado: false },
  { nombre: '1280x800', ancho: 1280, alto: 800, conTeclado: true },
  { nombre: '1366x768', ancho: 1366, alto: 768, conTeclado: false },
  { nombre: '1024x768', ancho: 1024, alto: 768, conTeclado: false },
  { nombre: '800x1280', ancho: 800, alto: 1280, conTeclado: false },
  { nombre: '390x844', ancho: 390, alto: 844, conTeclado: true },
];
