/**
 * DP-11.4 · EL VIDRIO, SÓLO SI EL APARATO LO AGUANTA.
 *
 * El desenfoque de lo que flota es lo más caro del lenguaje de capas, y Don Poncho corre en una
 * tableta de gama baja. Así que la primera vez que un aparato abre la aplicación —con vidrio de
 * por medio, a la vista y en reposo— se miden 60 cuadros; si la mediana pasa de 22 ms, el
 * aparato queda en vidrio SÓLIDO (`data-vidrio="solido"`, guardado en el aparato): el mismo
 * diseño con superficie opaca. Se decide una vez y el guion de arranque lo aplica antes del
 * primer pintado en las siguientes.
 *
 * La mediana y no el promedio: un tirón suelto —una imagen que se decodifica— no condena a un
 * aparato que en reposo va a 60.
 */

export const CUADROS_A_MEDIR = 60;
export const CUADRO_LENTO_MS = 22;

export type DecisionDelVidrio = 'vidrio' | 'solido';

export function decidirVidrio(duraciones: readonly number[]): DecisionDelVidrio | null {
  if (duraciones.length < CUADROS_A_MEDIR / 2) return null;
  const ordenadas = [...duraciones].sort((a, b) => a - b);
  const mediana = ordenadas[Math.floor(ordenadas.length / 2)] ?? 0;
  return mediana > CUADRO_LENTO_MS ? 'solido' : 'vidrio';
}

export interface CircunstanciaDelVidrio {
  /** Lo que ya se decidió en este aparato, si algo. */
  readonly guardado: string | null;
  /** La elevación del estilo (`data-elevacion`): sólo `capas` y `aero` llevan vidrio. */
  readonly elevacion: string | null | undefined;
  /** `navigator.webdriver`: bajo las pruebas no se mide (el retrato no puede depender de la CPU). */
  readonly automatizado: boolean;
  /** Una pestaña escondida va a pocos cuadros por diseño del navegador: mediría mal. */
  readonly visible: boolean;
}

export function debeMedirElVidrio(c: CircunstanciaDelVidrio): boolean {
  if (c.guardado === 'vidrio' || c.guardado === 'solido') return false;
  if (c.elevacion !== 'capas' && c.elevacion !== 'aero') return false;
  return c.visible && !c.automatizado;
}
