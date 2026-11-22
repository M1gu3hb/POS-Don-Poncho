/**
 * DP-25 · P6 — LO QUE SE DICE AL UNIR O AGREGAR MESAS: por cada mesa que traía consumo, a dónde
 * fue su cuenta («La cuenta de la mesa 7 pasó a la mesa 3.»). Los datos los trae el comando
 * (`cuentasQuePasaron`); aquí sólo se escriben.
 */

export interface CuentaQuePaso {
  readonly desdeMesa: number;
  readonly aMesa: number;
}

export function avisosDeLaUnion(cuentas: readonly CuentaQuePaso[] | undefined): readonly string[] {
  return (cuentas ?? []).map(
    (c) => `La cuenta de la mesa ${String(c.desdeMesa)} pasó a la mesa ${String(c.aMesa)}.`,
  );
}
