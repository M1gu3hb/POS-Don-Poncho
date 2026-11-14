import {
  endOfDay,
  endOfMonth,
  startOfDay,
  startOfMonth,
  startOfYear,
  subDays,
  parseISO,
  format,
} from 'date-fns';

/**
 * DP-18 · A21 · LOS REGISTROS PIDEN SU PERIODO, NO «LAS ÚLTIMAS N».
 *
 * `Registros` bajaba las últimas 1 000 ventas (200 cortes, 300 compras…) y filtraba en el
 * navegador: pasado el tope, lo viejo desaparecía del historial, de la búsqueda, del rótulo
 * «N cobradas» y del CSV SIN AVISO. Don Poncho vende ~200 cuentas al día: llegaba al tope en 5.
 *
 * Aquí vive lo que las pantallas necesitan para pedirle al servidor el periodo elegido:
 *   · el rango de cada periodo (el mismo para el resumen y para las listas);
 *   · la lectura por VENTANAS: el puente no devuelve más de `TOPE_POR_LECTURA` filas por petición,
 *     así que si una ventana llega al tope se parte por la mitad y se vuelve a pedir, hasta cubrir
 *     el periodo o llegar a un techo de seguridad;
 *   · el aviso para cuando, aun así, quede algo sin traer.
 */

/** Lo máximo que el puente devuelve por petición (`LIMITE_MAXIMO` de `puente/tipos.ts`). */
export const TOPE_POR_LECTURA = 1000;

/** Lo máximo que una pestaña junta entre todas las ventanas: más allá se avisa, no se calla. */
export const TECHO_DE_SEGURIDAD = 10_000;

export type IdDePeriodo = 'today' | '7d' | '30d' | 'mes' | 'year' | 'custom';

export interface RangoDePeriodo {
  readonly from: Date;
  readonly to: Date;
}

/**
 * Las fechas del rango «personalizado» llegan como `yyyy-MM-dd`: se leen en HORA LOCAL
 * (`parseISO`). `new Date('2026-11-10')` es la medianoche UTC, que en México es el día anterior:
 * el rango arrancaba un día antes y terminaba un día antes.
 */
function diaLocal(texto: string, respaldo: Date): Date {
  const d = parseISO(texto);
  return Number.isNaN(d.getTime()) ? respaldo : d;
}

export function rangoDelPeriodo(
  periodo: IdDePeriodo,
  desde: string,
  hasta: string,
  ahora: Date = new Date(),
): RangoDePeriodo {
  if (periodo === 'today') return { from: startOfDay(ahora), to: endOfDay(ahora) };
  if (periodo === '7d') return { from: startOfDay(subDays(ahora, 6)), to: endOfDay(ahora) };
  if (periodo === '30d') return { from: startOfDay(subDays(ahora, 29)), to: endOfDay(ahora) };
  if (periodo === 'mes') return { from: startOfMonth(ahora), to: endOfMonth(ahora) };
  if (periodo === 'year') return { from: startOfYear(ahora), to: endOfDay(ahora) };
  return {
    from: startOfDay(diaLocal(desde, ahora)),
    to: endOfDay(diaLocal(hasta, ahora)),
  };
}

/** Cómo guarda el servidor la fecha de la que se pide el rango. */
export type TipoDeFecha = 'fecha' | 'dia';

export interface PeticionDeRango {
  readonly campo: string;
  readonly desde: string;
  readonly hasta: string;
}

export interface LecturaDelPeriodo<T> {
  readonly filas: readonly T[];
  /** `true` si quedó algo sin traer (una ventana mínima o el techo de seguridad). */
  readonly truncada: boolean;
}

const MS_POR_DIA = 86_400_000;
const GRANULARIDAD_FECHA = 60_000; // no se parte una ventana de menos de un minuto

/** Un `yyyy-MM-dd` local como número de día (UTC), para partir rangos de días. */
function numeroDeDia(fecha: Date): number {
  const [a = 1970, m = 1, d = 1] = format(fecha, 'yyyy-MM-dd').split('-').map(Number);
  return Math.floor(Date.UTC(a, m - 1, d) / MS_POR_DIA);
}

function textoDeDia(numero: number): string {
  return new Date(numero * MS_POR_DIA).toISOString().slice(0, 10);
}

