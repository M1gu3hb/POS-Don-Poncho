/**
 * MODO COMPATIBLE (DP-20.1) · los degradados.
 *
 * Tailwind 4 mezcla los colores de un degradado en `oklab` y lo dice en la dirección:
 * `--tw-gradient-position: to bottom right in oklab`. Esa sintaxis existe desde Chromium 111; en un
 * motor más viejo `linear-gradient(to bottom right in oklab, …)` es inválido ENTERO y el degradado
 * no se pinta (el fondo de marca del armazón salía liso). Las utilidades nuevas (`bg-linear-to-*`)
 * ya traen su respaldo; las heredadas de Tailwind 3 (`bg-gradient-to-*`), no.
 *
 * La dirección va en una variable, así que no sirve «una declaración de respaldo delante»: se
 * repite sin el `in oklab` dentro de `@supports not (background-image: linear-gradient(in lab, …))`.
 * El motor viejo mezcla en sRGB —entre dos colores cercanos no se nota— y el moderno no entra.
 */
import { compacto, dentroDeFotogramas, dentroDeSoporte, yaTieneGemela } from './valores.mjs';

export const SIN_INTERPOLACION = 'not(background-image:linear-gradient(inlab,red,red))';
const CONDICION = 'not (background-image:linear-gradient(in lab, red, red))';
export const DIRECCION = '--tw-gradient-position';

/** `… in oklab`, `… in oklch longer hue`: el espacio de color al final de la dirección. */
const ESPACIO = /\s+in\s+[a-z0-9-]+(\s+(longer|shorter|increasing|decreasing)\s+hue)?\s*$/i;

export const conEspacio = (valor) => ESPACIO.test(valor);
export const sinEspacio = (valor) => valor.replace(ESPACIO, '');

/** ¿La regla vive en el bloque con el que Tailwind ya separa a los motores que sí entienden? */
export function enBloqueDeInterpolacion(regla) {
  for (let p = regla.parent; p !== undefined && p.type !== 'root'; p = p.parent) {
    if (p.type !== 'atrule' || p.name !== 'supports') continue;
    const condicion = compacto(p.params);
    if (condicion.includes('linear-gradient(in') && !condicion.startsWith('not')) return true;
  }
  return false;
}

/** @returns {{ reglas: number }} */
export function respaldarDegradados(root, ayudas) {
  const pendientes = [];
  root.walkRules((regla) => {
    if (dentroDeFotogramas(regla) || dentroDeSoporte(regla, SIN_INTERPOLACION)) return;
    if (enBloqueDeInterpolacion(regla) || yaTieneGemela(regla, SIN_INTERPOLACION)) return;
    const propias = regla.nodes.filter(
      (d) => d.type === 'decl' && d.prop === DIRECCION && conEspacio(d.value),
    );
    if (propias.length > 0) pendientes.push([regla, propias]);
  });
  for (const [regla, propias] of pendientes) {
    const nodos = propias.map((d) => d.clone({ value: sinEspacio(d.value) }));
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
