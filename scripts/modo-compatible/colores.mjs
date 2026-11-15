/**
 * MODO COMPATIBLE (DP-20.1) · las opacidades (`bg-acento/10`, `border-borde/40`…).
 *
 * Tailwind 4 escribe `color-mix(in oklab, <color> N%, transparent)` dentro de
 * `@supports (color: color-mix(in lab, red, red))` y, delante, un respaldo. Cuando el color es un
 * token del sistema (`hsl(var(--acento))`) no puede calcular nada y el respaldo sale SÓLIDO: en un
 * motor sin `color-mix` (Chromium < 111) una tecla «crema al 10 %» queda crema entera, con la letra
 * crema encima.
 *
 * Aquí el respaldo pasa a `hsl(var(--acento) / 10%)`. Es exacto —los tokens son tripletas
 * `H S% L%` y mezclar con `transparent` sólo escala el alfa— y un motor moderno ni lo mira: el
 * bloque `@supports` que viene después lo reemplaza. Por eso en lo moderno no cambia un pixel.
 */
import {
  compacto,
  llamadas,
  partirAlNivelCero,
  sustituirLlamadas,
  yaTieneGemela,
} from './valores.mjs';

/** La condición con la que Tailwind envuelve cada mezcla. */
export const ES_BLOQUE_DE_MEZCLA = /color-mix\(inlab,red,red\)/;

const FIJOS = { white: [255, 255, 255], black: [0, 0, 0] };

function deHex(color) {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color);
  if (m === null) return null;
  const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join('') : m[1];
  return [0, 2, 4].map((i) => Number.parseInt(h.slice(i, i + 2), 16));
}

/**
 * El color con transparencia para un motor sin `color-mix`, o `null` si no se puede calcular
 * (p. ej. `currentcolor`: no existe «el color actual al 50 %» sin `color-mix`).
 * @param {(nombre: string) => string | undefined} tema  lo que vale una variable `--color-*`
 */
export function conAlfa(color, porcentaje, tema = () => undefined, vistos = 0) {
  const c = color.trim();
  const token = /^hsl\(\s*(var\(--[\w-]+\))\s*\)$/i.exec(c);
  if (token !== null) return `hsl(${token[1]} / ${porcentaje}%)`;
  const rgb = deHex(c) ?? FIJOS[c.toLowerCase()] ?? null;
  if (rgb !== null) return `rgb(${rgb.join(' ')} / ${porcentaje}%)`;
  const variable = /^var\(\s*(--[\w-]+)\s*\)$/.exec(c);
  if (variable !== null && vistos < 4) {
    const valor = tema(variable[1]);
    if (valor !== undefined) return conAlfa(valor, porcentaje, tema, vistos + 1);
  }
  return null;
}

/** `in oklab, <color> N%, transparent` → `[color, N]`, o `null` si la mezcla es de otra forma. */
function partesDeLaMezcla(dentro) {
  const partes = partirAlNivelCero(dentro, ',');
  if (partes.length !== 3 || !/^in\s/i.test(partes[0]) || partes[2].toLowerCase() !== 'transparent')
    return null;
  // El minificador pega el porcentaje al paréntesis: `hsl(var(--x))50%`.
  const m = /^(.+?)(?:\s+|(?<=\)))(\d*\.?\d+)%$/.exec(partes[1]);
  return m === null ? null : [m[1].trim(), m[2]];
}

/** El valor con cada mezcla convertida a un color con alfa; `null` si alguna no se puede. */
export function valorConAlfa(valor, tema) {
  return sustituirLlamadas(valor, 'color-mix', (dentro) => {
    const partes = partesDeLaMezcla(dentro);
    return partes === null ? null : conAlfa(partes[0], partes[1], tema);
  });
}

/** El respaldo sólido que deja Tailwind: cada mezcla sustituida por su color, sin el porcentaje. */
export function valorSolido(valor) {
  return sustituirLlamadas(valor, 'color-mix', (dentro) => {
    const partes = partesDeLaMezcla(dentro);
    return partes === null ? null : partes[0];
  });
}

export const tieneMezcla = (valor) => llamadas(valor, 'color-mix').length > 0;

/** Lo que vale cada `--color-*` declarado en la hoja (para `var(--color-white)`). */
export function temaDe(root) {
  const tema = new Map();
  root.walkDecls(/^--color-/, (d) => {
    if (!tema.has(d.prop)) tema.set(d.prop, d.value);
  });
  return (nombre) => tema.get(nombre);
}

const mismoValor = (a, b) => a !== null && b !== null && compacto(a) === compacto(b);

/** La declaración de `prop` más cercana ANTES de `nodo`, entre sus hermanos. */
function declaracionAnterior(nodo, prop) {
  for (let n = nodo.prev(); n !== undefined; n = n.prev()) {
    if (n.type === 'decl' && n.prop === prop) return n;
  }
  return undefined;
}

/** La regla hermana anterior con ESE selector exacto que declara `prop` (cerca: Tailwind la deja pegada). */
function reglaAnterior(bloque, selector, prop) {
  let pasos = 0;
  for (let n = bloque.prev(); n !== undefined && pasos < 12; n = n.prev(), pasos += 1) {
    if (n.type !== 'rule' || n.selector !== selector) continue;
    const d = n.nodes.findLast((x) => x.type === 'decl' && x.prop === prop);
    if (d !== undefined) return d;
  }
  return undefined;
}

