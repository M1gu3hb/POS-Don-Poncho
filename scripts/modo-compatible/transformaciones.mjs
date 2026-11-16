/**
 * MODO COMPATIBLE (DP-20.1) · `translate`, `scale` y `rotate` sueltos.
 *
 * Tailwind 4 escribe las propiedades individuales (`translate: var(--tw-translate-x) …`), que
 * existen desde Chromium 104. En un motor más viejo se ignoran: el `-50%, -50%` que centra un
 * diálogo no se aplica y el diálogo sale corrido hacia abajo a la derecha.
 *
 * Dentro de `@supports not (translate: 0)` cada regla recibe un `transform` que compone lo mismo,
 * en el orden en que el navegador compone las propiedades sueltas: traslado, giro, escala y luego
 * el `transform` propio. Las animaciones que mueven `transform` reciben el mismo prefijo en cada
 * fotograma: sin él, un diálogo centrado «saltaría» a su esquina mientras entra.
 *
 * Un motor moderno no entra en esos bloques: en lo moderno no cambia un pixel.
 */
import { compacto, dentroDeFotogramas, dentroDeSoporte, yaTieneGemela } from './valores.mjs';

export const SIN_SUELTAS = 'not(translate:0)';
const CONDICION = 'not (translate:0)';

/**
 * El giro va en una variable propia. Tailwind 4 no tiene `--tw-rotate` (escribe `rotate: 45deg`), y
 * una variable sin registrar se HEREDA: el hijo trasladado de un padre girado giraría también.
 */
export const VARIABLE_DEL_GIRO = '--mc-rotate';

export const PREFIJO =
  'translate(var(--tw-translate-x,0),var(--tw-translate-y,0)) ' +
  `rotate(var(${VARIABLE_DEL_GIRO},0deg)) ` +
  'scale(var(--tw-scale-x,1),var(--tw-scale-y,1))';

const SUELTAS = new Set(['translate', 'scale', 'rotate']);
const NUMERO = /^-?\d*\.?\d+%?$/;
const ANGULO = /^(-?\d*\.?\d+(deg|turn|rad|grad)|calc\([^;{}]*\))$/i;
const LARGO = /^(0|-?\d*\.?\d+(px|rem|em|%|vh|vw)|calc\([^;{}]*\)|var\(--[\w-]+\))$/i;

/** `105%` → `1.05`; un número se queda. `scale()` no admitía porcentajes en esos motores. */
function sinPorcentaje(valor) {
  if (!valor.endsWith('%')) return valor;
  return String(Number((Number.parseFloat(valor) / 100).toFixed(4)));
}

/**
 * `transform: none !important` es un reinicio a propósito (las reglas de impresión del heredado):
 * ya le gana a cualquier respaldo, que nunca es `!important`, así que la regla se deja como está.
 * Un `transform` de identidad en su lugar crearía un bloque contenedor que hoy no existe.
 */
export const esReinicio = (regla) =>
  regla.nodes.some(
    (d) => d.type === 'decl' && d.prop === 'transform' && d.important && d.value.trim() === 'none',
  );

/**
 * Lo que una regla pide con sus propiedades sueltas, como variables para el `transform` compuesto.
 * @returns {{ variables: [string, string][] } | { problema: string }}
 */
function variablesDe(regla) {
  const variables = [];
  for (const d of regla.nodes) {
    if (d.type !== 'decl' || !SUELTAS.has(d.prop)) continue;
    const valor = d.value.trim();
    const partes = valor.split(/\s+/);
    if (d.prop === 'translate') {
      if (/^var\(--tw-translate-x\) var\(--tw-translate-y\)/.test(valor)) continue;
      if (valor === 'none') variables.push(['--tw-translate-x', '0'], ['--tw-translate-y', '0']);
      else if (partes.length <= 2 && partes.every((p) => LARGO.test(p)))
        variables.push(['--tw-translate-x', partes[0]], ['--tw-translate-y', partes[1] ?? '0']);
      else return { problema: `translate: ${d.value}` };
    }
    if (d.prop === 'scale') {
      if (/^var\(--tw-scale-x\) var\(--tw-scale-y\)/.test(valor)) {
        // Las variables de Tailwind vienen en porcentaje (`105%`): se pasan a número.
        for (const eje of ['--tw-scale-x', '--tw-scale-y']) {
          const propia = regla.nodes.find((x) => x.type === 'decl' && x.prop === eje);
          if (propia === undefined) continue;
          if (!NUMERO.test(propia.value)) return { problema: `${eje}: ${propia.value}` };
          variables.push([eje, sinPorcentaje(propia.value)]);
        }
      } else if (valor === 'none') variables.push(['--tw-scale-x', '1'], ['--tw-scale-y', '1']);
      else if (partes.length <= 2 && partes.every((p) => NUMERO.test(p)))
        variables.push(
          ['--tw-scale-x', sinPorcentaje(partes[0])],
          ['--tw-scale-y', sinPorcentaje(partes[1] ?? partes[0])],
        );
      else return { problema: `scale: ${d.value}` };
    }
    if (d.prop === 'rotate') {
      if (valor === 'none') variables.push([VARIABLE_DEL_GIRO, '0deg']);
      else if (ANGULO.test(valor)) variables.push([VARIABLE_DEL_GIRO, valor]);
      else return { problema: `rotate: ${d.value}` };
    }
  }
  return { variables };
}

