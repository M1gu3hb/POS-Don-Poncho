/**
 * DP-18 · A7 · EL PEDIDO PARA LLEVAR QUE QUEDÓ A MEDIAS NO SE MEZCLA EN SILENCIO.
 *
 * El borrador del pedido para llevar sobrevive a una recarga. Si la recarga cayó en pleno cobro,
 * ese borrador seguía ahí aunque el pedido ya se hubiera cobrado, y la cajera empezaba el pedido
 * SIGUIENTE con los renglones del anterior: riesgo de cobrar dos veces lo mismo.
 *
 * Regla: al abrir la toma, un borrador que quedó de antes NO se mezcla; la pantalla lo dice y deja
 * retomarlo o descartarlo. La excepción es el borrador que dejó ESTA misma pantalla (un cobro
 * cancelado, o la X «Cerrar sin cobrar (el pedido se guarda)»): es el que la cajera tenía en las
 * manos y vuelve con todo. Sólo lo que quedó de antes de una recarga se pregunta.
 */
export function pedidoSinTerminar(situacion: {
  /** Había un borrador guardado en el aparato al abrir. */
  readonly recuperado: boolean;
  /** El borrador lo dejó esta misma pantalla (cobro cancelado o cerrar con la X), sin recargar. */
  readonly deEstaSesion: boolean;
  /** La cajera ya eligió retomar o descartar. */
  readonly decidido: boolean;
}): boolean {
  return situacion.recuperado && !situacion.deEstaSesion && !situacion.decidido;
}
