import { invocarComando } from '~/cliente/api';

/**
 * LOS DESCUENTOS DEL CORTE HEREDADO, uno por uno (DP-14.2, decisión DP-D61).
 *
 * El PDF del corte de la Caja (y el del Cierre del día, que es el corte de la última caja) trae
 * cada descuento con cuánto, quién lo autorizó con su PIN y por qué: los lee del servidor
 * (`caja.descuentos_del_corte`), igual que las cancelaciones. Si la lectura falla el PDF se
 * genera igual, pero la sección lo DICE: una lista vacía parecería «sin descuentos».
 */

export interface DescuentoDelCorte {
  readonly ordenId: string;
  readonly folio: string | null;
  readonly mesa: number | null;
  readonly montoCentavos: string;
  readonly autorizo: string | null;
  readonly motivo: string | null;
  readonly cuando: string | null;
}

interface DescuentosDelServidor {
  readonly descuentos: readonly DescuentoDelCorte[];
  /** Cuántos son en total (SQL): mayor que `descuentos.length` si la lista se cortó. */
  readonly cuantos: number;
  readonly totalCentavos: string;
  readonly alcance: 'caja' | 'dia';
}

export interface DescuentosLeidos {
  readonly filas: readonly DescuentoDelCorte[];
  /** Cuántos descuentos tuvo el corte en total (no sólo los de `filas`). */
  readonly cuantos: number;
  readonly totalCentavos: number;
  /** De qué hablan: los de esta caja, o los del día; nulo si no se leyeron. */
  readonly alcance: 'caja' | 'dia' | null;
  /** `true`: el servidor no los dio. `filas` va vacío y NO significa «sin descuentos». */
  readonly noSePudieronLeer: boolean;
}

export const AVISO_SIN_DESCUENTOS = 'No se pudieron leer los descuentos';
export const EXPLICACION_SIN_DESCUENTOS =
  'Este corte no dice si los hubo: vuelve a abrirlo para leerlos otra vez.';

function registrarElFallo(error: unknown): void {
  console.error(`${AVISO_SIN_DESCUENTOS} del corte.`, error);
}

export async function leerDescuentosDelCorte(
  sesionCajaId: string,
  leer: (id: string) => Promise<DescuentosDelServidor> = (id) =>
    invocarComando<DescuentosDelServidor>('/api/caja/descuentos-del-corte', { sesionCajaId: id }),
  registrar: (error: unknown) => void = registrarElFallo,
): Promise<DescuentosLeidos> {
  try {
    const leidos = await leer(sesionCajaId);
    return {
      filas: leidos.descuentos,
      cuantos: leidos.cuantos,
      totalCentavos: Number(leidos.totalCentavos),
      alcance: leidos.alcance,
      noSePudieronLeer: false,
    };
  } catch (error: unknown) {
    registrar(error);
    return { filas: [], cuantos: 0, totalCentavos: 0, alcance: null, noSePudieronLeer: true };
  }
}

/** La cuenta como la reconoce quien lee el corte: «Mesa 4 · folio 12», o el folio solo. */
export function cuentaDelDescuento(fila: DescuentoDelCorte): string {
  const folio = fila.folio === null ? null : `folio ${fila.folio}`;
  const mesa = fila.mesa === null ? null : `Mesa ${String(fila.mesa)}`;
  return [mesa, folio].filter((parte): parte is string => parte !== null).join(' · ') || '—';
}

export function tituloDeLosDescuentos(alcance: DescuentosLeidos['alcance']): string {
  return alcance === 'dia' ? 'Descuentos del día' : 'Descuentos de esta caja';
}

/**
 * Ronda 2 · Si el servidor cortó la lista (el tope es el freno de la lectura, no de la suma), el
 * papel lo dice con las cuentas completas; `null` si se vio todo o no se leyó.
 */
export function avisoDeLosDescuentosCortados(leidos: DescuentosLeidos): string | null {
  if (leidos.noSePudieronLeer || leidos.cuantos <= leidos.filas.length) return null;
  return `Sólo se muestran ${String(leidos.filas.length)} de ${String(leidos.cuantos)} descuentos; el total del corte los incluye a todos.`;
}
