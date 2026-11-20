import { MS_PARA_MANTENER, TOLERANCIA_PX } from '~/restaurante/portal-mesero/pulsacion-larga';

/**
 * EL TOQUE SEGURO (DP-23) · la decisión, pura.
 *
 * Un botón que AGREGA al pedido sólo debe agregar cuando alguien quiso tocarlo. Deslizar la lista,
 * dejar el dedo puesto o un panel que rebota no son tocar. Lo mide un gancho fino
 * (`use-toque-seguro.ts`) y lo decide esta función, sin DOM, para poder probarla entera.
 *
 * Cuenta como toque si, entre bajar y soltar:
 *  · el dedo se movió a lo más `TOLERANCIA_PX` (la de las pulsaciones del mesero);
 *  · ningún contenedor se desplazó;
 *  · duró menos de `MS_PARA_MANTENER` (mantener presionado no agrega);
 *  · el navegador no canceló el gesto (empezó a desplazar).
 * Además, un mismo botón agrega una vez por gesto, no vuelve a agregar antes de `REPOSO_MS` y no
 * entra mientras su acción anterior sigue resolviéndose.
 *
 * El ratón vale igual: un clic normal dura decenas de milisegundos y no se mueve. Un ratón que se
 * mantiene medio segundo o arrastra más de 10 px tampoco agrega (en Windows el dedo a veces llega
 * como ratón y no se distingue). El teclado (Enter o Espacio) no tiene gesto: sólo cuentan el
 * reposo y la acción en curso.
 */

export { MS_PARA_MANTENER, TOLERANCIA_PX };

/** Un segundo agregado del mismo botón en menos de esto se ignora (rebote de panel, doble evento). */
export const REPOSO_MS = 350;

/** Lo que se midió entre bajar y soltar. `null` = no hubo gesto de puntero (teclado o programático). */
export interface GestoMedido {
  /** Lo más que el puntero se alejó de donde bajó, en px. */
  readonly alejamientoPx: number;
  /** Cuánto se desplazaron, sumados, los contenedores con desplazamiento, en px. */
  readonly desplazamientoPx: number;
  readonly duracionMs: number;
  /** El navegador lo canceló (`pointercancel`): tomó el gesto para desplazar. */
  readonly cancelado: boolean;
}

export interface EstadoDelBoton {
  readonly ahora: number;
  /** Cuándo agregó por última vez este botón (ms), o `null` si nunca. */
  readonly ultimoAgregado: number | null;
  /** La acción anterior de este botón todavía no termina. */
  readonly enCurso: boolean;
}

export type MotivoDelToque =
  'toque' | 'se-movio' | 'se-desplazo' | 'cancelado' | 'mantenido' | 'repetido' | 'en-curso';

export interface DecisionDelToque {
  readonly agrega: boolean;
  readonly motivo: MotivoDelToque;
}

export interface OpcionesDelToque {
  readonly reposoMs?: number;
}

export function decidirToque(
  gesto: GestoMedido | null,
  estado: EstadoDelBoton,
  opciones: OpcionesDelToque = {},
): DecisionDelToque {
  const no = (motivo: MotivoDelToque): DecisionDelToque => ({ agrega: false, motivo });
  if (estado.enCurso) return no('en-curso');
  if (gesto !== null) {
    if (gesto.cancelado) return no('cancelado');
    if (gesto.desplazamientoPx > 0) return no('se-desplazo');
    if (gesto.alejamientoPx > TOLERANCIA_PX) return no('se-movio');
    if (gesto.duracionMs >= MS_PARA_MANTENER) return no('mantenido');
  }
  const reposo = opciones.reposoMs ?? REPOSO_MS;
  if (estado.ultimoAgregado !== null && estado.ahora - estado.ultimoAgregado < reposo) {
    return no('repetido');
  }
  return { agrega: true, motivo: 'toque' };
}
