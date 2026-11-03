import { conTransaccion, obtenerDb } from '@morphiqpos/data';
import { describe, expect, it } from 'vitest';

import { salidasSinVenta } from '../caja/corte/consultas.ts';
import { comando } from '../produccion.ts';
import { clave, exigirOk } from '../pruebas/negocio-real.ts';
import { anularLineaComando } from './anulacion-linea.ts';
import { cancelarOrden } from './cancelacion.ts';
import { entregarPedidos, transicionarPedido } from './preparacion.ts';
import {
  EXISTENCIA_INICIAL,
  ambitoDeCaja,
  existenciasDelSalon,
  lineasDe,
  sembrarSalon,
  sentarYPedir,
  type NombreDeInsumo,
  type Salon,
} from './pruebas/salon-real.ts';

/**
 * DP-13.3 · LO CANCELADO QUE YA ESTABA HECHO ES MERMA «POR CANCELACIÓN», contra Postgres.
 *
 * El almacén sólo bajaba al cobrar: una arrachera que la cocina ya sirvió y la mesa no pagó se
 * quedaba en el inventario aunque ya no existía, y el corte la contaba como pérdida sin que el
 * almacén lo supiera. Ahora, al cancelar la cuenta o anular el platillo, lo que ya estaba listo o
 * entregado sale del almacén —su receta, o la pieza si se vende por pieza— como merma, y el corte
 * la dice «Por cancelación». Lo que la cocina no había hecho no toca el almacén.
 */

async function salonConAlmacen(nombre: string): Promise<Salon> {
  return sembrarSalon({ nombre, mesas: 4, terminales: 1 });
}

async function dejarListoElPlatillo(salon: Salon, lineaId: string): Promise<void> {
  const item = await obtenerDb()
    .selectFrom('comanda_items')
    .select(['id', 'comanda_id'])
    .where('orden_linea_id', '=', lineaId)
    .executeTakeFirstOrThrow();
  exigirOk(
    await comando(transicionarPedido, {
      entrada: { comandaId: item.comanda_id, comandaItemId: item.id, estado: 'listo' },
      ambito: ambitoDeCaja(salon),
      idempotencyKey: clave(),
    }),
    'restaurante.transicionar_pedido',
  );
}

async function entregarTodo(salon: Salon, ordenId: string): Promise<void> {
  const comandas = await obtenerDb()
    .selectFrom('comandas')
    .select('id')
    .where('orden_id', '=', ordenId)
    .execute();
  for (const { id } of comandas) {
    exigirOk(
      await comando(transicionarPedido, {
        entrada: { comandaId: id, estado: 'listo' },
        ambito: ambitoDeCaja(salon),
        idempotencyKey: clave(),
      }),
      'restaurante.transicionar_pedido',
    );
  }
  exigirOk(
    await comando(entregarPedidos, {
      entrada: { ordenId },
      ambito: ambitoDeCaja(salon),
      idempotencyKey: clave(),
    }),
    'restaurante.entregar_pedidos',
  );
}

/** Cuánto bajó cada insumo desde la siembra (positivo: salió del almacén). */
async function loQueSalio(salon: Salon): Promise<Record<NombreDeInsumo, number>> {
  const hay = await existenciasDelSalon(salon);
  const salio = {} as Record<NombreDeInsumo, number>;
  for (const nombre of Object.keys(EXISTENCIA_INICIAL) as NombreDeInsumo[]) {
    salio[nombre] = EXISTENCIA_INICIAL[nombre] - Number(hay[nombre]);
  }
  return salio;
}

const mermasDe = (salon: Salon) =>
  obtenerDb()
    .selectFrom('movimientos_stock')
    .select(['tipo', 'motivo', 'referencia_tipo', 'referencia_id', 'cantidad', 'nota'])
    .where('organizacion_id', '=', salon.negocio.organizacionId)
    .where('tipo', '=', 'merma')
    .execute();

const lineaDe = async (ordenId: string, platillo: string): Promise<string> =>
  (await lineasDe(ordenId)).get(platillo)?.[0] ?? '';

