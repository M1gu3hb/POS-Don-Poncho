/**
 * EL VELO DE UN COLOR QUE LLEGA DE LA BASE (DP-21 · Bloque 15 · O12).
 *
 * El plugin del modo compatible (`scripts/modo-compatible/`) respalda las mezclas de color que escribe
 * Tailwind en la hoja, pero no alcanza un `style` en línea: el avatar de la pantalla del PIN pintaba
 * su fondo con `color-mix(in oklab, <color del empleado> 16%, transparent)`, y en un motor sin
 * `color-mix` (Chromium < 111: el WebView del iMin) el estilo entero se tiraba y la cara quedaba sin
 * velo. El color del empleado es un hex que se elige en Configuración, así que el velo se calcula
 * aquí, en JavaScript: `rgb(r g b / N%)`, que entiende cualquier motor y en uno moderno pinta lo
 * mismo que la mezcla con transparente (el color no cambia, sólo su alfa).
 *
 * Lo que no sea un hex (un nombre, un token) se deja como mezcla: ahí no hay cuenta que hacer en JS.
 */

const HEX = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

const acotar = (n: number): number => Math.min(100, Math.max(0, n));
const redondear = (n: number): string => String(Number(n.toFixed(1)));

/** `color` al `porcentaje` % de opacidad, en una sintaxis que entiende Chromium 99. */
export function veloDeColor(color: string, porcentaje: number): string {
  const limpio = color.trim();
  if (limpio === '') return 'transparent';
  const pct = acotar(porcentaje);
  const hex = HEX.exec(limpio)?.[1];
  if (hex === undefined) {
    return limpio.startsWith('#')
      ? 'transparent'
      : `color-mix(in oklab, ${limpio} ${redondear(pct)}%, transparent)`;
  }
  const completo =
    hex.length <= 4
      ? hex
          .split('')
          .map((c) => c + c)
          .join('')
      : hex;
  const canal = (i: number): number => Number.parseInt(completo.slice(i, i + 2), 16);
  const alfaPropio = completo.length === 8 ? canal(6) / 255 : 1;
  // El color es un DATO (el del empleado), calculado canal por canal: no es un literal del sistema.
  const [rojo, verde, azul] = [canal(0), canal(2), canal(4)].map(String);
  const alfa = redondear(pct * alfaPropio);
  return `rgb(${rojo ?? ''} ${verde ?? ''} ${azul ?? ''} / ${alfa}%)`;
}
