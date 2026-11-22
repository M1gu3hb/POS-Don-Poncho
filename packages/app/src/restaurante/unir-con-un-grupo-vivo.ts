/**
 * «UNIR MESAS» CON UNA MESA QUE YA ESTÁ EN UN GRUPO (DP-25 · P6, DP-D226).
 *
 * Llega gente y se pega una mesa, luego otra y otra. Hasta DP-24, si alguna de las mesas que el
 * mesero elegía ya estaba en un grupo, `restaurante.unir_mesas` contestaba «ya pertenece a un
 * grupo» y había que saber que existía «Agregar mesas». Ahora no hay forma de equivocarse: lo
 * decide el SERVIDOR (así vale en todas las pantallas) y, si alguna mesa ya está en un grupo, la
 * unión ES agregar al grupo, con la principal de siempre. Esto es la decisión pura, sin base de
 * datos:
 *
 *   · ninguna mesa en un grupo → unión normal;
 *   · el grupo que gana es el de la PRINCIPAL elegida (esté en él como principal o absorbida); si
 *     la principal elegida está libre, el de la primera mesa que se nombró que ya esté en uno;
 *   · una mesa libre entra al grupo; una mesa de OTRO grupo entra con todo su grupo, por su
 *     principal (lo que ya hace «Agregar mesas»: ese grupo se cierra sin separar a nadie);
 *   · si todas las elegidas ya son del mismo grupo no hay nada que agregar y se dice.
 */

/** Lo que se sabe de una mesa elegida (y de las principales de sus grupos). */
export interface MesaDeLaUnion {
  readonly id: string;
  /** Absorbida en una unión viva: la mesa principal que la tiene; `null` si no está absorbida. */
  readonly unidaAMesaId: string | null;
  /** La unión viva que esta mesa encabeza; `null` si no encabeza ninguna. */
  readonly encabezaUnionId: string | null;
}

export type DestinoDeLaUnion =
  | { readonly tipo: 'unir' }
  | { readonly tipo: 'nada'; readonly mensaje: string }
  | {
      readonly tipo: 'agregar';
      readonly unionId: string;
      /** La principal de siempre: la del grupo que gana. */
      readonly principalId: string;
      /** Lo que entra, en el orden en que se nombró: libres y principales de otros grupos. */
      readonly mesaIds: readonly string[];
      /** Las elegidas que ya eran de ese grupo, con su principal: no se vuelven a mover. */
      readonly delGrupo: readonly string[];
    };

/** La principal del grupo al que pertenece la mesa; `null` si está libre. */
function principalDelGrupo(mesa: MesaDeLaUnion): string | null {
  if (mesa.unidaAMesaId !== null) return mesa.unidaAMesaId;
  return mesa.encabezaUnionId === null ? null : mesa.id;
}

export function aDondeVaLaUnion(
  principalElegidaId: string,
  mesaIds: readonly string[],
  mesas: readonly MesaDeLaUnion[],
): DestinoDeLaUnion {
  const porId = new Map(mesas.map((m) => [m.id, m]));
  const pedidas = [principalElegidaId, ...mesaIds];
  const gruposDe = pedidas.map((id) => {
    const mesa = porId.get(id);
    return mesa === undefined ? null : principalDelGrupo(mesa);
  });
  const ganadora = gruposDe.find((g): g is string => g !== null);
  if (ganadora === undefined) return { tipo: 'unir' };
  const union = porId.get(ganadora)?.encabezaUnionId ?? null;
  if (union === null) return { tipo: 'unir' };

  const entran: string[] = [];
  const delGrupo: string[] = [];
  pedidas.forEach((id, i) => {
    const grupo = gruposDe[i] ?? null;
    if (grupo === ganadora) delGrupo.push(id);
    else if (grupo === null && !entran.includes(id)) entran.push(id);
    else if (grupo !== null && !entran.includes(grupo)) entran.push(grupo);
  });
  if (entran.length === 0) {
    return { tipo: 'nada', mensaje: 'Esas mesas ya están unidas en el mismo grupo.' };
  }
  return {
    tipo: 'agregar',
    unionId: union,
    principalId: ganadora,
    mesaIds: entran,
    delGrupo: delGrupo.includes(ganadora) ? delGrupo : [...delGrupo, ganadora],
  };
}
