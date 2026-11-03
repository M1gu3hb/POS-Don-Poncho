/** Tipos de `permisos-del-navegador.mjs` (DP-13.2), para que su prueba se lea con tipos. */
export interface Cabecera {
  readonly key: string;
  readonly value: string;
}

export interface EntradaDeCabeceras {
  readonly source: string;
  readonly headers: readonly Cabecera[];
}

export const SIN_CAMARA: string;
export const CON_CAMARA: string;
export const RUTAS_CON_CAMARA: readonly string[];
export function politicaDePermisosPara(ruta: string): string;
export function cabecerasDePermisos(
  cabecerasDeSeguridad: readonly Cabecera[],
): EntradaDeCabeceras[];
