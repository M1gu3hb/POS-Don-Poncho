/**
 * DP-22 · DP-D159 · LO QUE DICE LA TARJETA «N INSUMOS POR DEBAJO DE SU MÍNIMO». Puro.
 *
 * El servidor cuenta (todos, sin lista cortada) y manda los primeros nombres; aquí sólo se dice en
 * palabras. Sin insumos bajos no hay tarjeta: `textoDelAviso` devuelve `null`.
 */

export interface InsumoDelAviso {
  readonly nombre: string;
  readonly agotado: boolean;
}

export interface AvisoDelServidor {
  readonly total: number;
  readonly primeros: readonly InsumoDelAviso[];
}

export interface TextoDelAviso {
  readonly titulo: string;
  readonly nombres: string;
  readonly ayuda: string;
}

/** «Carne», «Carne y Pan», «Carne, Pan y Sal», y «… y N más» si hay más que los nombrados. */
export function nombresDichos(primeros: readonly InsumoDelAviso[], total: number): string {
  const nombres = primeros.map((p) => p.nombre);
  const faltan = Math.max(0, total - nombres.length);
  if (nombres.length === 0) return '';
  const cabeza = nombres.slice(0, -1);
  const ultimo = nombres[nombres.length - 1] ?? '';
  if (faltan > 0) return `${nombres.join(', ')} y ${String(faltan)} más`;
  return cabeza.length === 0 ? ultimo : `${cabeza.join(', ')} y ${ultimo}`;
}

export function textoDelAviso(aviso: AvisoDelServidor): TextoDelAviso | null {
  if (aviso.total <= 0) return null;
  return {
    titulo:
      aviso.total === 1
        ? '1 insumo por debajo de su mínimo'
        : `${String(aviso.total)} insumos por debajo de su mínimo`,
    nombres: nombresDichos(aviso.primeros, aviso.total),
    ayuda: 'Toca para verlos en Inventario.',
  };
}

/** A dónde lleva el toque: Inventario, ya filtrado. */
export const RUTA_DEL_AVISO = '/inventario?estado=alerta';
