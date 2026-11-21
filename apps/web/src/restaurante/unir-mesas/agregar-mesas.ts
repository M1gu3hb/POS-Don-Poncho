import type { MesaEnPlano } from '@morphiqpos/domain/sala';

import { juntarAlGrupo, mesasEnPlano, type MesaDelPlanoDeUnion } from './plano-de-union';

/**
 * «AGREGAR MESAS» A UN GRUPO YA UNIDO (DP-24 · P5), del lado de la pantalla: qué mesas se ofrecen
 * y dónde queda cada una en el plano al juntarlas. Qué se acepta lo decide el servidor
 * (`reglas-de-agregar.ts`): aquí sólo se evita ofrecer lo que seguro se rechaza.
 */

export interface MesaParaAgregar extends MesaDelPlanoDeUnion {
  readonly zona?: string | null;
}

/**
 * Las mesas que se pueden sumar al grupo: en servicio, no ocultas en un grupo (las del propio
 * grupo y las de otro están absorbidas: de otro grupo se agrega su PRINCIPAL, con todo su grupo),
 * sin ser la principal ni estar en limpieza. Por número.
 */
export function mesasQueSePuedenAgregar(
  mesas: readonly MesaParaAgregar[],
  principalId: string,
): readonly MesaParaAgregar[] {
  return mesas
    .filter(
      (m) =>
        m.id !== principalId && (m.unida_a_mesa_id ?? null) === null && m.estado !== 'limpieza',
    )
    .sort((a, b) => a.numero - b.numero);
}

/** Las mesas que viajan con una elegida: ella y, si encabeza otro grupo, todas las suyas. */
function bloqueDe(elegida: string, mesas: readonly MesaDelPlanoDeUnion[]): readonly string[] {
  return [elegida, ...mesas.filter((m) => m.unida_a_mesa_id === elegida).map((m) => m.id)];
}

/**
 * Dónde queda cada mesa que se agrega: se pega al grupo con el mismo imán de «Unir mesas» (a la
 * derecha, o debajo si estorba), una tras otra. Si la elegida encabeza otro grupo, todo su grupo
 * se corre lo mismo que ella: sigue siendo el mismo bloque. `mesas` trae TODAS las del salón
 * (también las ocultas), y `grupo` las del grupo al que se agrega.
 */
export function posicionesAlAgregar(
  mesas: readonly MesaDelPlanoDeUnion[],
  grupo: readonly string[],
  elegidas: readonly string[],
): readonly { readonly mesaId: string; readonly x: number; readonly y: number }[] {
  let plano: readonly MesaEnPlano[] = mesasEnPlano(mesas);
  let delGrupo: readonly string[] = grupo;
  const salida: { mesaId: string; x: number; y: number }[] = [];
  for (const elegida of elegidas) {
    const bloque = bloqueDe(elegida, mesas);
    const actual = plano.find((m) => m.id === elegida);
    if (actual === undefined) continue;
    const destino = juntarAlGrupo(elegida, [...delGrupo], plano);
    const dx = destino.x - actual.x;
    const dy = destino.y - actual.y;
    plano = plano.map((m) => (bloque.includes(m.id) ? { ...m, x: m.x + dx, y: m.y + dy } : m));
    for (const id of bloque) {
      const movida = plano.find((m) => m.id === id);
      if (movida !== undefined) salida.push({ mesaId: id, x: movida.x, y: movida.y });
    }
    delGrupo = [...delGrupo, ...bloque];
  }
  return salida;
}
