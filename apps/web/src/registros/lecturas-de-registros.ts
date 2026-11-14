import {
  TOPE_POR_LECTURA,
  leerPeriodoCompleto,
  unirPorId,
  type LecturaDelPeriodo,
  type PeticionDeRango,
  type RangoDePeriodo,
  type TipoDeFecha,
} from './periodo-de-registros.ts';

/**
 * DP-18 · A21 · Cómo lee cada pestaña de Registros: el PERIODO elegido, filtrado en el servidor
 * (`enRango`), y no «las últimas N» filtradas en el navegador.
 */

interface Fila {
  readonly id?: unknown;
  readonly created_date?: string | null;
}

/** Lo único que Registros necesita de una entidad del puente. */
export interface EntidadConRango<T extends Fila> {
  enRango(
    rango: PeticionDeRango,
    donde?: Record<string, never>,
    orden?: string,
    limite?: number,
  ): Promise<readonly T[]>;
}

/** El campo de fecha por el que cada pestaña acota su periodo. */
export const CAMPO_DEL_PERIODO = {
  // Fecha de creación del corte, de la compra-movimiento… (instantes).
  cortes: { campo: 'created_date', tipo: 'fecha' },
  movimientos: { campo: 'created_date', tipo: 'fecha' },
  // Compras y gastos tienen su día contable (`fecha`, un día sin hora).
  compras: { campo: 'fecha', tipo: 'dia' },
  gastos: { campo: 'fecha', tipo: 'dia' },
} as const satisfies Record<string, { campo: string; tipo: TipoDeFecha }>;

const ORDEN_RECIENTES = '-created_date';

export function leerDelPeriodo<T extends Fila>(
  entidad: EntidadConRango<T>,
  campo: string,
  tipo: TipoDeFecha,
  rango: RangoDePeriodo,
): Promise<LecturaDelPeriodo<T>> {
  return leerPeriodoCompleto<T>({
    campo,
    tipo,
    rango,
    leer: (peticion) => entidad.enRango(peticion, {}, ORDEN_RECIENTES, TOPE_POR_LECTURA),
  });
}

/**
 * Las ventas del periodo: las CREADAS en él y las COBRADAS en él. Una cuenta que se abrió la
 * noche anterior y se cobró ya en el periodo cuenta en el resumen (que suma por fecha de cierre)
 * y tiene que estar en la lista; con sólo la fecha de creación faltaba.
 */
export async function leerVentasDelPeriodo<T extends Fila>(
  ventas: EntidadConRango<T>,
  rango: RangoDePeriodo,
): Promise<LecturaDelPeriodo<T>> {
  const [creadas, cobradas] = await Promise.all([
    leerDelPeriodo(ventas, 'created_date', 'fecha', rango),
    leerDelPeriodo(ventas, 'fecha_cierre', 'fecha', rango),
  ]);
  const filas = unirPorId<T>(creadas.filas, cobradas.filas).sort((a, b) =>
    (b.created_date ?? '').localeCompare(a.created_date ?? ''),
  );
  return { filas, truncada: creadas.truncada || cobradas.truncada };
}
