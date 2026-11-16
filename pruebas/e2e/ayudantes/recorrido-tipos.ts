import type { Locator, Page } from '@playwright/test';

/**
 * LOS TIPOS DEL RECORRIDO COMPATIBLE (DP-20): lo que `recorrer` le dice a quien lo corre en cada
 * parada, y lo que le pide cuando un tramo no se pudo andar.
 */

/** Una parada del recorrido: dónde se está y qué cambia de una corrida a otra. */
export interface Parada {
  readonly nombre: string;
  /**
   * Lo que cambia entre dos corridas (relojes, folios, «hace 3 min», números de ticket): quien
   * compara capturas lo tapa antes de comparar.
   */
  readonly tapar: readonly Locator[];
  /** Algo que la parada dice de sí misma y la prueba quiere exigir (el nivel del motor). */
  readonly nota?: string;
}

/** Una parada alcanzada, con la pestaña en la que se alcanzó (puede no ser la del principio). */
export interface Llegada extends Parada {
  readonly pagina: Page;
}

/** Se llama en cada parada, con la pantalla ya quieta. */
export type AlLlegar = (llegada: Llegada) => Promise<void>;

/** Lo que cada tramo del recorrido llama al llegar: `recorrer` le pone la pestaña. */
export type EnLaParada = (parada: Parada) => Promise<void>;

/**
 * Se llama cuando un tramo no se pudo andar. Sin ella, el fallo sube y el recorrido se detiene;
 * con ella, el tramo queda pendiente y el recorrido sigue con el siguiente.
 */
export type AlFallar = (tramo: string, error: unknown) => Promise<void>;

/** Todas las paradas, en orden: el número de cada captura sale de aquí, no de cuántas se alcanzaron. */
export const PARADAS = [
  'login',
  'login-persona',
  'inicio',
  'mesero',
  'mesero-orden',
  'cocina',
  'caja-cuenta',
  'caja-dividir',
  'caja-cobro',
  'caja-ticket',
  'para-llevar',
  'configuracion',
  'configuracion-impresion',
  'laboratorio',
  // DP-21 · Bloque 15: los estados abiertos y marcados.
  'estados-globo-de-la-mesa',
  'estados-reposo',
  'estados-seleccion',
  'estados-foco-sistema',
  'estados-foco-heredado',
  'estados-lista-sistema',
  'estados-menu-sistema',
  'estados-popover-sistema',
  'estados-panel-sistema',
  'estados-lista-heredado',
  'estados-menu-heredado',
  'estados-popover-heredado',
  'estados-panel-heredado',
] as const;

export type NombreDeParada = (typeof PARADAS)[number];
