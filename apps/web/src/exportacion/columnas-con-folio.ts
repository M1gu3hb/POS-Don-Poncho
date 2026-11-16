import { folioVisible, type ConFolios } from '@morphiqpos/domain/venta';

/**
 * LA COLUMNA «FOLIO» DE LAS EXPORTACIONES, CON EL PREFIJO DEL NEGOCIO (DP-21 · Bloque 6).
 *
 * `heredado/lib/exportColumns.js` define las columnas sin saber del negocio. Quien exporta (Registros)
 * pasa sus columnas por aquí: la de `folio` se escribe como la pantalla («DP-01001», «DPC-0101»),
 * y sin prefijo queda como siempre (el número a secas). Las demás columnas no se tocan.
 */

interface ColumnaDeExportacion {
  readonly key: string;
  readonly label: string;
  readonly format?: (valor: unknown, fila: Record<string, unknown>) => unknown;
}

export function columnasConFolio<C extends ColumnaDeExportacion>(
  columnas: readonly C[],
  configuracion: ConFolios | null | undefined,
): readonly C[] {
  return columnas.map((columna) =>
    columna.key === 'folio'
      ? {
          ...columna,
          format: (valor: unknown, fila: Record<string, unknown>) =>
            folioVisible(
              typeof fila['serie'] === 'string' ? fila['serie'] : null,
              typeof valor === 'string' || typeof valor === 'number' ? valor : null,
              configuracion,
              'numero',
            ),
        }
      : columna,
  );
}
