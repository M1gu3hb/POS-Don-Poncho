import { obtenerDb } from '@morphiqpos/data';
import { describe, expect, it } from 'vitest';

import { exigirOk } from '../pruebas/negocio-real.ts';
import { notaDelPedidoListo } from '../portal/quien-envia.ts';
import { LADO, mesa, salonEnFila, unir } from './pruebas/union-en-el-plano.ts';
import type { Salon } from './pruebas/salon-real.ts';

/**
 * DP-14.6 (medio 4) · UNIR MESAS NO PIERDE AVISOS.
 *
 *   · Un «Pedido listo» ya ATENDIDO no se queda escondido en la mesa absorbida.
 *   · El aviso del carrito que se mueve no se da por resuelto porque la principal tenía otra
 *     solicitud `ordenar` que no es el aviso del carrito (un «Quiero ordenar» del botón).
 */

async function solicitud(
  salon: Salon,
  mesaId: string,
  estado: 'pendiente' | 'atendida',
  notas: string | null,
): Promise<string> {
  const { id } = await obtenerDb()
    .insertInto('solicitudes_qr')
    .values({
      organizacion_id: salon.negocio.organizacionId,
      mesa_id: mesaId,
      tipo: 'ordenar',
      estado,
      origen: 'portal_qr',
      ruteo_modo: 'general',
      notas,
      ...(estado === 'atendida' ? { atendida_en: new Date() } : {}),
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  return id;
}

const fila = (id: string) =>
  obtenerDb()
    .selectFrom('solicitudes_qr')
    .select(['mesa_id', 'estado', 'notas'])
    .where('id', '=', id)
    .executeTakeFirstOrThrow();

const UNIR = [{ i: 1, x: 100 + LADO, y: 100 }];

describe('al unir, los avisos del carrito no se pierden', () => {
  it('un «Pedido listo» ya atendido pasa a la principal', async () => {
    const salon = await salonEnFila('Salón del aviso atendido', 2);
    const [uno, dos] = [mesa(salon, 0), mesa(salon, 1)];
    const atendido = await solicitud(salon, dos, 'atendida', notaDelPedidoListo(2));
    exigirOk(await unir(salon, 0, [1], UNIR), 'unir');
    expect(await fila(atendido)).toMatchObject({ mesa_id: uno, estado: 'atendida' });
  });

  it('el aviso del carrito movido sobrevive a un «Quiero ordenar» de la principal', async () => {
    const salon = await salonEnFila('Salón del aviso que sobrevive', 2);
    const [uno, dos] = [mesa(salon, 0), mesa(salon, 1)];
    const llamada = await solicitud(salon, uno, 'pendiente', null);
    const delCarrito = await solicitud(salon, dos, 'pendiente', notaDelPedidoListo(3));
    exigirOk(await unir(salon, 0, [1], UNIR), 'unir');
    const pendientes = await obtenerDb()
      .selectFrom('solicitudes_qr')
      .select(['id', 'notas'])
      .where('mesa_id', '=', uno)
      .where('tipo', '=', 'ordenar')
      .where('estado', '=', 'pendiente')
      .execute();
    // Una sola pendiente por mesa y tipo, y es la del carrito: la llamada se da por atendida.
    expect(pendientes).toHaveLength(1);
    expect(pendientes[0]?.notas).toBe(notaDelPedidoListo(3));
    expect((await fila(delCarrito)).estado).toBe('resuelta');
    expect((await fila(llamada)).estado).toBe('pendiente');
  });

  it('si las dos son avisos del carrito, queda uno (los carritos se juntaron)', async () => {
    const salon = await salonEnFila('Salón de dos carritos', 2);
    const [uno, dos] = [mesa(salon, 0), mesa(salon, 1)];
    await solicitud(salon, uno, 'pendiente', notaDelPedidoListo(1));
    const otro = await solicitud(salon, dos, 'pendiente', notaDelPedidoListo(2));
    exigirOk(await unir(salon, 0, [1], UNIR), 'unir');
    expect((await fila(otro)).estado).toBe('resuelta');
  });
});
