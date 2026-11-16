/**
 * Tailwind y, DESPUÉS, el modo compatible (DP-20.1): los respaldos para los POS cuyo motor no
 * entiende `color-mix`, `translate` suelto ni `dvh`. En un motor moderno no cambia un pixel; el
 * porqué y el cómo están en `scripts/modo-compatible/plugin.mjs`.
 */
import modoCompatible from '../../scripts/modo-compatible/plugin.mjs';

export default {
  plugins: ['@tailwindcss/postcss', modoCompatible()],
};
