/**
 * Lo que dice el cierre cuando quedan pedidos cobrados sin entregar. Puro.
 *
 * La regla es de todos los giros: la caja no cierra con ellos. Lo que cambia es la salida que se
 * ofrece. «Marcar como no recogido» es una acción de la fila de la barra (cafetería, tienda…);
 * el restaurante no la tiene, así que su cierre no la pide: sólo entregar o devolver.
 */
export function avisoDePedidosSinEntregar(cuantos: number, paquete: string): string {
  const quedan = `Hay ${String(cuantos)} pedido(s) cobrado(s) sin entregar`;
  if (paquete === 'restaurante') return `${quedan}: entrégalos o devuélvelos antes de cerrar.`;
  return `${quedan}: entrégalos, márcalos como no recogidos o devuélvelos antes de cerrar.`;
}
