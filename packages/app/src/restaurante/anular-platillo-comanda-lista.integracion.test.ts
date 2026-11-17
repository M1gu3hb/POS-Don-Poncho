import { obtenerDb } from '@morphiqpos/data';
import { beforeAll, describe, expect, it } from 'vitest';

import { comando } from '../produccion.ts';
import { clave, exigirOk } from '../pruebas/negocio-real.ts';
import { anularLineaComando } from './anulacion-linea.ts';
import { transicionarPedido } from './preparacion.ts';
import {
  abrirLasCajas,
  ambitoDeCaja,
  eventosDeLaMesa,
  lineasDe,
  mesaPersistida,
  sembrarSalon,
  sentarYPedir,
  type PlatilloPedido,
  type Salon,
} from './pruebas/salon-real.ts';

/**
 * Hallazgo 7 (DP-22) · La comanda que se quedaba en «nuevo» al quitar el platillo que faltaba.
 *
 * Con dos platos en una comanda, la cocina marca «Listo» uno y el mesero quita el otro: la comanda
 * se deriva del MÍNIMO de sus platos vivos, pero quitar un platillo sólo cancelaba la comanda si no
 * le quedaba ninguno; si le quedaba uno «listo», la comanda seguía en «nuevo», la mesa no pasaba a
 * «Esperando entrega» y el mesero nunca recibía el aviso.
 *
 * Contra Postgres real, por los comandos de producción; lo que se afirma sale de LEER la base.
 */

let salon: Salon;
let siguienteMesa = 0;

beforeAll(async () => {
  salon = await sembrarSalon({ nombre: 'Fonda de la comanda lista', mesas: 6, terminales: 1 });
  await abrirLasCajas(salon);
}, 120_000);

const db = () => obtenerDb();
const ambito = () => ambitoDeCaja(salon);

interface Plato {
  readonly itemId: string;
  readonly lineaId: string;
}

interface Cuenta {
  readonly ordenId: string;
  readonly mesaId: string;
  readonly comandaId: string;
  readonly arrachera: Plato;
  readonly guacamole: Plato;
}

/** Una mesa nueva con una sola comanda de arrachera y guacamole (la misma estación). */
async function mesaConDosPlatos(pedido: readonly PlatilloPedido[]): Promise<Cuenta> {
  const { ordenId, mesaId } = await sentarYPedir(salon, siguienteMesa, pedido);
  siguienteMesa += 1;
  const lineas = await lineasDe(ordenId);
  const lineaDe = (prefijo: string): string => {
    const clave_ = [...lineas.keys()].find((n) => n.startsWith(prefijo));
    const id = clave_ === undefined ? undefined : lineas.get(clave_)?.[0];
    if (id === undefined) throw new Error(`La cuenta no trae la línea «${prefijo}».`);
    return id;
  };
  const arrachera = lineaDe('Arrachera');
  const guacamole = lineaDe('Guacamole');
  const items = await db()
    .selectFrom('comanda_items')
    .innerJoin('comandas', 'comandas.id', 'comanda_items.comanda_id')
    .select([
      'comanda_items.id as id',
      'comanda_items.orden_linea_id as lineaId',
      'comandas.id as comandaId',
    ])
    .where('comandas.orden_id', '=', ordenId)
    .execute();
  const itemDe = (lineaId: string): string => {
    const fila = items.find((i) => i.lineaId === lineaId);
    if (fila === undefined) throw new Error('Una línea del pedido no llegó a la comanda.');
    return fila.id;
  };
  const comandaIds = new Set(items.map((i) => i.comandaId));
  const [comandaId] = [...comandaIds];
  if (comandaIds.size !== 1 || comandaId === undefined) {
    throw new Error('El pedido de la prueba debía caer en UNA sola comanda.');
  }
  return {
    ordenId,
    mesaId,
    comandaId,
    arrachera: { itemId: itemDe(arrachera), lineaId: arrachera },
    guacamole: { itemId: itemDe(guacamole), lineaId: guacamole },
  };
}

const marcarListo = async (cuenta: Cuenta, plato: Plato): Promise<void> => {
  exigirOk(
    await comando(transicionarPedido, {
      entrada: { comandaId: cuenta.comandaId, estado: 'listo', comandaItemId: plato.itemId },
      ambito: ambito(),
      idempotencyKey: clave(),
    }),
    'restaurante.transicionar_pedido',
  );
};

