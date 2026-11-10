/**
 * DP-16 · CÓMO SE LLAMA UNA COMANDA, en la pantalla, en el teléfono de cocina y en la voz.
 *
 * Antes la cocina decía «Para llevar» (o «Mostrador») a todo lo que no tenía mesa. Ahora lo decide
 * el CANAL de la orden: un pedido para llevar se anuncia con su número del día y el nombre del
 * cliente, grande, para que se grite bien al entregar. Una sola pieza: la tarjeta, el aviso y la voz
 * no pueden decir cosas distintas.
 */

export interface DatosDelRotulo {
  readonly mesa_numero?: number | null;
  readonly canal?: string | null;
  readonly numero_pedido?: number | null;
  readonly nombre_pedido?: string | null;
}

export function esParaLlevar(datos: DatosDelRotulo): boolean {
  return datos.canal === 'llevar';
}

function nombreLimpio(datos: DatosDelRotulo): string | null {
  const nombre = (datos.nombre_pedido ?? '').trim();
  return nombre === '' ? null : nombre;
}

/** «PARA LLEVAR · 3 · Don Beto», «Mesa 4» o «Mostrador». */
export function rotuloDeLaComanda(datos: DatosDelRotulo): string {
  if (esParaLlevar(datos)) {
    const partes = ['PARA LLEVAR'];
    if (typeof datos.numero_pedido === 'number') partes.push(String(datos.numero_pedido));
    const nombre = nombreLimpio(datos);
    if (nombre !== null) partes.push(nombre);
    return partes.join(' · ');
  }
  if (typeof datos.mesa_numero === 'number') return `Mesa ${datos.mesa_numero}`;
  return 'Mostrador';
}

/** Lo que dice la voz: «para llevar 3», «mesa 4» o «mostrador» (el nombre se lee en pantalla). */
export function rotuloHablado(datos: DatosDelRotulo): string {
  if (esParaLlevar(datos)) {
    return typeof datos.numero_pedido === 'number'
      ? `para llevar ${datos.numero_pedido}`
      : 'para llevar';
  }
  if (typeof datos.mesa_numero === 'number') return `mesa ${datos.mesa_numero}`;
  return 'mostrador';
}

/** Lo que espera una comanda lista: el mesero en una mesa; la caja en un pedido para llevar. */
export function quienRecoge(datos: DatosDelRotulo): string {
  return esParaLlevar(datos)
    ? 'Esperando que la caja lo entregue'
    : 'Esperando que el mesero recoja';
}
