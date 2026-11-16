/**
 * DP-21 · Bloque 5 · Los nombres de las cajas en Configuración → Caja (sin React, para probarlo).
 *
 * Cada caja es un lugar de la sucursal (1, 2…) y su nombre lo pone el dueño. Sin nombre se llama
 * «Caja 1», «Caja 2». El servidor es quien manda (`caja.nombrar_cajas`); esto sólo arma el
 * formulario y dice antes de guardar lo que el servidor rechazaría.
 */
const LARGO_MAXIMO = 40;

/** El nombre que tiene cada caja sin que nadie le ponga uno. */
export function nombrePorOmision(lugar: number): string {
  return `Caja ${String(lugar)}`;
}

/** Lo guardado, un texto por lugar (vacío = sin nombre). Lo que no se entienda, vacío. */
export function nombresGuardados(valor: unknown, lugares: number): readonly string[] {
  const guardados: readonly unknown[] = Array.isArray(valor) ? valor : [];
  return Array.from({ length: Math.max(1, lugares) }, (_, i) => {
    const nombre = guardados[i];
    return typeof nombre === 'string' ? nombre.trim().slice(0, LARGO_MAXIMO) : '';
  });
}

/** Lo que viaja al servidor: recortado, y sin perder el lugar de cada uno. */
export function nombresParaGuardar(escritos: readonly string[]): readonly string[] {
  return escritos.map((nombre) => nombre.trim().slice(0, LARGO_MAXIMO));
}

/** Dos cajas con el mismo nombre no se distinguen en el corte: se dice antes de guardar. */
export function hayNombresRepetidos(escritos: readonly string[]): boolean {
  const puestos = nombresParaGuardar(escritos)
    .map((nombre, i) => (nombre === '' ? nombrePorOmision(i + 1) : nombre).toLowerCase())
    .filter((nombre) => nombre !== '');
  return new Set(puestos).size !== puestos.length;
}

export function hayCambios(escritos: readonly string[], guardados: readonly string[]): boolean {
  const nuevos = nombresParaGuardar(escritos);
  return nuevos.length !== guardados.length || nuevos.some((nombre, i) => nombre !== guardados[i]);
}
