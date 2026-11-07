import {
  centavos,
  dinero,
  hora,
  tablaSiHay,
  texto,
  type Columna,
  type HojaDelServidor,
  type Seccion,
} from './hoja.ts';

/**
 * LAS CANCELACIONES del corte (DP-12.4): las que no costaron comida, y APARTE, resaltadas, las que
 * sí.
 *
 * «Cancelar» dejó de ser cosa sólo de caja: el mesero cancela una cuenta o quita un platillo
 * desde su pantalla. Lo que el dueño necesita ver en el papel es la diferencia entre dos hechos:
 *
 *   · cancelado ANTES de prepararse: se pidió de más o se capturó mal; no costó nada. Queda
 *     registrado con quién, cuándo y por qué, sin ruido.
 *   · cancelado cuando YA estaba preparado o entregado: la comida se hizo y no se cobra. Es una
 *     PÉRDIDA y sale aparte, marcada, con el mismo detalle y su total.
 *
 * Quién y cuándo son los de la CANCELACIÓN (`cancelada_por` / `empleado_anula_id`): el servidor los
 * lee de ahí para este corte y para el heredado de la Caja, que antes ponía a quien cobraba.
 * Es la sección del servidor; el corte heredado pinta la misma (`CorteTicket`).
 *
 * DP-13.2 · La pérdida es lo que VALÍA lo ya hecho (`perdidaCentavos`), no la cuenta: una cuenta
 * con un platillo listo y otro no sale en las dos tablas, cada una con su parte. Y cada tabla dice
 * de qué cancelaciones habla: las de las cuentas de esta caja, o (Cierre del día) todas las de la
 * sucursal (`caja/corte/alcance-del-corte.ts`).
 */

const COLUMNAS: readonly Columna[] = [
  { titulo: 'Cuenta' },
  { titulo: 'Hora' },
  { titulo: 'Qué' },
  { titulo: 'Quién canceló' },
  { titulo: 'Motivo' },
  { titulo: 'Importe', numerica: true },
];

export type CancelacionDelCorte = HojaDelServidor['cancelaciones'][number];
type Cancelacion = CancelacionDelCorte;

/** «Mesa 6 · POS-12»; lo que haya. Una cuenta cancelada sin cobrar no tiene folio. */
const cuentaDe = (c: Cancelacion): string | null =>
  [c.mesa, c.folio].filter((parte) => parte !== null && parte !== '').join(' · ') || null;

/** Una fila con su parte: lo perdido, o lo cancelado sin costo. */
interface Parte {
  readonly c: Cancelacion;
  readonly centavos: number;
  /** La cuenta tenía de las dos: se dice cuál de sus partes es ésta. */
  readonly mixta: boolean;
}

const queDe = ({ c, mixta }: Parte, enLaPerdida: boolean): string => {
  if (c.tipo === 'linea') return c.producto ?? 'Platillo';
  if (!mixta) return 'Cuenta completa';
  return enLaPerdida
    ? 'Cuenta completa · lo ya preparado'
    : 'Cuenta completa · lo que no se preparó';
};

const filaDe = (parte: Parte, enLaPerdida: boolean) => [
  texto(cuentaDe(parte.c)),
  hora(parte.c.hora),
  texto(queDe(parte, enLaPerdida)),
  texto(parte.c.usuario),
  texto(parte.c.motivo),
  dinero(parte.centavos),
];

const sumaDe = (partes: readonly Parte[]): number =>
  partes.reduce((suma, p) => suma + p.centavos, 0);

/** Cada cancelación partida en lo perdido y lo cancelado sin costo; las partes en cero no salen. */
function partir(filas: readonly Cancelacion[]): {
  readonly perdidas: readonly Parte[];
  readonly sinCosto: readonly Parte[];
} {
  const perdidas: Parte[] = [];
  const sinCosto: Parte[] = [];
  for (const c of filas) {
    const perdido = Math.min(centavos(c.perdidaCentavos), centavos(c.montoCentavos));
    const resto = centavos(c.montoCentavos) - perdido;
    const mixta = perdido > 0 && resto > 0;
    if (perdido > 0) perdidas.push({ c, centavos: perdido, mixta });
    // Lo cancelado sin costo sale aunque sea de $0 (una cuenta vacía también queda registrada),
    // salvo que la cuenta fuera toda pérdida.
    if (resto > 0 || perdido === 0) sinCosto.push({ c, centavos: resto, mixta });
  }
  return { perdidas, sinCosto };
}

