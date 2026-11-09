/** DP-15 · El orden de la lista de «Agotados del día» (pura, sin pantalla). */

export interface Platillo {
  readonly id: string;
  readonly nombre: string;
  readonly agotado_hoy?: boolean | null;
}

/** Lo agotado primero, y después por nombre: lo que se busca al final de la noche está arriba. */
export function ordenarParaAgotar(platillos: readonly Platillo[], busqueda: string): Platillo[] {
  const texto = busqueda.trim().toLocaleLowerCase('es-MX');
  return platillos
    .filter((p) => texto === '' || p.nombre.toLocaleLowerCase('es-MX').includes(texto))
    .sort(
      (a, b) =>
        Number(b.agotado_hoy === true) - Number(a.agotado_hoy === true) ||
        a.nombre.localeCompare(b.nombre, 'es-MX'),
    );
}
