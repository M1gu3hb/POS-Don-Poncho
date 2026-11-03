import type { EstadoDelCarrito } from './carrito-compartido/carrito-de-la-mesa';

/**
 * «ATENCIÓN» DEL COMENSAL Y «LLAMAR A MI MESERO» DEL CARRITO, DE ACUERDO (DP-13.4).
 *
 * Son dos puertas al mismo aviso: la solicitud `ordenar` (una por mesa mientras esté pendiente,
 * `solicitudes_qr_una_pendiente`). Con un pedido guardado esperando al mesero, «Quiero ordenar» del
 * botón flotante contestaba otra cosa —«Ya avisamos al mesero», como un error— y no explicaba que
 * el pedido sigue guardado. Ahora esa opción ES «Volver a llamar a mi mesero»: se llama igual,
 * hace lo mismo que el carrito (le pone al día la nota al MISMO aviso, no crea otro) y contesta con
 * sus mismas palabras.
 */

/** El texto de «Volver a llamar a mi mesero» del carrito (`botonDelCarrito`). */
export const VOLVER_A_LLAMAR_AL_MESERO = 'Volver a llamar a mi mesero';

/** Hay platillos armados Y el mesero ya fue avisado: el pedido está guardado esperándolo. */
export function pedidoGuardadoEsperandoAlMesero(estado: EstadoDelCarrito | null): boolean {
  return estado !== null && estado.meseroAvisado === true && estado.lineas.length > 0;
}

/** ¿Tocar esta opción de «Atención» es volver a llamar al mesero por el pedido guardado? */
export function ordenarEsVolverALlamar(tipo: string, estado: EstadoDelCarrito | null): boolean {
  return tipo === 'ordenar' && pedidoGuardadoEsperandoAlMesero(estado);
}

/** Lo que dice la opción: la de siempre, salvo «ordenar» con el pedido guardado. */
export function etiquetaDeLaOpcion(
  tipo: string,
  etiquetaDeSiempre: string,
  pedidoGuardado: boolean,
): string {
  return tipo === 'ordenar' && pedidoGuardado ? VOLVER_A_LLAMAR_AL_MESERO : etiquetaDeSiempre;
}

/**
 * ¿Hay barra del carrito abajo? Es la misma condición con la que el portal pinta
 * `CarritoDeLaMesa`: pedidos desde el teléfono y algo armado. DP-13.3: con la cuenta ya pedida la
 * barra TAMBIÉN está (con su mensaje «Tu cuenta ya se pidió»), así que ya no depende de ella. Con la
 * barra puesta, el botón flotante sube por encima de ella en lugar de tapar su mitad izquierda.
 */
export function hayBarraDelCarrito(datos: {
  readonly pedidosActivos: boolean;
  readonly estado: EstadoDelCarrito | null;
}): boolean {
  return datos.pedidosActivos && datos.estado !== null && datos.estado.lineas.length > 0;
}
