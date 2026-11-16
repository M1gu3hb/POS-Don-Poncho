import { rotuloHablado } from '~/restaurante/rotulo-de-la-comanda';
import { fraseNuevoPedidoCocina } from '~/voz/frase-de-la-comanda';
import type { PlatilloParaLaVoz } from '~/voz/platillos-para-la-voz';

/**
 * DP-21 · Bloque 8 · QUÉ COMANDAS ANUNCIA ESTE APARATO, Y CON QUÉ FRASE.
 *
 * El vigilante de Cocina (`CocinaNuevoPedidoWatcher`) y el teléfono deciden aquí, con funciones
 * puras, lo que antes estaba dentro de un efecto: cada comanda se anuncia UNA vez por aparato
 * (aunque la lectura la traiga repetida) y sólo si este aparato es el que anuncia.
 */
export interface ComandaParaAnunciar {
  readonly id: string;
  readonly mesa_numero?: number | null;
  readonly canal?: string | null;
  readonly numero_pedido?: number | null;
  readonly nombre_pedido?: string | null;
  readonly items?: readonly PlatilloParaLaVoz[] | null;
  readonly notas?: string | null;
  readonly notas_alergias?: string | null;
  readonly celebracion_especial?: boolean | null;
  readonly tipo_celebracion?: string | null;
}

/** Las comandas que este aparato aún no anunció, cada una UNA vez y en el orden en que llegaron. */
export function comandasPorAnunciar<T extends { readonly id: string }>(
  candidatas: readonly T[],
  yaAnunciadas: ReadonlySet<string>,
): readonly T[] {
  const vistas = new Set<string>();
  return candidatas.filter((comanda) => {
    if (yaAnunciadas.has(comanda.id) || vistas.has(comanda.id)) return false;
    vistas.add(comanda.id);
    return true;
  });
}

/** La frase de UNA comanda: rótulo del canal, platillos juntos, alergia y celebración. */
export function fraseDeLaComanda(comanda: ComandaParaAnunciar): string {
  return fraseNuevoPedidoCocina(comanda.mesa_numero, comanda.items, comanda.notas, {
    rotulo: rotuloHablado(comanda),
    notas_alergias: comanda.notas_alergias,
    celebracion: comanda.celebracion_especial,
    tipo_celebracion: comanda.tipo_celebracion,
  });
}

/** Una frase por comanda; ninguna si este aparato no anuncia o su voz de cocina está apagada. */
export function frasesAAnunciar(
  comandas: readonly ComandaParaAnunciar[],
  aparato: { readonly anuncia: boolean; readonly vozActiva: boolean },
): readonly string[] {
  if (!aparato.anuncia || !aparato.vozActiva) return [];
  return comandas.map(fraseDeLaComanda);
}