interface Particion {
  readonly desde: number;
  readonly hasta: number;
  /** Menor ancho (hasta − desde) que todavía se puede partir en dos. */
  readonly anchoMinimo: number;
  readonly aPeticion: (desde: number, hasta: number) => Pick<PeticionDeRango, 'desde' | 'hasta'>;
}

function particionDe(tipo: TipoDeFecha, rango: RangoDePeriodo): Particion {
  if (tipo === 'dia') {
    return {
      desde: numeroDeDia(rango.from),
      hasta: numeroDeDia(rango.to),
      anchoMinimo: 1,
      aPeticion: (d, h) => ({ desde: textoDeDia(d), hasta: textoDeDia(h) }),
    };
  }
  return {
    desde: rango.from.getTime(),
    hasta: rango.to.getTime(),
    anchoMinimo: GRANULARIDAD_FECHA,
    aPeticion: (d, h) => ({ desde: new Date(d).toISOString(), hasta: new Date(h).toISOString() }),
  };
}

/**
 * Trae TODAS las filas del periodo.
 *
 * `leer` hace UNA petición al puente (con su tope). Si devuelve menos filas que el tope, esa
 * ventana está completa; si llega al tope puede haber más detrás: se parte la ventana por la
 * mitad (los dos extremos son inclusivos en el servidor, por eso la segunda mitad arranca una
 * unidad después) y se piden las dos. Las filas repetidas se quitan por `id`.
 */
export async function leerPeriodoCompleto<T extends { readonly id?: unknown }>(opciones: {
  readonly campo: string;
  readonly tipo: TipoDeFecha;
  readonly rango: RangoDePeriodo;
  readonly leer: (peticion: PeticionDeRango) => Promise<readonly T[]>;
  readonly tope?: number;
  readonly techo?: number;
}): Promise<LecturaDelPeriodo<T>> {
  const tope = opciones.tope ?? TOPE_POR_LECTURA;
  const techo = opciones.techo ?? TECHO_DE_SEGURIDAD;
  const p = particionDe(opciones.tipo, opciones.rango);
  const vistas = new Map<unknown, T>();
  const sinId: T[] = [];
  let truncada = false;

  const guardar = (filas: readonly T[]): void => {
    for (const f of filas) {
      if (f.id === undefined || f.id === null) sinId.push(f);
      else vistas.set(f.id, f);
    }
  };
  const juntas = (): number => vistas.size + sinId.length;

  const ventana = async (desde: number, hasta: number): Promise<void> => {
    const filas = await opciones.leer({ campo: opciones.campo, ...p.aPeticion(desde, hasta) });
    guardar(filas);
    if (filas.length < tope) return;
    if (hasta - desde < p.anchoMinimo) {
      truncada = true;
      return;
    }
    const mitad = Math.floor((desde + hasta) / 2);
    // Las filas de esta ventana ya están guardadas: al pedir las mitades se repiten y el `id` las une.
    await ventana(desde, mitad);
    if (juntas() >= techo) {
      truncada = true;
      return;
    }
    await ventana(mitad + 1, hasta);
  };

  if (p.hasta >= p.desde) await ventana(p.desde, p.hasta);
  return { filas: [...vistas.values(), ...sinId], truncada };
}

/** Une listas de filas por `id` (la primera gana). */
export function unirPorId<T extends { readonly id?: unknown }>(
  ...listas: readonly (readonly T[])[]
): T[] {
  const mapa = new Map<unknown, T>();
  const sinId: T[] = [];
  for (const lista of listas) {
    for (const f of lista) {
      if (f.id === undefined || f.id === null) sinId.push(f);
      else if (!mapa.has(f.id)) mapa.set(f.id, f);
    }
  }
  return [...mapa.values(), ...sinId];
}

/**
 * El aviso cuando quedó algo sin traer. `null` si todo el periodo está en pantalla.
 * El texto dice cuántas se muestran y qué hacer: un periodo más corto.
 */
export function avisoDelTopeDeRegistros(
  nombre: string,
  mostradas: number,
  truncada: boolean,
): string | null {
  if (!truncada) return null;
  return (
    `Se muestran las ${mostradas.toLocaleString('es-MX')} ${nombre} más recientes del periodo; ` +
    'hay más. Elige un periodo más corto para verlas todas: la búsqueda y lo que exportes ' +
    'sólo incluyen lo que se muestra.'
  );
}
