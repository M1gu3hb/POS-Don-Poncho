/**
 * DP-22 · DP-D159 · «POR DEBAJO DE SU MÍNIMO» EN EL NAVEGADOR. Puro.
 *
 * El aviso del Tablero cuenta en el servidor (`inventario.insumos_bajos`, que usa `alertasDeMinimo`
 * del dominio) y lleva a Inventario con `?estado=alerta`. Para que la lista que se abre sea EXACTAMENTE
 * la que se contó, Inventario aplica la misma regla a sus filas: un piso en cero es «no lo vigiles»; con
 * piso (o con piso crítico), cuenta lo que está en él o por debajo, lo agotado y lo negativo también.
 * Una prueba la ata a `alertasDeMinimo` sobre una cuadrícula de casos.
 */

/** El valor del filtro de Inventario (`?estado=alerta`). */
export const ESTADO_POR_DEBAJO_DEL_MINIMO = 'alerta';

export interface InsumoConExistencia {
  readonly stock_actual?: number | string | null;
  readonly stock_minimo?: number | string | null;
  readonly stock_critico?: number | string | null;
}

const numero = (valor: number | string | null | undefined): number => {
  const n = Number(valor ?? 0);
  return Number.isFinite(n) ? n : 0;
};

export function estaPorDebajoDelMinimo(insumo: InsumoConExistencia): boolean {
  const existencia = numero(insumo.stock_actual);
  const critico = numero(insumo.stock_critico);
  const minimo = numero(insumo.stock_minimo);
  return (critico > 0 && existencia <= critico) || (minimo > 0 && existencia <= minimo);
}

/** El filtro que pide la URL de Inventario: sólo reconoce `alerta`; cualquier otra cosa, «todos». */
export function filtroDeLaUrl(estado: string | null | undefined): string {
  return estado === ESTADO_POR_DEBAJO_DEL_MINIMO ? ESTADO_POR_DEBAJO_DEL_MINIMO : 'all';
}
