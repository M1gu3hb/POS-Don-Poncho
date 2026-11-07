import { invocarComando } from '~/cliente/api';

import type { CancelacionDelCorte } from './cancelaciones.ts';

/**
 * LAS CANCELACIONES, tal como las lee el servidor, para las pantallas heredadas (DP-12.4).
 *
 * El corte heredado de la Caja (`CorteViewerDialog`, `CorteAutoDownloader`) y Registros las armaban
 * en el navegador desde las ventas y ponían como «Usuario» al cajero o al mesero de la venta, no a
 * quien canceló; y un platillo anulado no aparecía. Ahora piden al servidor la misma lectura que
 * arma la hoja del corte (`caja/corte/cancelaciones.ts`).
 *
 * Si el servidor no contesta bien NO se adivina una lista vacía: un corte sin sus cancelaciones se
 * vería idéntico a uno sin ninguna. Se lanza, y quien llama ya dice que no pudo cargar.
 */

function esFila(valor: unknown): valor is CancelacionDelCorte {
  if (typeof valor !== 'object' || valor === null) return false;
  const fila = valor as Readonly<Record<string, unknown>>;
  return (
    (fila['tipo'] === 'orden' || fila['tipo'] === 'linea') &&
    typeof fila['montoCentavos'] === 'string' &&
    typeof fila['perdidaCentavos'] === 'string' &&
    typeof fila['perdida'] === 'boolean'
  );
}

function filasDe(respuesta: unknown): readonly CancelacionDelCorte[] {
  const lista =
    typeof respuesta === 'object' && respuesta !== null
      ? (respuesta as Readonly<Record<string, unknown>>)['cancelaciones']
      : undefined;
  if (!Array.isArray(lista) || !(lista as readonly unknown[]).every(esFila)) {
    throw new Error('El servidor no mandó las cancelaciones con la forma esperada.');
  }
  return lista as readonly CancelacionDelCorte[];
}

/** DP-13.2 · Las del corte de UNA caja y de qué hablan: sus cuentas, o el Cierre del día. */
export interface CancelacionesDeLaCaja {
  readonly filas: readonly CancelacionDelCorte[];
  readonly alcance: 'caja' | 'dia';
  /** DP-14.6 · Todas las del corte (contadas en SQL); `undefined` con un servidor de antes. */
  readonly total?: { cuantas: number; montoCentavos: string; perdidaCentavos: string };
}

/** Las cancelaciones del corte de UNA caja, en el orden en que pasaron. */
export async function cancelacionesDeLaCaja(sesionCajaId: string): Promise<CancelacionesDeLaCaja> {
  const respuesta = await invocarComando<unknown>('/api/caja/cancelaciones-del-corte', {
    sesionCajaId,
  });
  const alcance =
    typeof respuesta === 'object' && respuesta !== null
      ? (respuesta as Readonly<Record<string, unknown>>)['alcance']
      : undefined;
  if (alcance !== 'caja' && alcance !== 'dia') {
    throw new Error('El servidor no mandó las cancelaciones con la forma esperada.');
  }
  const total = (respuesta as Readonly<Record<string, unknown>>)['total'];
  const esTotal = (v: unknown): v is NonNullable<CancelacionesDeLaCaja['total']> =>
    typeof v === 'object' &&
    v !== null &&
    typeof (v as Record<string, unknown>)['cuantas'] === 'number' &&
    typeof (v as Record<string, unknown>)['montoCentavos'] === 'string' &&
    typeof (v as Record<string, unknown>)['perdidaCentavos'] === 'string';
  return { filas: filasDe(respuesta), alcance, ...(esTotal(total) ? { total } : {}) };
}

/** Las de los últimos `dias`, lo más reciente primero (Registros). */
export async function cancelacionesRegistradas(
  dias?: number,
): Promise<readonly CancelacionDelCorte[]> {
  return filasDe(
    await invocarComando<unknown>(
      '/api/caja/cancelaciones-registradas',
      dias === undefined ? {} : { dias },
    ),
  );
}