const quitar = async (cuenta: Cuenta, plato: Plato, cantidad?: string): Promise<void> => {
  exigirOk(
    await comando(anularLineaComando, {
      entrada: {
        ordenId: cuenta.ordenId,
        lineaId: plato.lineaId,
        motivo: 'cliente_cambio',
        ...(cantidad === undefined ? {} : { cantidad }),
      },
      ambito: ambito(),
      idempotencyKey: clave(),
    }),
    'restaurante.anular_linea',
  );
};

const comandaDe = (cuenta: Cuenta) =>
  db()
    .selectFrom('comandas')
    .select(['estado', 'lista_en'])
    .where('id', '=', cuenta.comandaId)
    .executeTakeFirstOrThrow();

const lineaDe = (plato: Plato) =>
  db()
    .selectFrom('orden_lineas')
    .select(['estado_preparacion', 'anulada_en'])
    .where('id', '=', plato.lineaId)
    .executeTakeFirstOrThrow();

const PEDIDO_DE_DOS: readonly PlatilloPedido[] = [
  { platillo: 'arrachera', cantidad: '1' },
  { platillo: 'guacamole', cantidad: '1' },
];

describe('Hallazgo 7 · quitar el platillo que faltaba cierra la comanda', () => {
  it('el plato vivo ya estaba listo: la comanda queda lista y la mesa espera la entrega', async () => {
    const cuenta = await mesaConDosPlatos(PEDIDO_DE_DOS);
    await marcarListo(cuenta, cuenta.guacamole);
    // Con un plato listo y otro pendiente, la comanda sigue «nuevo» (el mínimo).
    expect((await comandaDe(cuenta)).estado).toBe('nuevo');
    expect((await mesaPersistida(cuenta.mesaId)).estado).toBe('pedido_enviado');

    await quitar(cuenta, cuenta.arrachera);

    const comanda = await comandaDe(cuenta);
    expect(comanda.estado).toBe('listo');
    expect(comanda.lista_en).not.toBeNull();
    expect((await mesaPersistida(cuenta.mesaId)).estado).toBe('en_espera_entrega');
    expect((await lineaDe(cuenta.guacamole)).estado_preparacion).toBe('listo');
    // El aviso al mesero sale del ledger de la mesa: su última transición es «esperando entrega».
    const eventos = await eventosDeLaMesa(cuenta.mesaId);
    expect(eventos.at(-1)?.estado_nuevo).toBe('en_espera_entrega');
  }, 60_000);

  it('el plato vivo sigue pendiente: la comanda y la mesa no cambian', async () => {
    const cuenta = await mesaConDosPlatos(PEDIDO_DE_DOS);
    await marcarListo(cuenta, cuenta.arrachera);
    const eventosAntes = (await eventosDeLaMesa(cuenta.mesaId)).length;

    // Se quita el plato que ya estaba listo: el que queda (guacamole) sigue por preparar.
    await quitar(cuenta, cuenta.arrachera);

    expect((await comandaDe(cuenta)).estado).toBe('nuevo');
    expect((await mesaPersistida(cuenta.mesaId)).estado).toBe('pedido_enviado');
    expect((await lineaDe(cuenta.guacamole)).estado_preparacion).toBe('pendiente');
    expect((await eventosDeLaMesa(cuenta.mesaId)).length).toBe(eventosAntes);
  }, 60_000);

  it('anulación parcial de cantidad: nada cambia, el platillo sigue vivo', async () => {
    const cuenta = await mesaConDosPlatos([
      { platillo: 'arrachera', cantidad: '2' },
      { platillo: 'guacamole', cantidad: '1' },
    ]);
    await marcarListo(cuenta, cuenta.guacamole);
    const eventosAntes = (await eventosDeLaMesa(cuenta.mesaId)).length;

    await quitar(cuenta, cuenta.arrachera, '1');

    expect((await comandaDe(cuenta)).estado).toBe('nuevo');
    expect((await mesaPersistida(cuenta.mesaId)).estado).toBe('pedido_enviado');
    expect((await eventosDeLaMesa(cuenta.mesaId)).length).toBe(eventosAntes);
    const vivos = await db()
      .selectFrom('comanda_items')
      .select('estado')
      .where('comanda_id', '=', cuenta.comandaId)
      .where('estado', '<>', 'cancelado')
      .execute();
    expect(vivos).toHaveLength(2);
  }, 60_000);
});
