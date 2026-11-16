import { centavos as aCentavos, formatear } from '@morphiqpos/domain/dinero';

/** «$1,500.00»: el mismo texto que `<Dinero>`, sin traer la capa de React a una función pura. */
const dineroEnTexto = (valor: number): string =>
  formatear(aCentavos(BigInt(Math.round(valor))), 'MXN');

/**
 * «¿CÓMO VA TU SEMANA?» EN EL NAVEGADOR (DP-21 · Bloque 13). Puro.
 *
 * Lo que llega de `tablero.serie` (agregado en el servidor, en centavos enteros y por día del
 * negocio) se vuelve las series de la gráfica y lo que dice cada barra. Aquí no se suma dinero: el
 * servidor ya lo sumó. Sólo se lee, se compara y se dice.
 */

export type Periodo = 'hoy' | 'semana' | 'mes' | 'anio';

export interface DeLaReferencia {
  readonly ventasCentavos: string;
  readonly cuentas: number;
  readonly ticketPromedioCentavos: string;
}

export interface FilaDeLaSerie {
  readonly clave: string;
  readonly etiqueta: string;
  readonly ventasCentavos: string;
  readonly cuentas: number;
  readonly ticketPromedioCentavos: string;
  readonly gastosCentavos: string | null;
  readonly costoCentavos: string;
  readonly utilidadBrutaCentavos: string;
  readonly referencia: DeLaReferencia | null;
  readonly diferenciaCentavos: string | null;
}

export interface TotalesDeLaSerie {
  readonly ventasCentavos: string;
  readonly cuentas: number;
  readonly ticketPromedioCentavos: string;
  readonly costoCentavos: string;
  readonly ventaConCostoCentavos: string;
  readonly utilidadBrutaCentavos: string;
  readonly gastosCentavos: string;
  readonly utilidadNetaCentavos: string;
  readonly sinReceta: number;
  readonly recetaIncompleta: number;
  readonly sinCostoConocido: boolean;
  readonly referencia: DeLaReferencia | null;
}

export interface SerieDelServidor {
  readonly periodo: Periodo;
  readonly agrupar: 'hora' | 'dia' | 'mes';
  readonly hoy: string;
  readonly filas: readonly FilaDeLaSerie[];
  readonly totales: TotalesDeLaSerie;
}

export const PERIODOS_PARA_ELEGIR: readonly { readonly clave: Periodo; readonly nombre: string }[] =
  [
    { clave: 'semana', nombre: 'Esta semana' },
    { clave: 'hoy', nombre: 'Hoy' },
    { clave: 'mes', nombre: 'Este mes' },
    { clave: 'anio', nombre: 'Este año' },
  ];

/** Cómo se llama lo que sirve de referencia en cada periodo. */
export const NOMBRE_DE_LA_REFERENCIA: Readonly<Record<Periodo, string | null>> = {
  semana: 'Semana pasada',
  hoy: 'Mismo día, semana pasada',
  mes: 'Mes pasado',
  anio: null,
};

const NOMBRE_DE_LO_ACTUAL: Readonly<Record<Periodo, string>> = {
  semana: 'Esta semana',
  hoy: 'Hoy',
  mes: 'Este mes',
  anio: 'Este año',
};

const centavos = (texto: string): number => Number(texto);

export interface SerieParaGraficar {
  readonly etiqueta: string;
  readonly valores: readonly number[];
}

/**
 * Las series de la gráfica, en centavos: las ventas, la referencia tenue si el periodo la tiene y,
 * con «Ver gastos y utilidad», los gastos y la utilidad neta de cada barra. Por hora no hay gastos
 * (son del día), así que ahí el interruptor sólo agrega la utilidad bruta.
 */
