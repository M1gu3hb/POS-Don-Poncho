/**
 * EL REPARTO DE UNA CUENTA DIVIDIDA, como lo decide la cajera: puro (sin pantalla), para que se
 * pueda probar con semilla. Se reparten UNIDADES por renglón de la tabla de dividir:
 *  - «iguales»: de unidad en unidad, en vuelta, entre las cuentas (nadie lleva más de una de diferencia);
 *  - «por renglón»: cada platillo va completo a una cuenta («yo pago mis tacos»).
 */
import type { AsientoFechado } from '../libro.ts';
import type { Reparto } from '../pantallas/caja-division.ts';
import type { Azar } from '../semilla.ts';

export type ModoDeReparto = 'iguales' | 'por-renglon';

export interface PlanDeDivision {
  readonly modo: ModoDeReparto;
  readonly reparto: Reparto;
}

const sumar = (xs: readonly number[]): number => xs.reduce((s, x) => s + x, 0);

/** Unidad por unidad, en vuelta entre `partes` cuentas. Exige al menos una unidad por cuenta. */
export function repartoIgual(unidades: readonly number[], partes: number): Reparto | null {
  if (partes < 2 || sumar(unidades) < partes) return null;
  const reparto = Array.from({ length: partes }, () => unidades.map(() => 0));
  let turno = 0;
  for (const [i, n] of unidades.entries()) {
    for (let u = 0; u < n; u += 1) {
      const fila = reparto[turno % partes];
      if (fila !== undefined) fila[i] = (fila[i] ?? 0) + 1;
      turno += 1;
    }
  }
  return reparto;
}

/** Cada renglón completo a una cuenta; ninguna cuenta se queda vacía. Exige al menos un renglón por cuenta. */
export function repartoPorRenglon(
  unidades: readonly number[],
  partes: number,
  azar: Azar,
): Reparto | null {
  const renglones = unidades.map((n, i) => ({ n, i })).filter((r) => r.n > 0);
  if (partes < 2 || renglones.length < partes) return null;
  const reparto = Array.from({ length: partes }, () => unidades.map(() => 0));
  for (const [k, r] of azar.barajar(renglones).entries()) {
    const cuenta = k < partes ? k : azar.entero(0, partes - 1);
    const fila = reparto[cuenta];
    if (fila !== undefined) fila[r.i] = r.n;
  }
  return reparto;
}

function conModo(
  modo: ModoDeReparto,
  unidades: readonly number[],
  partes: number,
  azar: Azar,
): PlanDeDivision | null {
  const reparto =
    modo === 'iguales' ? repartoIgual(unidades, partes) : repartoPorRenglon(unidades, partes, azar);
  return reparto === null ? null : { modo, reparto };
}

/**
 * Qué reparto hace la cajera con esta tabla: dos cuentas casi siempre, tres si caben. `null` si la
 * cuenta no se puede dividir (menos de dos unidades).
 */
export function planearDivision(unidades: readonly number[], azar: Azar): PlanDeDivision | null {
  if (sumar(unidades) < 2) return null;
  const partes = azar.probabilidad(0.3) && sumar(unidades) >= 3 ? 3 : 2;
  const modo: ModoDeReparto = azar.probabilidad(0.5) ? 'iguales' : 'por-renglon';
  const intentos: readonly (() => PlanDeDivision | null)[] = [
    () => conModo(modo, unidades, partes, azar),
    () => conModo(modo === 'iguales' ? 'por-renglon' : 'iguales', unidades, partes, azar),
    () => conModo('iguales', unidades, 2, azar),
  ];
  for (const intento of intentos) {
    const plan = intento();
    if (plan !== null) return plan;
  }
  return null;
}

/**
 * El precio de UNA unidad de cada platillo de la cuenta, según el libro (importe ÷ cantidad si la
 * cantidad es entera; lo que vale la línea si es por peso). `null` si el mismo nombre tiene
 * precios distintos (opciones que cambian el precio): ahí la cajera no puede calcularlo de memoria.
 */
export function preciosPorUnidad(
  libro: readonly AsientoFechado[],
  cuenta: string,
): ReadonlyMap<string, number | null> {
  const precios = new Map<string, number | null>();
  for (const { asiento } of libro) {
    if (asiento.tipo !== 'linea' || asiento.cuenta !== cuenta) continue;
    const porUnidad = Number.isInteger(asiento.cantidad)
      ? asiento.importeCentavos / asiento.cantidad
      : asiento.importeCentavos;
    const previo = precios.get(asiento.producto);
    precios.set(asiento.producto, previo === undefined || previo === porUnidad ? porUnidad : null);
  }
  return precios;
}

/** Lo que vale cada cuenta del reparto, o `null` si algún precio no se sabe o no es entero. */
export function totalesDelReparto(
  reparto: Reparto,
  nombres: readonly string[],
  precios: ReadonlyMap<string, number | null>,
): readonly number[] | null {
  const totales: number[] = [];
  for (const fila of reparto) {
    let total = 0;
    for (const [i, unidades] of fila.entries()) {
      if (unidades === 0) continue;
      const precio = precios.get(nombres[i] ?? '');
      if (precio === undefined || precio === null || !Number.isInteger(precio)) return null;
      total += precio * unidades;
    }
    totales.push(total);
  }
  return totales;
}
