import type { CancelacionDelCorte } from '~/corte/cancelaciones';
import type { CancelacionesDeLaCaja } from '~/corte/cancelaciones-leidas';

/**
 * LAS CANCELACIONES DEL CORTE HEREDADO, SIN QUE UN FALLO SUYO TUMBE EL CORTE (DP-13.4).
 *
 * El visor y la descarga automática del corte (`CorteViewerDialog`, `CorteAutoDownloader`) pedían
 * las cancelaciones junto con las ventas, los gastos y el inventario dentro del mismo
 * `Promise.all`: si el servidor no las contestaba, no había corte (ni PDF). Eso era honesto pero
 * no ayudaba: el dueño necesita el corte aunque falte esa sección.
 *
 * Ahora el corte se pinta igual y, en el lugar de la sección, dice QUE NO SE PUDIERON LEER. Lo que
 * no puede pasar es lo otro: una lista vacía que se lea como «hoy no hubo cancelaciones» (la hoja
 * no pinta una sección sin filas, así que un corte sin cancelaciones y uno que no las pudo leer se
 * verían idénticos). Y el error se registra: un fallo que sólo se ve en pantalla no se arregla.
 */

export interface CancelacionesLeidas {
  readonly filas: readonly CancelacionDelCorte[];
  /** DP-13.2 · De qué hablan (las de esta caja, o el Cierre del día); nulo si no se leyeron. */
  readonly alcance: CancelacionesDeLaCaja['alcance'] | null;
  /** `true`: el servidor no las dio. `filas` va vacío y NO significa «sin cancelaciones». */
  readonly noSePudieronLeer: boolean;
  /** DP-14.6 · Todas las del corte, contadas en SQL: la lista puede venir cortada, esto no. */
  readonly total?: CancelacionesDeLaCaja['total'];
}

/** Lo que dice el corte en el lugar de la sección. Empieza como lo pidió Miguel. */
export const AVISO_SIN_CANCELACIONES = 'No se pudieron leer las cancelaciones';
export const EXPLICACION_SIN_CANCELACIONES =
  'Este corte no dice si las hubo: vuelve a abrirlo para leerlas otra vez.';

/** Dónde se registra el fallo (la consola del navegador, con su motivo). */
function registrarElFallo(error: unknown): void {
  console.error(`${AVISO_SIN_CANCELACIONES} del corte.`, error);
}

/**
 * Lee las cancelaciones con `leer` (la lectura del servidor). Nunca lanza: si falla, registra el
 * error con `registrar` y contesta que no se pudieron leer.
 */
export async function leerCancelacionesSinTrabar(
  leer: () => Promise<CancelacionesDeLaCaja>,
  registrar: (error: unknown) => void = registrarElFallo,
): Promise<CancelacionesLeidas> {
  try {
    const { filas, alcance, total } = await leer();
    return { filas, alcance, noSePudieronLeer: false, ...(total === undefined ? {} : { total }) };
  } catch (error: unknown) {
    registrar(error);
    return { filas: [], alcance: null, noSePudieronLeer: true };
  }
}
