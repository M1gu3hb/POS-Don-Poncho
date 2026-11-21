/**
 * LAS REGLAS PURAS DE «AGREGAR MESAS» A UN GRUPO (DP-24 · P5).
 *
 * Don Poncho junta mesas poco a poco: llegan seis, se unen dos mesas; llegan cuatro más, se
 * agregan otras dos; y al final alguien jala el grupo de al lado. Todas van a la principal de la
 * PRIMERA unión. Aquí se decide, sin tocar la base, qué mesa pedida es qué:
 *
 *   · una mesa suelta (libre o con cuenta): entra como en una unión normal;
 *   · la PRINCIPAL de otro grupo vivo: entra con TODO su grupo (sus mesas y su cuenta);
 *   · una mesa que ya está en ESTE grupo, o es su principal: se rechaza;
 *   · una mesa absorbida en OTRO grupo: se rechaza y se dice cuál agregar (su principal);
 *   · una mesa de otra sucursal, o en limpieza, o repetida: se rechaza, como al unir.
 */

/** Lo que se sabe de una mesa que se quiere agregar. */
export interface MesaPorAgregar {
  readonly id: string;
  readonly numero: number;
  readonly estado: string;
  readonly sucursalId: string;
  /** Absorbida en una unión viva: la mesa principal que la tiene; `null` si no está absorbida. */
  readonly unidaA: { readonly id: string; readonly numero: number } | null;
  /** La unión viva que esta mesa encabeza; `null` si no encabeza ninguna. */
  readonly encabezaUnionId: string | null;
}

/** El grupo al que se agrega. */
export interface GrupoAlQueSeAgrega {
  readonly principalId: string;
  readonly sucursalId: string;
}

export type CodigoDeRechazo = 'MESA_YA_ABIERTA' | 'MESA_NO_ENCONTRADA' | 'UNION_DE_MESAS_INVALIDA';

export interface Rechazo {
  readonly codigo: CodigoDeRechazo;
  readonly mensaje: string;
}

export interface LoQueSeAgrega {
  /** Mesas sueltas, en el orden en que se pidieron. */
  readonly sueltas: readonly string[];
  /** Principales de otro grupo vivo: `{ mesaId, unionId }`, en el orden en que se pidieron. */
  readonly principalesDeOtros: readonly { readonly mesaId: string; readonly unionId: string }[];
}

export type Clasificacion =
  | { readonly rechazo: Rechazo; readonly agrega: null }
  | { readonly rechazo: null; readonly agrega: LoQueSeAgrega };

const rechazar = (codigo: CodigoDeRechazo, mensaje: string): Clasificacion => ({
  rechazo: { codigo, mensaje },
  agrega: null,
});

/** Qué hacer con cada mesa pedida, o el primer rechazo. */
export function clasificarLasQueSeAgregan(
  grupo: GrupoAlQueSeAgrega,
  pedidas: readonly string[],
  mesas: readonly MesaPorAgregar[],
): Clasificacion {
  if (new Set(pedidas).size !== pedidas.length) {
    return rechazar('MESA_YA_ABIERTA', 'Esa mesa viene repetida en el grupo.');
  }
  const sueltas: string[] = [];
  const principalesDeOtros: { mesaId: string; unionId: string }[] = [];
  for (const id of pedidas) {
    const mesa = mesas.find((m) => m.id === id);
    if (mesa === undefined) {
      return rechazar('MESA_NO_ENCONTRADA', 'Esa mesa no existe o está dada de baja.');
    }
    const rechazo = rechazoDeUna(grupo, mesa);
    if (rechazo !== null) return { rechazo, agrega: null };
    if (mesa.encabezaUnionId === null) sueltas.push(mesa.id);
    else principalesDeOtros.push({ mesaId: mesa.id, unionId: mesa.encabezaUnionId });
  }
  return { rechazo: null, agrega: { sueltas, principalesDeOtros } };
}

function rechazoDeUna(grupo: GrupoAlQueSeAgrega, mesa: MesaPorAgregar): Rechazo | null {
  const n = String(mesa.numero);
  if (mesa.id === grupo.principalId) {
    return {
      codigo: 'MESA_YA_ABIERTA',
      mensaje: `La mesa ${n} es la principal de este grupo: ya tiene la cuenta.`,
    };
  }
  if (mesa.unidaA !== null) {
    return mesa.unidaA.id === grupo.principalId
      ? { codigo: 'MESA_YA_ABIERTA', mensaje: `La mesa ${n} ya está en este grupo.` }
      : {
          codigo: 'MESA_YA_ABIERTA',
          mensaje: `La mesa ${n} está unida a la ${String(mesa.unidaA.numero)}: agrega la ${String(mesa.unidaA.numero)}, que encabeza ese grupo.`,
        };
  }
  if (mesa.sucursalId !== grupo.sucursalId) {
    return {
      codigo: 'MESA_NO_ENCONTRADA',
      mensaje: `La mesa ${n} es de otra sucursal: no se puede juntar con ésta.`,
    };
  }
  if (mesa.estado === 'limpieza') {
    return {
      codigo: 'UNION_DE_MESAS_INVALIDA',
      mensaje: `La mesa ${n} está en limpieza: márcala libre primero.`,
    };
  }
  return null;
}