export function seriesDeLaGrafica(
  serie: SerieDelServidor,
  conGastosYUtilidad: boolean,
): { readonly ejes: readonly string[]; readonly series: readonly SerieParaGraficar[] } {
  const ejes = serie.filas.map((f) => f.etiqueta);
  const series: SerieParaGraficar[] = [
    {
      etiqueta: NOMBRE_DE_LO_ACTUAL[serie.periodo],
      valores: serie.filas.map((f) => centavos(f.ventasCentavos)),
    },
  ];
  const nombreDeLaReferencia = NOMBRE_DE_LA_REFERENCIA[serie.periodo];
  if (nombreDeLaReferencia !== null) {
    series.push({
      etiqueta: nombreDeLaReferencia,
      valores: serie.filas.map((f) => centavos(f.referencia?.ventasCentavos ?? '0')),
    });
  }
  if (conGastosYUtilidad) {
    if (serie.agrupar !== 'hora') {
      series.push({
        etiqueta: 'Gastos',
        valores: serie.filas.map((f) => centavos(f.gastosCentavos ?? '0')),
      });
      series.push({
        etiqueta: 'Utilidad neta',
        valores: serie.filas.map((f) =>
          Math.max(0, centavos(f.utilidadBrutaCentavos) - centavos(f.gastosCentavos ?? '0')),
        ),
      });
    } else {
      series.push({
        etiqueta: 'Utilidad bruta',
        valores: serie.filas.map((f) => Math.max(0, centavos(f.utilidadBrutaCentavos))),
      });
    }
  }
  return { ejes, series };
}

/** «+$300.00», «-$100.01» o «igual»: la diferencia contra la referencia. */
export function diferenciaEnPalabras(diferenciaCentavos: string | null): string | null {
  if (diferenciaCentavos === null) return null;
  const n = centavos(diferenciaCentavos);
  if (n === 0) return 'igual que la referencia';
  return `${n > 0 ? '+' : '-'}${dineroEnTexto(Math.abs(n))} contra la referencia`;
}

/**
 * Lo que dice una barra de VENTAS al pasar el dedo: ventas, cuentas, ticket promedio y la
 * diferencia contra la cubeta de antes (el mismo día de la semana pasada).
 */
export function detalleDeLaBarra(
  serie: SerieDelServidor,
  fila: FilaDeLaSerie,
  nombreDeLaSerie: string,
  esLaDeLaReferencia: boolean,
): string {
  if (esLaDeLaReferencia) {
    const r = fila.referencia;
    return r === null
      ? `${nombreDeLaSerie} · ${fila.etiqueta}: sin referencia`
      : `${nombreDeLaSerie} · ${fila.etiqueta}: ${dineroEnTexto(centavos(r.ventasCentavos))} en ${String(r.cuentas)} cuentas`;
  }
  const partes = [
    `${nombreDeLaSerie} · ${fila.etiqueta}: ${dineroEnTexto(centavos(fila.ventasCentavos))}`,
    `${String(fila.cuentas)} ${fila.cuentas === 1 ? 'cuenta' : 'cuentas'}`,
    `ticket promedio ${dineroEnTexto(centavos(fila.ticketPromedioCentavos))}`,
  ];
  const diferencia = diferenciaEnPalabras(fila.diferenciaCentavos);
  if (diferencia !== null && NOMBRE_DE_LA_REFERENCIA[serie.periodo] !== null) {
    partes.push(
      diferencia.replace(
        'la referencia',
        (NOMBRE_DE_LA_REFERENCIA[serie.periodo] ?? '').toLowerCase(),
      ),
    );
  }
  return partes.join(' · ');
}

/** La utilidad bruta sobre la venta con costo conocido, o `null` si no hay (no se inventa). */
export function margenEnTexto(totales: TotalesDeLaSerie): string | null {
  if (totales.sinCostoConocido) return null;
  const base = centavos(totales.ventaConCostoCentavos);
  if (base <= 0) return null;
  return `${((centavos(totales.utilidadBrutaCentavos) / base) * 100).toFixed(1)}%`;
}
