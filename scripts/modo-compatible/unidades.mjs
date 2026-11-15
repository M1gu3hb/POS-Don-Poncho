/**
 * MODO COMPATIBLE (DP-20.1) · `dvh`, `svh`, `lvh` (y sus `vw`).
 *
 * Existen desde Chromium 108. En un motor más viejo `height: 100dvh` es una declaración inválida y
 * la regla se queda sin alto. El respaldo es la unidad clásica (`vh`, `vw`), dentro de
 * `@supports not (height: 1dvh)` y justo después de la regla: gana en el motor viejo y el moderno
 * no entra.
 *
 * Va en un bloque y no como «declaración de respaldo delante» porque el minificador del build
 * funde dos declaraciones iguales seguidas y se queda con la última.
 */
import { dentroDeFotogramas, dentroDeSoporte, yaTieneGemela } from './valores.mjs';

export const SIN_DINAMICAS = 'not(height:1dvh)';
const CONDICION = 'not (height:1dvh)';

/** Un número pegado a una unidad dinámica de ventana. */
const DINAMICA = /(\d*\.?\d+)[dsl]v([hw])\b/gi;

export const tieneDinamicas = (valor) => valor.search(DINAMICA) !== -1;
export const sinDinamicas = (valor) => valor.replace(DINAMICA, '$1v$2');

/** @returns {{ reglas: number }} */
export function respaldarUnidades(root, ayudas) {
  const pendientes = [];
  root.walkRules((regla) => {
    if (dentroDeFotogramas(regla) || dentroDeSoporte(regla, SIN_DINAMICAS)) return;
    if (yaTieneGemela(regla, SIN_DINAMICAS)) return;
    const propias = regla.nodes.filter((d) => d.type === 'decl' && tieneDinamicas(d.value));
    if (propias.length > 0) pendientes.push([regla, propias]);
  });
  for (const [regla, propias] of pendientes) {
    const nodos = propias.map((d) => d.clone({ value: sinDinamicas(d.value) }));
    regla.after(
      ayudas.atRule({
        name: 'supports',
        params: CONDICION,
        nodes: [regla.clone({ nodes: nodos })],
      }),
    );
  }
  return { reglas: pendientes.length };
}
