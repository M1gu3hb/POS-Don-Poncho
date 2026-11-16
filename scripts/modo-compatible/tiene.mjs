/**
 * MODO COMPATIBLE (DP-21 · Bloque 15) · `:has(:checked)` y `:has(:focus-visible)`.
 *
 * `:has()` existe desde Chromium 105: en un motor más viejo la regla entera se tira. Para lo que
 * dice «esta tarjeta tiene la opción elegida» o «tiene el foco del teclado» se deja, justo después,
 * la misma regla sobre una MARCA (`[data-tiene-checked]`, `[data-tiene-focus-visible]`) dentro de
 * `@supports not selector(:has(a))`; `apps/web/src/compatibilidad/tiene-de-respaldo.ts` pone y quita
 * la marca. Un motor con `:has()` no entra al bloque: no cambia nada. Los demás `:has()` (`>svg`,
 * `[aria-selected]`…) son de acomodo o de otra clase de estado y no se tocan.
 */
import { compacto, dentroDeFotogramas } from './valores.mjs';

export const SIN_HAS = 'notselector(:has(a))';
const CONDICION = 'not selector(:has(a))';
/** El estado que se sabe marcar, y su marca. */
export const MARCAS = {
  checked: 'data-tiene-checked',
  'focus-visible': 'data-tiene-focus-visible',
};

/** `base:has(:estado)` → `[base, estado]`; `null` si el selector es de otra forma. */
export function partesDelSelector(selector) {
  const m = /^(.*):has\(:(checked|focus-visible)\)$/.exec(selector.trim());
  return m === null ? null : [m[1], m[2]];
}

const dentroDeUnSoporte = (nodo) => {
  for (let p = nodo.parent; p !== undefined && p.type !== 'root'; p = p.parent)
    if (p.type === 'atrule' && p.name === 'supports') return true;
  return false;
};

/** @returns {{ reglas: number }} */
export function respaldarTiene(root, ayudas) {
  const pendientes = [];
  root.walkRules((regla) => {
    if (dentroDeFotogramas(regla) || dentroDeUnSoporte(regla)) return;
    const partes = partesDelSelector(regla.selector);
    if (partes === null) return;
    const marcado = `${partes[0]}[${MARCAS[partes[1]]}]`;
    const sigue = regla.next();
    const yaEsta =
      sigue !== undefined &&
      esSinHas(sigue) &&
      (sigue.nodes ?? []).some((r) => r.type === 'rule' && r.selector === marcado);
    if (!yaEsta) pendientes.push([regla, partes]);
  });
  for (const [regla, [base, estado]] of pendientes) {
    regla.after(
      ayudas.atRule({
        name: 'supports',
        params: CONDICION,
        nodes: [regla.clone({ selector: `${base}[${MARCAS[estado]}]` })],
      }),
    );
  }
  return { reglas: pendientes.length };
}

export const esSinHas = (nodo) =>
  nodo.type === 'atrule' && nodo.name === 'supports' && compacto(nodo.params) === SIN_HAS;
