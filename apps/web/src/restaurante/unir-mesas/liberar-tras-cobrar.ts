/**
 * DP-17 (QA de DP-16, R5) · LIBERAR LA MESA TRAS COBRAR, TAMBIÉN CON LA CUENTA DIVIDIDA.
 *
 * Una parte de una cuenta dividida nace sin mesa (`division.ts`); la mesa es de su cuenta madre.
 * Tras cobrar cualquier venta se intenta liberar la mesa que le toca: la propia o la de la madre.
 * Con partes todavía sin cobrar, el servidor se niega (`MESA_NO_LIBERABLE`, `partesSinCobrar`) y
 * eso no es un error para la cajera: la mesa se libera al cobrar la última. Con mesas unidas sale la
 * pregunta de siempre (`liberarConDecision`).
 */

import {
  liberarConDecision,
  reglaDe,
  type DecisionDelGrupo,
  type EjecutarLiberar,
} from './liberar-mesa';

interface VentaCobrada {
  readonly mesa_id?: string | null;
  readonly orden_padre_id?: string | null;
}

export async function mesaParaLiberarTrasCobrar(
  venta: VentaCobrada,
  leerMadre: (ordenId: string) => Promise<{ readonly mesa_id?: string | null } | null>,
): Promise<string | null> {
  if (typeof venta.mesa_id === 'string' && venta.mesa_id !== '') return venta.mesa_id;
  const madre = venta.orden_padre_id;
  if (typeof madre !== 'string' || madre === '') return null;
  const deLaMadre = (await leerMadre(madre))?.mesa_id;
  return typeof deLaMadre === 'string' && deLaMadre !== '' ? deLaMadre : null;
}

/** ¿El servidor dijo que aún faltan partes de la cuenta por cobrar? */
function faltanPartes(error: unknown): boolean {
  if (reglaDe(error) !== 'MESA_NO_LIBERABLE') return false;
  const { error: detalle, datos } = error as {
    error?: { datos?: Readonly<Record<string, unknown>> };
    datos?: Readonly<Record<string, unknown>>;
  };
  const partes = detalle?.datos?.['partesSinCobrar'] ?? datos?.['partesSinCobrar'];
  return typeof partes === 'number' && partes > 0;
}

export type ResultadoTrasCobrar = 'liberada' | 'sin-liberar' | 'faltan-partes';

/**
 * `esParte`: lo cobrado era una parte de una cuenta dividida. Al navegador sólo llega la regla del
 * error (`comando.ts` no manda sus datos), así que con una parte «no liberable» quiere decir que
 * faltan las otras: no se avisa (QA ronda 3).
 */
export async function liberarTrasCobrar(
  mesaId: string,
  ejecutar: EjecutarLiberar,
  preguntar: () => Promise<DecisionDelGrupo | null>,
  esParte = false,
): Promise<ResultadoTrasCobrar> {
  try {
    return (await liberarConDecision(mesaId, ejecutar, preguntar)) ? 'liberada' : 'sin-liberar';
  } catch (error: unknown) {
    if (faltanPartes(error)) return 'faltan-partes';
    if (esParte && reglaDe(error) === 'MESA_NO_LIBERABLE') return 'faltan-partes';
    throw error;
  }
}
