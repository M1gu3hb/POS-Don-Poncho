export interface ApiNueva {
  readonly nombre: string;
  /** La versión mayor de Chromium en la que llegó. */
  readonly desde: number;
  readonly patron: RegExp;
  /** El nombre con el que la cubre el guion de rellenos. */
  readonly relleno: string;
}

export declare const API_NUEVAS: readonly ApiNueva[];

export declare function apiSinRelleno(
  codigo: string,
  rellenos: readonly string[],
): { usadas: string[]; sinRelleno: { nombre: string; desde: number }[] };

export declare function rellenosDeclarados(fuente: string): string[];
