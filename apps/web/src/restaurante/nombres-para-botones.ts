/** Sólo el nombre y el id importan aquí: la línea completa vive en `DividirCuentaDialog`. */
interface LineaConNombre {
  readonly id: string;
  readonly nombre: string;
}

/**
 * DP-18 · A14: dos rondas del mismo platillo son dos renglones y, sin más, sus botones se llaman
 * igual («Añadir X a la cuenta 1» dos veces): con lector de pantalla no se distinguen. Sólo el
 * nombre REPETIDO lleva «(ronda N)», por orden de aparición; el que sale una vez queda como estaba.
 */
export function nombresParaBotones(
  lineas: readonly LineaConNombre[],
): Readonly<Record<string, string>> {
  const veces: Record<string, number> = {};
  for (const l of lineas) veces[l.nombre] = (veces[l.nombre] ?? 0) + 1;
  const vistas: Record<string, number> = {};
  const nombres: Record<string, string> = {};
  for (const l of lineas) {
    if ((veces[l.nombre] ?? 0) < 2) {
      nombres[l.id] = l.nombre;
      continue;
    }
    vistas[l.nombre] = (vistas[l.nombre] ?? 0) + 1;
    nombres[l.id] = `${l.nombre} (ronda ${String(vistas[l.nombre])})`;
  }
  return nombres;
}
