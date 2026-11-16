/**
 * EL MODO COMPATIBLE DEL POS (DP-20.1) · plugin de PostCSS, después de `@tailwindcss/postcss`.
 *
 * Por qué existe: los POS con Android viejo (el iMin D4-503 trae un WebView de Chromium 99–103 que
 * no se puede actualizar) entienden las capas de CSS pero no `color-mix`, ni las propiedades
 * sueltas `translate` / `scale` / `rotate`, ni `dvh`. Ahí las teclas del PIN salían crema sobre
 * crema y los diálogos, corridos hacia abajo a la derecha.
 *
 * La regla de oro: **en un motor moderno no cambia un pixel.** Todo lo que se agrega aquí es un
 * respaldo que el motor moderno ya reemplaza con su `@supports`, o un bloque `@supports not (…)`
 * en el que no entra. No se detecta el navegador por su nombre.
 *
 * Lo comprueba `scripts/verificar-modo-compatible.mjs` sobre el CSS que deja `next build`: si una
 * actualización de Tailwind o de Next cambia la forma del CSS, la CI lo dice.
 */
import { respaldarColores } from './colores.mjs';
import { respaldarColoresNuevos } from './colores-nuevos.mjs';
import { respaldarDegradados } from './degradados.mjs';
import { respaldarTiene } from './tiene.mjs';
import { respaldarTransformaciones } from './transformaciones.mjs';
import { respaldarUnidades } from './unidades.mjs';

export const NOMBRE = 'morphiqpos-modo-compatible';

/** Aplica el modo compatible a una hoja ya compilada. Devuelve lo que hizo y lo que no pudo. */
export function aplicarModoCompatible(root, ayudas) {
  const colores = respaldarColores(root, ayudas);
  // Las unidades antes que las transformaciones: así el respaldo del alto queda pegado a su regla.
  const unidades = respaldarUnidades(root, ayudas);
  const degradados = respaldarDegradados(root, ayudas);
  const transformaciones = respaldarTransformaciones(root, ayudas);
  const coloresNuevos = respaldarColoresNuevos(root, ayudas);
  const tiene = respaldarTiene(root, ayudas);
  return { colores, unidades, degradados, transformaciones, coloresNuevos, tiene };
}

export default function modoCompatible() {
  return {
    postcssPlugin: NOMBRE,
    OnceExit(root, ayudas) {
      const informe = aplicarModoCompatible(root, ayudas);
      // Lo que no se pudo respaldar no rompe el build: lo detiene el contrato, que sí lo explica.
      for (const { selector, prop } of informe.colores.sinRespaldo)
        ayudas.result.warn(`modo compatible: sin respaldo con alfa para ${prop} en ${selector}`);
      for (const { selector, prop } of informe.coloresNuevos.sinRespaldo)
        ayudas.result.warn(`modo compatible: sin respaldo en rgb() para ${prop} en ${selector}`);
      for (const { donde, que } of informe.transformaciones.sinCubrir)
        ayudas.result.warn(`modo compatible: sin transform de respaldo para ${que} en ${donde}`);
    },
  };
}
modoCompatible.postcss = true;
