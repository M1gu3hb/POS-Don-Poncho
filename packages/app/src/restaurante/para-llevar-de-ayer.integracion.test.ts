import { obtenerDb } from '@morphiqpos/data';
import { sql } from 'kysely';
import { beforeAll, describe, expect, it } from 'vitest';

import { comando } from '../produccion.ts';
import { clave, exigirOk } from '../pruebas/negocio-real.ts';
import { armarParaLlevar } from './para-llevar.ts';
import { paraLlevarDelDia } from './para-llevar-del-dia.ts';
import { entregarParaLlevar } from './para-llevar-entregar.ts';
import { transicionarPedido } from './preparacion.ts';
import {
  abrirLasCajas,
  ambitoDeCaja,
  cobrarExacto,
  sembrarSalon,
  type Salon,
} from './pruebas/salon-real.ts';

/**
 * DP-18 · M3 (auditoría del 10-11) · EL PEDIDO PARA LLEVAR QUE CRUZA LA MEDIANOCHE.
 *
 * La lista de la Caja traía sólo los pedidos del día del negocio. Uno cobrado a las 23:55 y listo a
 * las 00:05 desaparecía de la lista a la medianoche, listo y sin entregar: nadie lo veía para tocar
 * «Entregado» y el cliente esperaba en el mostrador. Ahora se queda hasta que alguien lo entrega.
 */

let salon: Salon;
let tacoId = '';
const caja = () => ambitoDeCaja(salon, 0);

async function pedidoCobrado(): Promise<{ ordenId: string; comandaId: string }> {
  const { ordenId, totalCentavos } = exigirOk(
    await comando(armarParaLlevar, {
      entrada: { nombrePedido: 'Don Beto', lineas: [{ productoId: tacoId, cantidad: '1' }] },
      ambito: caja(),
      idempotencyKey: clave(),
    }),
    'restaurante.armar_para_llevar',
  );
  exigirOk(await cobrarExacto(caja(), ordenId, Number(totalCentavos)), 'venta.cobrar');
  const { id } = await obtenerDb()
    .selectFrom('comandas')
    .select('id')
    .where('orden_id', '=', ordenId)
    .executeTakeFirstOrThrow();
  return { ordenId, comandaId: id };
}

/**
 * Lo cobrado «ayer»: el día del pedido, un día antes (como si se hubiera cobrado a las 23:55). El
 * número se mueve a la serie de ayer para no chocar con el índice único del día.
 */
let deAyerVan = 900;
async function deAyer(ordenId: string): Promise<void> {
  deAyerVan += 1;
  await sql`update ordenes set dia_del_pedido = dia_del_pedido - 1, numero_pedido = ${deAyerVan} where id = ${ordenId}`.execute(
    obtenerDb(),
  );
}

const enLaLista = async () =>
  exigirOk(
    await comando(paraLlevarDelDia, { entrada: {}, ambito: caja(), idempotencyKey: clave() }),
    'restaurante.para_llevar_del_dia',
  ).pedidos;

beforeAll(async () => {
  salon = await sembrarSalon({ nombre: 'Para llevar de ayer', mesas: 1, terminales: 1 });
  await abrirLasCajas(salon, 50_000);
  tacoId = (
    await obtenerDb()
      .insertInto('productos')
      .values({
        organizacion_id: salon.negocio.organizacionId,
        nombre: 'Taco de prueba',
        precio_venta_centavos: 3_000n,
        costo_unitario_centavos: 0n,
        estrategia_consumo: 'ninguno',
        area_preparacion: 'cocina',
      })
      .returning('id')
      .executeTakeFirstOrThrow()
  ).id;
});

describe('DP-18 · M3 · lo de ayer sin entregar sigue en la lista de hoy', () => {
  it('cobrado antes de medianoche y listo después: sigue en la lista hasta «Entregado»', async () => {
    const { ordenId, comandaId } = await pedidoCobrado();
    await deAyer(ordenId);
    // Sigue en la cocina: está en la lista.
    expect((await enLaLista()).find((p) => p.ordenId === ordenId)).toMatchObject({
      estado: 'en_cocina',
      deOtroDia: true,
    });

    // La cocina lo termina después de medianoche: listo, y en la lista.
    exigirOk(
      await comando(transicionarPedido, {
        entrada: { comandaId, estado: 'listo' },
        ambito: caja(),
        idempotencyKey: clave(),
      }),
      'restaurante.transicionar_pedido',
    );
    expect((await enLaLista()).find((p) => p.ordenId === ordenId)?.estado).toBe('listo');

    // «Entregado»: ya no hace falta enseñarlo.
    exigirOk(
      await comando(entregarParaLlevar, {
        entrada: { ordenId },
        ambito: caja(),
        idempotencyKey: clave(),
      }),
      'restaurante.entregar_para_llevar',
    );
    expect((await enLaLista()).find((p) => p.ordenId === ordenId)).toBeUndefined();
  });

  it('lo de ayer ya entregado no aparece; lo de hoy entregado sí (la lista del día)', async () => {
    const ayer = await pedidoCobrado();
    await deAyer(ayer.ordenId);
    const hoy = await pedidoCobrado();
    for (const p of [ayer, hoy]) {
      exigirOk(
        await comando(transicionarPedido, {
          entrada: { comandaId: p.comandaId, estado: 'listo' },
          ambito: caja(),
          idempotencyKey: clave(),
        }),
        'restaurante.transicionar_pedido',
      );
      exigirOk(
        await comando(entregarParaLlevar, {
          entrada: { ordenId: p.ordenId },
          ambito: caja(),
          idempotencyKey: clave(),
        }),
        'restaurante.entregar_para_llevar',
      );
    }
    const lista = await enLaLista();
    expect(lista.find((p) => p.ordenId === ayer.ordenId)).toBeUndefined();
    expect(lista.find((p) => p.ordenId === hoy.ordenId)).toMatchObject({
      estado: 'entregado',
      deOtroDia: false,
    });
  });
});
