/**
 * DP-15 · ¿Está agotado el platillo a esta hora?
 *
 * `productos.agotado_hasta` guarda el FIN del día del negocio en que alguien lo marcó agotado (lo
 * calcula `catalogo.marcar_agotado`). Agotado mientras esa hora no llega; nulo = disponible. La hora
 * de corte ya no cuenta como agotado: a partir de ese instante empieza el día siguiente.
 *
 * Pura y sin dependencias: la usan el servidor (los tres caminos que agregan platillos a una cuenta y
 * lo que se lee para las pantallas) y la puede usar una pantalla.
 */
export function estaAgotado(agotadoHasta: Date | string | null | undefined, ahora: Date): boolean {
  if (agotadoHasta === null || agotadoHasta === undefined) return false;
  const hasta = agotadoHasta instanceof Date ? agotadoHasta : new Date(agotadoHasta);
  if (Number.isNaN(hasta.getTime())) return false;
  return hasta.getTime() > ahora.getTime();
}