/** La condición contraria: el motor NO tiene `color-mix`. */
export const SIN_MEZCLA = 'not(color:color-mix(inlab,red,red))';
const CONDICION_SIN_MEZCLA = 'not (color:color-mix(in lab,red,red))';

/** El texto de ayuda de un campo. */
const ES_MARCADOR = /::placeholder\b/;

/** `[color, porcentaje]` cuando el valor entero es UNA mezcla. */
function unicaMezcla(valor) {
  const todas = llamadas(valor, 'color-mix');
  if (todas.length !== 1 || todas[0].inicio !== 0 || todas[0].fin !== valor.trim().length)
    return null;
  return partesDeLaMezcla(todas[0].dentro);
}

function bloqueSinMezcla(ayudas, regla, opacidad) {
  return ayudas.atRule({
    name: 'supports',
    params: CONDICION_SIN_MEZCLA,
    nodes: [regla.clone({ nodes: [ayudas.decl({ prop: 'opacity', value: opacidad })] })],
  });
}

/**
 * EL TEXTO DE AYUDA, que es el único `currentcolor` de la hoja: Tailwind lo pinta con «el color del
 * campo al 50 %», y eso no se puede escribir sin `color-mix`. Se consigue igual con opacidad: el
 * marcador base va al 50 % y los que traen color propio (`placeholder:text-…`) vuelven al 100 %.
 */
function respaldarMarcadores(root, ayudas, marcadores) {
  for (const { bloque, regla, opacidad } of marcadores) {
    const sigue = bloque.next();
    const yaEsta =
      sigue?.type === 'atrule' &&
      sigue.name === 'supports' &&
      compacto(sigue.params) === SIN_MEZCLA;
    if (!yaEsta) bloque.after(bloqueSinMezcla(ayudas, regla, opacidad));
  }
  const conColor = [];
  root.walkRules((regla) => {
    if (!ES_MARCADOR.test(regla.selector) || yaTieneGemela(regla, SIN_MEZCLA)) return;
    for (let p = regla.parent; p.type !== 'root'; p = p.parent) {
      if (p.type === 'atrule' && p.name === 'supports' && /color-mix/.test(p.params)) return;
    }
    const color = regla.nodes.findLast((d) => d.type === 'decl' && d.prop === 'color');
    if (color !== undefined && !/^currentcolor$/i.test(color.value.trim())) conColor.push(regla);
  });
  for (const regla of conColor) regla.after(bloqueSinMezcla(ayudas, regla, '1'));
}

/**
 * Deja cada mezcla con su respaldo transparente.
 * @returns {{ arreglados: number, sinRespaldo: { selector: string, prop: string, valor: string }[] }}
 */
export function respaldarColores(root, ayudas) {
  const tema = temaDe(root);
  const informe = { arreglados: 0, sinRespaldo: [] };
  const marcadores = [];

  root.walkAtRules('supports', (bloque) => {
    if (!ES_BLOQUE_DE_MEZCLA.test(compacto(bloque.params))) return;
    for (const hijo of [...(bloque.nodes ?? [])]) {
      // Forma anidada (desarrollo): la declaración vive dentro del `@supports`, y éste en la regla.
      if (hijo.type === 'decl' && tieneMezcla(hijo.value)) {
        const selector = bloque.parent.type === 'rule' ? bloque.parent.selector : '';
        const previa = declaracionAnterior(bloque, hijo.prop);
        respaldar(hijo, previa, selector, (nuevo) => bloque.before(nuevo), bloque, null);
      }
      // Forma aplanada (producción): reglas dentro del `@supports`, y el respaldo antes de él.
      if (hijo.type !== 'rule') continue;
      for (const d of hijo.nodes.filter((x) => x.type === 'decl' && tieneMezcla(x.value))) {
        const previa = reglaAnterior(bloque, hijo.selector, d.prop);
        respaldar(
          d,
          previa,
          hijo.selector,
          (nuevo) => bloque.before(hijo.clone({ nodes: [nuevo] })),
          bloque,
          hijo,
        );
      }
    }
  });
  if (marcadores.length > 0) respaldarMarcadores(root, ayudas, marcadores);
  return informe;

  function respaldar(mezcla, previa, selector, insertar, bloque, regla) {
    const solido = valorSolido(mezcla.value);
    // Ya trae transparencia (Tailwind sí pudo calcularla: `#ffffff0d`): no se toca.
    if (previa !== undefined && !mismoValor(previa.value, solido)) return;
    const alfa = valorConAlfa(mezcla.value, tema);
    if (alfa === null) {
      const unica = unicaMezcla(mezcla.value);
      const esMarcador =
        regla !== null &&
        mezcla.prop === 'color' &&
        ES_MARCADOR.test(selector) &&
        unica !== null &&
        /^currentcolor$/i.test(unica[0]);
      if (esMarcador) marcadores.push({ bloque, regla, opacidad: String(Number(unica[1]) / 100) });
      else informe.sinRespaldo.push({ selector, prop: mezcla.prop, valor: mezcla.value });
      return;
    }
    if (previa !== undefined) previa.value = alfa;
    else insertar(mezcla.clone({ value: alfa }));
    informe.arreglados += 1;
  }
}