const MXN = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
const aPesos = (centavosDeDinero: number): string => MXN.format(centavosDeDinero / 100);

/** Lo que el servidor contó en SQL: todas las cancelaciones del corte, quepan o no en la lista. */
export interface TotalDeLasCancelaciones {
  readonly cuantas: number;
  readonly montoCentavos: string;
  readonly perdidaCentavos: string;
}

/**
 * DP-14.6 · La lista del servidor tiene tope de filas. Si hay más cancelaciones que las que
 * llegaron, las tablas lo dicen con el total completo (contado en SQL) en vez de cortar callado.
 */
export function avisoDeLoCortado(
  filas: readonly Cancelacion[],
  total: TotalDeLasCancelaciones | undefined,
): string {
  if (total === undefined || total.cuantas <= filas.length) return '';
  return ` OJO: sólo se muestran ${String(filas.length)} de ${String(total.cuantas)} cancelaciones; el total del corte es ${aPesos(centavos(total.montoCentavos))} (${aPesos(centavos(total.perdidaCentavos))} de pérdida).`;
}

const ALCANCE: Readonly<Record<'caja' | 'dia', string>> = {
  caja: 'Sólo las de las cuentas de esta caja; las demás salen en el Cierre del día.',
  dia: 'Cierre del día: todas las de la sucursal desde el cierre anterior, de todas las cajas y de las mesas sin caja.',
};

/** Los títulos son los que buscan las pruebas y los que lee el dueño: no se cambian a la ligera. */
export const TITULO_DE_CANCELACIONES = 'Cancelaciones antes de prepararse';
export const TITULO_DE_PERDIDAS = 'Pérdidas por cancelación · ya preparado o entregado';

/**
 * Las dos secciones a partir de las filas del servidor. Las usan el corte del servidor
 * (`cancelaciones(hoja)`) y el corte heredado de la Caja (`CorteTicket`): el mismo código arma los
 * dos, así que no pueden decir cosas distintas.
 */
export function seccionesDeCancelaciones(
  filas: readonly Cancelacion[],
  alcance?: 'caja' | 'dia',
  total?: TotalDeLasCancelaciones,
): readonly Seccion[] {
  const { perdidas, sinCosto } = partir(filas);
  const deQue =
    (alcance === undefined ? '' : ` ${ALCANCE[alcance]}`) + avisoDeLoCortado(filas, total);
  return [
    // La pérdida va primero: es lo que el dueño tiene que ver aunque no lea nada más.
    ...tablaSiHay({
      tipo: 'tabla',
      titulo: TITULO_DE_PERDIDAS,
      tono: 'perdida',
      columnas: COLUMNAS,
      filas: perdidas.map((p) => filaDe(p, true)),
      total: [texto('TOTAL'), texto(''), texto(''), texto(''), texto(''), dinero(sumaDe(perdidas))],
      nota: `La cocina ya lo había dejado listo o se entregó: la comida se hizo y no se cobró. Cuenta lo que valía lo ya hecho, no la cuenta entera.${deQue}`,
    }),
    ...tablaSiHay({
      tipo: 'tabla',
      titulo: TITULO_DE_CANCELACIONES,
      columnas: COLUMNAS,
      filas: sinCosto.map((p) => filaDe(p, false)),
      total: [texto('TOTAL'), texto(''), texto(''), texto(''), texto(''), dinero(sumaDe(sinCosto))],
      nota: `No costaron comida: se cancelaron antes de que la cocina los dejara listos.${deQue}`,
    }),
  ];
}

export const cancelaciones = (hoja: HojaDelServidor): readonly Seccion[] =>
  seccionesDeCancelaciones(
    hoja.cancelaciones,
    hoja.alcanceDeCancelaciones,
    hoja.cancelacionesTotal,
  );
