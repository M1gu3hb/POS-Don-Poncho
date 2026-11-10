/**
 * DP-16 · MESAS Y PARA LLEVAR, por separado en el corte, el Cierre del día, Registros y el CSV.
 *
 * Una sola regla para todos: lo que la orden marca `llevar` es «Para llevar»; todo lo demás (las
 * mesas y lo que se cobra sin mesa en el salón) es «Mesas». El canal `aqui` se dice «Aquí» (antes
 * «En taza», heredado de la cafetería).
 */

export type GrupoDeCanal = 'mesas' | 'llevar';

export const NOMBRE_DEL_CANAL: Readonly<Record<string, string>> = {
  aqui: 'Aquí',
  llevar: 'Para llevar',
  plataforma: 'Plataforma',
  anticipado: 'Anticipado',
};

export const NOMBRE_DEL_GRUPO: Readonly<Record<GrupoDeCanal, string>> = {
  mesas: 'Mesas',
  llevar: 'Para llevar',
};

export function grupoDelCanal(canal: string | null | undefined): GrupoDeCanal {
  return canal === 'llevar' ? 'llevar' : 'mesas';
}

export interface SumaDelGrupo {
  readonly cuentas: number;
  readonly totalCentavos: bigint;
}

/** Cuántas cuentas y cuánto vendió cada grupo. Los centavos llegan como texto (R15). */
export function sumaPorGrupo(
  ventas: readonly { readonly canal: string; readonly totalCentavos: string }[],
): Readonly<Record<GrupoDeCanal, SumaDelGrupo>> {
  const suma = {
    mesas: { cuentas: 0, totalCentavos: 0n },
    llevar: { cuentas: 0, totalCentavos: 0n },
  };
  for (const v of ventas) {
    const g = suma[grupoDelCanal(v.canal)];
    g.cuentas += 1;
    g.totalCentavos += BigInt(v.totalCentavos);
  }
  return suma;
}

/** «Llevar 3 · Don Beto»: la referencia de un pedido para llevar en una tabla. */
export function referenciaParaLlevar(
  numero: number | null | undefined,
  nombre: string | null | undefined,
): string {
  const n = typeof numero === 'number' ? ` ${String(numero)}` : '';
  const quien = (nombre ?? '').trim();
  return `Llevar${n}${quien === '' ? '' : ` · ${quien}`}`;
}
