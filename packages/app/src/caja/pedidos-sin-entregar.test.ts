import { describe, expect, it } from 'vitest';

import { avisoDePedidosSinEntregar } from './pedidos-sin-entregar.ts';

/**
 * A6 · EL CIERRE DEL RESTAURANTE NO PIDE «NO RECOGIDO».
 *
 * «Marcar como no recogido» es una acción de la fila de la barra (cafetería). El restaurante no la
 * tiene: su cierre dice sólo lo que sí se puede hacer. La regla —no se cierra con pedidos cobrados
 * sin entregar— es la misma para todos.
 */
describe('el aviso de pedidos cobrados sin entregar', () => {
  it('en el restaurante: entregarlos o devolverlos, sin hablar de «no recogidos»', () => {
    const texto = avisoDePedidosSinEntregar(2, 'restaurante');
    expect(texto).toBe(
      'Hay 2 pedido(s) cobrado(s) sin entregar: entrégalos o devuélvelos antes de cerrar.',
    );
    expect(texto.toLowerCase()).not.toContain('recogido');
  });

  it('en los giros con fila de barra, la tercera salida sigue ahí', () => {
    for (const paquete of ['cafeteria', 'tienda', 'ferreteria', 'estetica']) {
      expect(avisoDePedidosSinEntregar(1, paquete)).toBe(
        'Hay 1 pedido(s) cobrado(s) sin entregar: entrégalos, márcalos como no recogidos o devuélvelos antes de cerrar.',
      );
    }
  });
});
