/**
 * DP-15 · CREAR Y RENOMBRAR ZONAS DESDE LA PANTALLA (informativo QA2-B3 de `docs/qa/HALLAZGOS.md`).
 *
 * No había pantalla para dar de alta una zona («Terraza», «Jardín») y el puente deja repetir el
 * nombre. La regla, una sola vez: el nombre no va vacío, cabe en 40 letras y no repite el de otra
 * zona activa (sin importar mayúsculas ni espacios de más). Las mesas guardan la zona por su id, así
 * que renombrarla cambia el nombre en todas a la vez.
 */

export interface ZonaParaValidar {
  readonly id: string;
  readonly nombre?: string | null;
  readonly activo?: boolean | null;
  readonly orden?: number | null;
}

export const LARGO_MAXIMO_DE_ZONA = 40;

const comparable = (texto: string) => texto.trim().replace(/\s+/g, ' ').toLocaleLowerCase('es-MX');

/** El motivo para no guardar ese nombre, o nulo si se puede. */
export function problemaDelNombreDeZona(
  nombre: string,
  zonas: readonly ZonaParaValidar[],
  idQueSeEdita: string | null,
): string | null {
  const limpio = nombre.trim().replace(/\s+/g, ' ');
  if (limpio === '') return 'Escribe el nombre de la zona.';
  if (limpio.length > LARGO_MAXIMO_DE_ZONA) {
    return `El nombre cabe en ${String(LARGO_MAXIMO_DE_ZONA)} letras.`;
  }
  const repetida = zonas.some(
    (z) =>
      z.id !== idQueSeEdita &&
      z.activo !== false &&
      typeof z.nombre === 'string' &&
      comparable(z.nombre) === comparable(limpio),
  );
  return repetida ? `Ya hay una zona «${limpio}».` : null;
}

/** El orden de una zona nueva: después de la última. */
export function ordenDeLaZonaNueva(zonas: readonly ZonaParaValidar[]): number {
  return zonas.reduce((mayor, z) => Math.max(mayor, Number(z.orden) || 0), 0) + 1;
}