const conPrefijo = (valor) => (valor.trim() === 'none' ? PREFIJO : `${PREFIJO} ${valor}`);

function bloqueDeSoporte(ayudas, nodos) {
  return ayudas.atRule({ name: 'supports', params: CONDICION, nodes: nodos });
}

/**
 * @returns {{ reglas: number, animaciones: number, sinCubrir: { donde: string, que: string }[] }}
 */
export function respaldarTransformaciones(root, ayudas) {
  const informe = { reglas: 0, animaciones: 0, sinCubrir: [] };
  const reglas = [];
  root.walkRules((regla) => {
    if (dentroDeFotogramas(regla) || dentroDeSoporte(regla, SIN_SUELTAS)) return;
    if (esReinicio(regla) || yaTieneGemela(regla, SIN_SUELTAS)) return;
    const toca = regla.nodes.some(
      (d) => d.type === 'decl' && (SUELTAS.has(d.prop) || d.prop === 'transform'),
    );
    if (toca) reglas.push(regla);
  });

  for (const regla of reglas) {
    const pedido = variablesDe(regla);
    if ('problema' in pedido) {
      informe.sinCubrir.push({ donde: regla.selector, que: pedido.problema });
      continue;
    }
    const suelta = regla.nodes.find((d) => d.type === 'decl' && SUELTAS.has(d.prop));
    const propia = regla.nodes.findLast((d) => d.type === 'decl' && d.prop === 'transform');
    const importante = (propia ?? suelta).important === true;
    const nodos = pedido.variables.map(([prop, value]) =>
      ayudas.decl({ prop, value, important: importante }),
    );
    nodos.push(
      ayudas.decl({
        prop: 'transform',
        value: propia === undefined ? PREFIJO : conPrefijo(propia.value),
        important: importante,
      }),
    );
    regla.after(bloqueDeSoporte(ayudas, [regla.clone({ nodes: nodos })]));
    informe.reglas += 1;
  }

  const animaciones = [];
  root.walkAtRules(/keyframes$/i, (animacion) => {
    if (dentroDeSoporte(animacion, SIN_SUELTAS) || yaTieneGemela(animacion, SIN_SUELTAS)) return;
    animaciones.push(animacion);
  });
  for (const animacion of animaciones) {
    let mueve = false;
    let sueltas = false;
    animacion.walkDecls((d) => {
      if (d.prop === 'transform') mueve = true;
      if (SUELTAS.has(d.prop)) sueltas = true;
    });
    if (sueltas) {
      // Animar la propiedad suelta no tiene equivalente automático: se resuelve a mano.
      informe.sinCubrir.push({ donde: `@keyframes ${animacion.params}`, que: 'propiedad suelta' });
      continue;
    }
    if (!mueve) continue;
    const copia = animacion.clone();
    copia.walkDecls('transform', (d) => {
      d.value = conPrefijo(d.value);
    });
    animacion.after(bloqueDeSoporte(ayudas, [copia]));
    informe.animaciones += 1;
  }

  if (informe.reglas + informe.animaciones > 0 && !giroRegistrado(root)) {
    root.append(
      ayudas.atRule({
        name: 'property',
        params: VARIABLE_DEL_GIRO,
        nodes: [
          ayudas.decl({ prop: 'syntax', value: '"*"' }),
          ayudas.decl({ prop: 'inherits', value: 'false' }),
        ],
      }),
    );
  }
  return informe;
}

/** ¿La hoja ya registra la variable del giro? */
function giroRegistrado(root) {
  let marca = false;
  root.walkAtRules('property', (regla) => {
    if (compacto(regla.params) === VARIABLE_DEL_GIRO) marca = true;
  });
  return marca;
}
