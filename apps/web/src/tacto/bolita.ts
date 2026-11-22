/**
 * LA BOLITA DE «AGREGADO AL PEDIDO» (DP-25 · Parte 5) · la decisión, pura, y el lanzador.
 *
 * Cada toque que AGREGA un platillo lanza una bolita que vuela de la ficha al pedido (el botón
 * flotante del teléfono, el panel de la tableta, el carrito del comensal) y el número rebota. Es
 * decoración: el platillo se agrega al instante y la bolita sólo sale DESPUÉS, cuando el toque
 * seguro (DP-23) ya aceptó el toque y la acción confirmó que agregó. Nunca retrasa ni condiciona el
 * agregado.
 *
 * Quien agrega avisa devolviendo `SE_AGREGO` (o una promesa que lo devuelva): un toque que sólo abre
 * las opciones de un platillo, o un agotado, no lanza nada.
 *
 * Ligera por diseño: sólo `transform` y `opacity`, un tope de bolitas a la vez, una salida escalonada
 * para que tres toques sean tres bolitas una tras otra, y sin movimiento sólo rebota el número. Todo
 * lo del DOM se pide por el `Entorno`, para probar esta lógica sin navegador (`bolita-dom.ts`).
 */

/** Lo que devuelve la acción de agregar cuando el platillo SÍ quedó en el pedido. */
export const SE_AGREGO = 'se-agrego' as const;

/** Bolitas en el aire a la vez; pasado esto, sólo rebota el número. */
export const TOPE_DE_BOLITAS = 6;
/** Entre la salida de una bolita y la siguiente: tres toques seguidos se ven como tres. */
export const ESCALON_MS = 70;
/** El vuelo: corto, con salida fuerte (menos de 400 ms). */
export const VUELO_MS = 320;
/** El rebote del número. */
export const REBOTE_MS = 200;

export interface Punto {
  readonly x: number;
  readonly y: number;
}

export type PlanDeBolita =
  | { readonly tipo: 'vuelo'; readonly retardoMs: number }
  | { readonly tipo: 'rebote' }
  | { readonly tipo: 'nada' };

export interface EntradaDelPlan {
  /** Dónde está el pedido (`null`: no se ve en esta pantalla). */
  readonly destino: Punto | null;
  readonly activas: number;
  /** Cuándo salió (o saldrá) la última bolita, en ms. */
  readonly ultimaSalida: number | null;
  readonly ahora: number;
  readonly reducido: boolean;
  readonly hayWaapi: boolean;
  readonly hayCuadros: boolean;
}

export function planearBolita(e: EntradaDelPlan): PlanDeBolita {
  if (e.destino === null) return { tipo: 'nada' };
  if (e.reducido) return { tipo: 'rebote' };
  if (e.activas >= TOPE_DE_BOLITAS) return { tipo: 'rebote' };
  if (!e.hayWaapi && !e.hayCuadros) return { tipo: 'rebote' };
  const retardoMs =
    e.ultimaSalida === null ? 0 : Math.max(0, e.ultimaSalida + ESCALON_MS - e.ahora);
  return { tipo: 'vuelo', retardoMs };
}

/** Lo que el lanzador le pide al navegador (o, en las pruebas, a un doble). */
export interface Entorno {
  readonly ahora: () => number;
  readonly reducido: () => boolean;
  readonly hayWaapi: () => boolean;
  readonly hayCuadros: () => boolean;
  /** El centro del pedido visible, o `null`. */
  readonly destino: () => Punto | null;
  /** Vuela una bolita; llama `alTerminar` al aterrizar (o al cancelarse). */
  readonly volar: (desde: Punto, hasta: Punto, retardoMs: number, alTerminar: () => void) => void;
  readonly rebotar: () => void;
}

/** Devuelve la función que se llama con el punto de la ficha tocada. */
export function crearLanzador(entorno: Entorno): (origen: Punto) => PlanDeBolita {
  let activas = 0;
  let ultimaSalida: number | null = null;
  return (origen) => {
    const ahora = entorno.ahora();
    const destino = entorno.destino();
    const plan = planearBolita({
      destino,
      activas,
      ultimaSalida,
      ahora,
      reducido: entorno.reducido(),
      hayWaapi: entorno.hayWaapi(),
      hayCuadros: entorno.hayCuadros(),
    });
    if (plan.tipo === 'rebote') entorno.rebotar();
    if (plan.tipo !== 'vuelo' || destino === null) return plan;
    activas += 1;
    ultimaSalida = ahora + plan.retardoMs;
    entorno.volar(origen, destino, plan.retardoMs, () => {
      activas = Math.max(0, activas - 1);
      entorno.rebotar();
    });
    return plan;
  };
}

export interface OpcionesDeLaConfirmacion {
  /**
   * Otra cadena ya muestra el rechazo de la promesa (el candado del toque seguro lo vuelve a
   * lanzar): aquí no se repite como segundo error sin atender.
   */
  readonly yaSeAtiendeElRechazo?: boolean;
}

/**
 * Llama `avisar` cuando la acción de agregar confirma que agregó (`SE_AGREGO`), ya sea al volver o
 * cuando su promesa se resuelve. Cualquier otro resultado no avisa. No espera ni retrasa nada: se
 * cuelga de lo que la acción ya devolvió.
 */
export function alConfirmarElAgregado(
  resultado: unknown,
  avisar: () => void,
  opciones: OpcionesDeLaConfirmacion = {},
): void {
  if (resultado instanceof Promise) {
    const alResolver = (valor: unknown): void => {
      if (valor === SE_AGREGO) avisar();
    };
    if (opciones.yaSeAtiendeElRechazo === true) resultado.then(alResolver, () => undefined);
    else void resultado.then(alResolver);
    return;
  }
  if (resultado === SE_AGREGO) avisar();
}
