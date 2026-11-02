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

const filaDe = (c: Cancelacion) => [
  texto(cuentaDe(c)),
  hora(c.hora),
  texto(c.tipo === 'orden' ? 'Cuenta completa' : (c.producto ?? 'Platillo')),
  texto(c.usuario),
  texto(c.motivo),
  dinero(c.montoCentavos),
];

const sumaDe = (filas: readonly Cancelacion[]): number =>
  filas.reduce((suma, c) => suma + centavos(c.montoCentavos), 0);

/** Los títulos son los que buscan las pruebas y los que lee el dueño: no se cambian a la ligera. */
export const TITULO_DE_CANCELACIONES = 'Cancelaciones antes de prepararse';
export const TITULO_DE_PERDIDAS = 'Pérdidas por cancelación · ya preparado o entregado';

/**
 * Las dos secciones a partir de las filas del servidor. Las usan el corte del servidor
 * (`cancelaciones(hoja)`) y el corte heredado de la Caja (`CorteTicket`): el mismo código arma los
 * dos, así que no pueden decir cosas distintas.
 */
export function seccionesDeCancelaciones(filas: readonly Cancelacion[]): readonly Seccion[] {
  const perdidas = filas.filter((c) => c.perdida);
  const sinCosto = filas.filter((c) => !c.perdida);
  return [
    // La pérdida va primero: es lo que el dueño tiene que ver aunque no lea nada más.
    ...tablaSiHay({
      tipo: 'tabla',
      titulo: TITULO_DE_PERDIDAS,
      tono: 'perdida',
      columnas: COLUMNAS,
      filas: perdidas.map(filaDe),
      total: [texto('TOTAL'), texto(''), texto(''), texto(''), texto(''), dinero(sumaDe(perdidas))],
      nota: 'La cocina ya lo había dejado listo o se entregó: la comida se hizo y no se cobró.',
    }),
    ...tablaSiHay({
      tipo: 'tabla',
      titulo: TITULO_DE_CANCELACIONES,
      columnas: COLUMNAS,
      filas: sinCosto.map(filaDe),
      total: [texto('TOTAL'), texto(''), texto(''), texto(''), texto(''), dinero(sumaDe(sinCosto))],
      nota: 'No costaron comida: se cancelaron antes de que la cocina los dejara listos.',
    }),
  ];
}

export const cancelaciones = (hoja: HojaDelServidor): readonly Seccion[] =>
  seccionesDeCancelaciones(hoja.cancelaciones);
