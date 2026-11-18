/**
 * DP-D178 · EL ARQUEO POR BILLETES Y MONEDAS (la cuenta, sin pantalla).
 *
 * `caja.cerrar` recibe `denominaciones` (`[{ denominacionCentavos, piezas }]`) y rechaza el cierre si
 * no suman el efectivo contado: aquí el total sale de las piezas, así que no puede no sumar. Cada
 * denominación va UNA vez (el billete y la moneda de $20 son la misma fila).
 */

export interface Denominacion {
  readonly centavos: number;
  readonly etiqueta: string;
  readonly tipo: 'billete' | 'moneda';
}

export const DENOMINACIONES: readonly Denominacion[] = [
  { centavos: 100_000, etiqueta: '$1,000', tipo: 'billete' },
  { centavos: 50_000, etiqueta: '$500', tipo: 'billete' },
  { centavos: 20_000, etiqueta: '$200', tipo: 'billete' },
  { centavos: 10_000, etiqueta: '$100', tipo: 'billete' },
  { centavos: 5_000, etiqueta: '$50', tipo: 'billete' },
  { centavos: 2_000, etiqueta: '$20', tipo: 'billete' },
  { centavos: 1_000, etiqueta: '$10', tipo: 'moneda' },
  { centavos: 500, etiqueta: '$5', tipo: 'moneda' },
  { centavos: 200, etiqueta: '$2', tipo: 'moneda' },
  { centavos: 100, etiqueta: '$1', tipo: 'moneda' },
  { centavos: 50, etiqueta: '50 centavos', tipo: 'moneda' },
];

/** Las piezas contadas, por denominación en centavos. */
export type PiezasContadas = Readonly<Record<number, number>>;

/** El máximo de piezas por denominación que acepta el servidor. */
export const MAXIMO_DE_PIEZAS = 100_000;

const esPieza = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n > 0;

/** Lo que valen todas las piezas, en centavos. Lo que no es una pieza válida no cuenta. */
export function sumaDelConteo(piezas: PiezasContadas): number {
  return DENOMINACIONES.reduce((suma, d) => {
    const n = piezas[d.centavos];
    return esPieza(n) ? suma + d.centavos * n : suma;
  }, 0);
}

/** El conteo como lo pide el servidor: sólo lo que tiene piezas, de mayor a menor. */
export function denominacionesParaEnviar(
  piezas: PiezasContadas,
): readonly { denominacionCentavos: number; piezas: number }[] {
  return DENOMINACIONES.flatMap((d) => {
    const n = piezas[d.centavos];
    return esPieza(n) ? [{ denominacionCentavos: d.centavos, piezas: n }] : [];
  });
}

/** Lo que se tecleó en una fila: dígitos son piezas; lo demás, cero; con tope. */
export function piezasDe(texto: string): number {
  if (!/^\d+$/.test(texto)) return 0;
  return Math.min(Number(texto), MAXIMO_DE_PIEZAS);
}
