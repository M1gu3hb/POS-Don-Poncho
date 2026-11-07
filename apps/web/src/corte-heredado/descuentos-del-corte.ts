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
  readonly totalCentavos: string;
  readonly alcance: 'caja' | 'dia';
}

export interface DescuentosLeidos {
  readonly filas: readonly DescuentoDelCorte[];
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
      totalCentavos: Number(leidos.totalCentavos),
      alcance: leidos.alcance,
      noSePudieronLeer: false,
    };
  } catch (error: unknown) {
    registrar(error);
    return { filas: [], totalCentavos: 0, alcance: null, noSePudieronLeer: true };
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
