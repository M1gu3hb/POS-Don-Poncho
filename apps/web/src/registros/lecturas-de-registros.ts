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
  // Los movimientos son instantes. Los cortes se leen como las ventas (creación y cierre).
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
 * Lo creado Y lo cerrado en el periodo, unido por `id` y más reciente primero. Una cuenta (o un
 * turno de caja) que se abrió la noche anterior y se cerró ya en el periodo cuenta en el resumen
 * (que suma por fecha de cierre) y tiene que estar en la lista; con sólo la fecha de creación
 * faltaba.
 */
export async function leerCreadasYCerradasDelPeriodo<T extends Fila>(
  entidad: EntidadConRango<T>,
  rango: RangoDePeriodo,
): Promise<LecturaDelPeriodo<T>> {
  const [creadas, cerradas] = await Promise.all([
    leerDelPeriodo(entidad, 'created_date', 'fecha', rango),
    leerDelPeriodo(entidad, 'fecha_cierre', 'fecha', rango),
  ]);
  const filas = unirPorId<T>(creadas.filas, cerradas.filas).sort((a, b) =>
    (b.created_date ?? '').localeCompare(a.created_date ?? ''),
  );
  return { filas, truncada: creadas.truncada || cerradas.truncada };
}

/** Las ventas del periodo: las creadas en él y las cobradas en él. */
export const leerVentasDelPeriodo = leerCreadasYCerradasDelPeriodo;

/** Los cortes del periodo: los abiertos en él y los cerrados en él (un turno cruza la medianoche). */
export const leerCortesDelPeriodo = leerCreadasYCerradasDelPeriodo;

/**
 * Cómo se piden TODAS las lecturas de Registros (cada `useQuery` las esparce).
 *
 * · Sin `placeholderData`: al cambiar de periodo la clave es otra y `data` queda vacío mientras
 *   llega lo nuevo. Con «los datos anteriores» el resumen, las listas, el CSV y el PDF enseñaban el
 *   periodo viejo bajo el rótulo del nuevo.
 * · `staleTime` de un minuto y sin relectura al volver a la ventana: cada lectura puede ser varias
 *   peticiones por ventanas. Las invalidaciones de las escrituras siguen refrescando al momento.
 */
export const OPCIONES_DE_LECTURA = {
  staleTime: 60_000,
  refetchOnWindowFocus: false,
} as const;
