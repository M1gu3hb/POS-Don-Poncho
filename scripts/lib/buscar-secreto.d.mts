export declare const LARGO_MINIMO: number;

export interface FormaDelSecreto {
  readonly nombre: string;
  readonly forma: Buffer;
}

export interface Hallazgo {
  readonly archivo: string;
  readonly forma: string;
}

export declare function formasDelSecreto(secreto: string): FormaDelSecreto[];

export declare function buscarSecreto(
  carpeta: string,
  secreto: string,
  opciones?: { readonly ignorar?: readonly string[] },
): { readonly mirados: number; readonly hallazgos: Hallazgo[] };
