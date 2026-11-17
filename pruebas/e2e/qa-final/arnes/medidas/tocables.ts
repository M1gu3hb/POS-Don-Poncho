import type { Page } from '@playwright/test';

import type { AyudasEnPagina } from '../en-pagina.ts';
import type { Hallazgo, Informativo } from '../tipos.ts';

/**
 * LO QUE SE TOCA: que no se encime, que se alcance y que mida lo que un dedo necesita.
 *
 *  · `encimado` — dos interactivos a la vista cuyas cajas se cruzan sin que uno contenga al otro;
 *  · `inalcanzable` — el centro de lo visible de un interactivo no cae en él (algo lo tapa:
 *    `elementFromPoint`);
 *  · `blanco-chico` — un blanco PRINCIPAL de menos de 44 px. Se mide el ÁREA TOCABLE real, no el
 *    dibujo: un pseudo-elemento o la etiqueta que envuelve al campo agrandan el blanco, y se sondea
 *    con `elementFromPoint` hasta donde el elemento sigue recibiendo el toque. Las excepciones son
 *    POR COMPONENTE y están justificadas en `excepciones-44.ts`: no hay un piso global (DP-D145).
 */

export const BLANCO_MINIMO_PX = 44;

export interface EntradaDeTocables {
  /** Los selectores exentos de la regla de 44 px para esta pantalla, con su razón. */
  readonly excepciones: readonly { readonly selector: string; readonly razon: string }[];
}

export interface MedidaDeTocables {
  readonly hallazgos: Hallazgo[];
  readonly informativos: Informativo[];
}

export async function medirTocables(
  page: Page,
  entrada: EntradaDeTocables,
): Promise<MedidaDeTocables> {
  return page.evaluate(
    ({ excepciones, minimo }) => {
      const lib = (window as unknown as { __arnes: AyudasEnPagina }).__arnes;
      const hallazgos: Hallazgo[] = [];
      const informativos: Informativo[] = [];
      const raiz = lib.raiz();
      const SELECTOR =
        'button, a[href], summary, select, textarea, input:not([type="hidden"]), [role="button"], [role="tab"], [role="menuitem"], [role="option"], [role="switch"], [role="checkbox"], [role="radio"], [role="link"], [role="combobox"]';
      const todos = Array.from(raiz.querySelectorAll<HTMLElement>(SELECTOR)).filter(
        (e) => lib.visible(e) !== null,
      );

      /** El centro de lo que se VE del elemento (su caja cortada por la ventana). */
      const centroVisible = (c: DOMRect): { x: number; y: number } => {
        const izq = Math.max(c.left, 0);
        const der = Math.min(c.right, innerWidth - 1);
        const arr = Math.max(c.top, 0);
        const aba = Math.min(c.bottom, innerHeight - 1);
        return { x: (izq + der) / 2, y: (arr + aba) / 2 };
      };
      const recibe = (e: HTMLElement, golpe: Element | null): boolean =>
        golpe !== null &&
        (e === golpe || e.contains(golpe) || golpe.closest('label')?.control === e);

      // 1 · encimados: dos cajas que se cruzan sin ser ancestro y descendiente.
      let encimados = 0;
      for (let i = 0; i < todos.length && encimados < 20; i += 1) {
        for (let j = i + 1; j < todos.length && encimados < 20; j += 1) {
          const [a, b] = [todos[i], todos[j]];
          if (a === undefined || b === undefined || a.contains(b) || b.contains(a)) continue;
          const [ca, cb] = [a.getBoundingClientRect(), b.getBoundingClientRect()];
          const ancho = Math.min(ca.right, cb.right) - Math.max(ca.left, cb.left);
          const alto = Math.min(ca.bottom, cb.bottom) - Math.max(ca.top, cb.top);
          if (ancho > 1 && alto > 1) {
            encimados += 1;
            hallazgos.push({
              tipo: 'encimado',
              selector: `${lib.nombre(a)} ∩ ${lib.nombre(b)}`,
              texto: `${lib.texto(a)} | ${lib.texto(b)}`,
              medidas: { ancho: Math.round(ancho), alto: Math.round(alto) },
              detalle: 'dos blancos de toque se cruzan',
            });
          }
        }
      }

      // 2 · alcanzables y 3 · el blanco de 44 px
      for (const e of todos) {
        const c = e.getBoundingClientRect();
        const { x, y } = centroVisible(c);
        const golpe = document.elementFromPoint(x, y);
        const desactivado = e.matches(':disabled') || e.getAttribute('aria-disabled') === 'true';
        // Inerte a propósito (desactivado o `pointer-events: none`): no recibe toques porque no debe.
        const inerte = desactivado || getComputedStyle(e).pointerEvents === 'none';
        if (inerte && !recibe(e, golpe)) {
          informativos.push({
            tipo: 'explicado',
            selector: lib.nombre(e),
            texto: lib.texto(e),
            detalle: 'inerte a propósito: desactivado o con pointer-events: none',
          });
          continue;
        }
        if (!recibe(e, golpe)) {
          hallazgos.push({
            tipo: 'inalcanzable',
            selector: lib.nombre(e),
            texto: lib.texto(e),
            medidas: { x: Math.round(x), y: Math.round(y) },
            detalle: `su centro lo tapa ${golpe === null ? 'nada (fuera de la ventana)' : `${lib.nombre(golpe)} «${lib.texto(golpe)}»`}`,
          });
          continue;
        }
        if (desactivado || e.closest('[data-barrido-ignora]') !== null) continue;
        if (c.width >= minimo - 0.5 && c.height >= minimo - 0.5) continue;
        // Un enlace dentro de un texto no es un blanco principal: es una palabra.
        if (e.matches('a[href]') && getComputedStyle(e).display === 'inline') continue;
        // El área tocable: desde el centro, hasta donde el elemento sigue recibiendo el toque.
        const alcance = (dx: number, dy: number): number => {
          let largo = 0;
          for (let paso = 1; paso <= 60; paso += 1) {
            const px = x + dx * paso;
            const py = y + dy * paso;
            if (px < 0 || py < 0 || px >= innerWidth || py >= innerHeight) break;
            if (!recibe(e, document.elementFromPoint(px, py))) break;
            largo = paso;
          }
          return largo;
        };
        const ancho = Math.round(alcance(-1, 0) + alcance(1, 0) + 1);
        const alto = Math.round(alcance(0, -1) + alcance(0, 1) + 1);
        const medidas = {
          ancho: Math.round(c.width),
          alto: Math.round(c.height),
          anchoTocable: ancho,
          altoTocable: alto,
        };
        if (ancho >= minimo && alto >= minimo) continue;
        const exenta = excepciones.find((x2) => e.closest(x2.selector) !== null);
        if (exenta !== undefined) {
          informativos.push({
            tipo: 'excepcion-44',
            selector: lib.nombre(e),
            texto: lib.texto(e),
            detalle: `${exenta.razon} (${String(ancho)}×${String(alto)})`,
          });
          continue;
        }
        hallazgos.push({
          tipo: 'blanco-chico',
          selector: lib.nombre(e),
          texto: lib.texto(e),
          medidas,
          detalle: `área tocable de ${String(ancho)}×${String(alto)} px (mínimo ${String(minimo)})`,
        });
      }
      return { hallazgos, informativos };
    },
    { excepciones: entrada.excepciones, minimo: BLANCO_MINIMO_PX },
  );
}
