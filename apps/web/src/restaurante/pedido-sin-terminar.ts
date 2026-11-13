/**
 * DP-18 · A7 · EL PEDIDO PARA LLEVAR QUE QUEDÓ A MEDIAS NO SE MEZCLA EN SILENCIO.
 *
 * El borrador del pedido para llevar sobrevive a una recarga. Si la recarga cayó en pleno cobro,
 * ese borrador seguía ahí aunque el pedido ya se hubiera cobrado, y la cajera empezaba el pedido
 * SIGUIENTE con los renglones del anterior: riesgo de cobrar dos veces lo mismo.
 *
 * Regla: al abrir la toma, un borrador que quedó de antes NO se mezcla; la pantalla lo dice y deja
 * retomarlo o descartarlo. La única excepción es volver de un cobro cancelado en esta misma
 * sesión: ahí el pedido es el que la cajera tenía en las manos y vuelve con todo.
 */
export function pedidoSinTerminar(situacion: {
  /** Había un borrador guardado en el aparato al abrir. */
  readonly recuperado: boolean;
  /** La toma se reabre porque se canceló el cobro que ella misma abrió. */
  readonly volviendoDelCobro: boolean;
  /** La cajera ya eligió retomar o descartar. */
  readonly decidido: boolean;
}): boolean {
  return situacion.recuperado && !situacion.volviendoDelCobro && !situacion.decidido;
}