describe('cancelar la cuenta', () => {
  it('la arrachera ya LISTA sale del almacén por su receta; el guacamole sin hacer, no', async () => {
    const salon = await salonConAlmacen('Fonda que cancela lo hecho');
    const { ordenId } = await sentarYPedir(salon, 0, [
      { platillo: 'arrachera', cantidad: '1' },
      { platillo: 'guacamole', cantidad: '1' },
    ]);
    await dejarListoElPlatillo(salon, await lineaDe(ordenId, 'Arrachera al carbón'));
    // 50 centavos el gramo de arrachera: la merma lleva el costo del insumo, no cero.
    await obtenerDb()
      .updateTable('insumos')
      .set({ costo_unitario_centavos: 50n })
      .where('id', '=', salon.insumos.arrachera)
      .execute();
    exigirOk(
      await comando(cancelarOrden, {
        entrada: { ordenId, motivo: 'Se fueron sin pagar' },
        ambito: ambitoDeCaja(salon),
        idempotencyKey: clave(),
      }),
      'restaurante.cancelar_orden',
    );

    expect(await loQueSalio(salon)).toMatchObject({
      arrachera: 280,
      frijol: 150,
      tortilla: 4,
      aguacate: 0,
      jitomate: 0,
    });
    const mermas = await mermasDe(salon);
    expect(mermas).toHaveLength(3);
    for (const m of mermas) {
      expect(m).toMatchObject({ referencia_tipo: 'orden', referencia_id: ordenId });
      expect(m.nota).toMatch(/^Por cancelación/);
    }

    // El corte la dice «Por cancelación», con su costo (el del insumo, no cero).
    const salidas = await conTransaccion((tx) =>
      salidasSinVenta(tx, salon.negocio.organizacionId, {
        abiertaEn: new Date(Date.now() - 3_600_000),
        cerradaEn: new Date(),
      }),
    );
    expect(salidas.map((s) => [s.tipo, s.motivo])).toEqual(
      expect.arrayContaining([['merma', 'Por cancelación']]),
    );
    expect(salidas.every((s) => s.motivo === 'Por cancelación')).toBe(true);
    const deArrachera = salidas.find((s) => s.nombre.includes('arrachera'));
    expect(deArrachera).toMatchObject({ cantidad: '280', costoCentavos: '14000' });
  });

  it('nada listo: cancelar no toca el almacén', async () => {
    const salon = await salonConAlmacen('Fonda que cancela a tiempo');
    const { ordenId } = await sentarYPedir(salon, 0, [{ platillo: 'arrachera', cantidad: '2' }]);
    exigirOk(
      await comando(cancelarOrden, {
        entrada: { ordenId, motivo: 'Capturé mal la mesa' },
        ambito: ambitoDeCaja(salon),
        idempotencyKey: clave(),
      }),
      'restaurante.cancelar_orden',
    );
    expect(Object.values(await loQueSalio(salon)).every((n) => n === 0)).toBe(true);
    expect(await mermasDe(salon)).toHaveLength(0);
  });
});

describe('anular el platillo', () => {
  it('la cerveza ya ENTREGADA (por pieza) sale; anular la otra antes de prepararse, no', async () => {
    const salon = await salonConAlmacen('Fonda que anula');
    const { ordenId } = await sentarYPedir(salon, 0, [{ platillo: 'cerveza', cantidad: '1' }]);
    await entregarTodo(salon, ordenId);
    const { ordenId: otra } = await sentarYPedir(salon, 1, [
      { platillo: 'cerveza', cantidad: '1' },
    ]);

    for (const [cuenta, motivo] of [
      [ordenId, 'error_mesero'],
      [otra, 'error_mesero'],
    ] as const) {
      exigirOk(
        await comando(anularLineaComando, {
          entrada: { ordenId: cuenta, lineaId: await lineaDe(cuenta, 'Cerveza clara'), motivo },
          ambito: ambitoDeCaja(salon),
          idempotencyKey: clave(),
        }),
        'restaurante.anular_linea',
      );
    }

    expect((await loQueSalio(salon)).cerveza).toBe(1);
    const [merma] = await mermasDe(salon);
    expect(merma).toMatchObject({ referencia_tipo: 'anulacion', cantidad: '-1.0000' });
  });

  it('anular UNA de dos arracheras ya listas: sale una receta, no dos; cancelar después, la otra', async () => {
    const salon = await salonConAlmacen('Fonda que anula una pieza');
    const { ordenId } = await sentarYPedir(salon, 0, [{ platillo: 'arrachera', cantidad: '2' }]);
    const arrachera = await lineaDe(ordenId, 'Arrachera al carbón');
    await dejarListoElPlatillo(salon, arrachera);
    exigirOk(
      await comando(anularLineaComando, {
        entrada: { ordenId, lineaId: arrachera, motivo: 'error_mesero', cantidad: '1' },
        ambito: ambitoDeCaja(salon),
        idempotencyKey: clave(),
      }),
      'restaurante.anular_linea',
    );
    expect((await loQueSalio(salon)).arrachera).toBe(280);
    exigirOk(
      await comando(cancelarOrden, {
        entrada: { ordenId, motivo: 'Se fueron' },
        ambito: ambitoDeCaja(salon),
        idempotencyKey: clave(),
      }),
      'restaurante.cancelar_orden',
    );
    expect((await loQueSalio(salon)).arrachera).toBe(560);
  });

  it('lo anulado ya listo y después la cuenta cancelada: sale UNA vez', async () => {
    const salon = await salonConAlmacen('Fonda que no cuenta dos veces');
    const { ordenId } = await sentarYPedir(salon, 0, [{ platillo: 'guacamole', cantidad: '1' }]);
    const guacamole = await lineaDe(ordenId, 'Guacamole con totopos');
    await dejarListoElPlatillo(salon, guacamole);
    exigirOk(
      await comando(anularLineaComando, {
        entrada: { ordenId, lineaId: guacamole, motivo: 'error_mesero' },
        ambito: ambitoDeCaja(salon),
        idempotencyKey: clave(),
      }),
      'restaurante.anular_linea',
    );
    exigirOk(
      await comando(cancelarOrden, {
        entrada: { ordenId, motivo: 'Quedó vacía' },
        ambito: ambitoDeCaja(salon),
        idempotencyKey: clave(),
      }),
      'restaurante.cancelar_orden',
    );
    expect(await loQueSalio(salon)).toMatchObject({ aguacate: 2, jitomate: 100 });
  });
});
