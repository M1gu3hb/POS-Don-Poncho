import type { Root } from 'postcss';

export interface RevisionDelModoCompatible {
  readonly problemas: string[];
  readonly cuentas: {
    readonly mezclas: number;
    readonly sueltas: number;
    readonly animaciones: number;
    readonly dinamicas: number;
    readonly degradados: number;
    readonly coloresNuevos: number;
    readonly tiene: number;
  };
  readonly aviso: { readonly aspecto: boolean; readonly decideLaHoja: boolean };
}

/** Revisa una hoja ya analizada por PostCSS contra el contrato del modo compatible. */
export declare function revisar(root: Root): RevisionDelModoCompatible;

export declare const SELECTOR_DEL_AVISO: string;
