import { obtenerDb } from '@morphiqpos/data';
import { sql } from 'kysely';
import { beforeAll, describe, expect, it } from 'vitest';

import { comando } from '../produccion.ts';
import { clave, exigirOk } from '../pruebas/negocio-real.ts';
import { ticketDeOrden } from '../venta/consultas.ts';
import { armarParaLlevar, descartarParaLlevar } from './para-llevar.ts';
import { paraLlevarDelDia } from './para-llevar-del-dia.ts';
import {
  abrirLasCajas,
  ambitoDeCaja,
  cobrarExacto,
  sembrarSalon,
  type Salon,
} from './pruebas/salon-real.ts';

/**
 * DP-D157 · El teléfono OPCIONAL del pedido para llevar, contra Postgres.
 *
 * Se captura junto al nombre, se valida en el SERVIDOR (sólo dígitos, espacios, guiones y un «+» al
 * inicio; 7 a 15 dígitos), se ve en la lista de para llevar de la Caja y NO sale en el ticket del
 * cliente. Un pedido que se rearma o se descarta no arrastra el teléfono del anterior.
 */

let salon: Salon;
const caja = () => ambitoDeCaja(salon, 0);
const db = () => obtenerDb();

beforeAll(async () => {
  salon = await sembrarSalon({ nombre: 'Para llevar con teléfono', mesas: 1, terminales: 1 });
  await abrirLasCajas(salon, 50_000);
}, 120_000);

const lineas = () => [{ productoId: salon.platillos.cerveza, cantidad: '1' }];

const armar = (extra: { nombrePedido?: string; telefonoPedido?: string }) =>
  comando(armarParaLlevar, {
    entrada: { ...extra, lineas: lineas() },
    ambito: caja(),
    idempotencyKey: clave(),
  });

const guardado = (ordenId: string) =>
  db()
    .selectFrom('ordenes')
    .select(['nombre_pedido', 'telefono_pedido', 'estado'])
    .where('id', '=', ordenId)
    .executeTakeFirstOrThrow();

const pedidosDelDia = async () =>
  exigirOk(
    await comando(paraLlevarDelDia, { entrada: {}, ambito: caja(), idempotencyKey: clave() }),
    'restaurante.para_llevar_del_dia',
  ).pedidos;

describe('el teléfono, junto al nombre', () => {
  it('se guarda limpio, se cobra y aparece en la lista de para llevar de la Caja', async () => {
    const armado = exigirOk(
      await armar({ nombrePedido: 'Doña Lupe', telefonoPedido: '  55   2468 5678 ' }),
      'restaurante.armar_para_llevar',
    );
    expect(await guardado(armado.ordenId)).toMatchObject({
      nombre_pedido: 'Doña Lupe',
      telefono_pedido: '55 2468 5678',
      estado: 'borrador',
    });

    exigirOk(
      await cobrarExacto(caja(), armado.ordenId, Number(armado.totalCentavos)),
      'venta.cobrar',
    );

    const fila = (await pedidosDelDia()).find((p) => p.ordenId === armado.ordenId);
    expect(fila).toMatchObject({ nombre: 'Doña Lupe', telefono: '55 2468 5678' });
  }, 60_000);

  it('sin teléfono todo sigue igual: es opcional y la lista dice nulo', async () => {
    const armado = exigirOk(await armar({ nombrePedido: 'Beto' }), 'restaurante.armar_para_llevar');
    expect((await guardado(armado.ordenId)).telefono_pedido).toBeNull();
    exigirOk(
      await cobrarExacto(caja(), armado.ordenId, Number(armado.totalCentavos)),
      'venta.cobrar',
    );
    const fila = (await pedidosDelDia()).find((p) => p.ordenId === armado.ordenId);
    expect(fila?.telefono).toBeNull();
  }, 60_000);

  it('un teléfono vacío o de puros espacios es «sin teléfono», no un error', async () => {
    const armado = exigirOk(
      await armar({ telefonoPedido: '   ' }),
      'restaurante.armar_para_llevar',
    );
    expect((await guardado(armado.ordenId)).telefono_pedido).toBeNull();
  }, 60_000);
});

describe('el servidor rechaza lo que no es un teléfono', () => {
  it.each([
    ['letras', '55-ABCD-5678'],
    ['paréntesis', '(55) 2468 5678'],
    ['un + a medias', '55+24685678'],
    ['muy corto', '24685'],
    ['demasiados dígitos', '2468567890246856'],
    ['muy largo', '+52 55 2468 5678 9999 0000'],
    ['código metido', "5524685678'; drop table ordenes;--"],
  ])(
    '%s',
    async (_motivo, telefonoPedido) => {
      const antes = await db()
        .selectFrom('ordenes')
        .select('id')
        .where('telefono_pedido', 'is not', null)
        .execute();

      const salida = await armar({ telefonoPedido });

      expect(salida.ok).toBe(false);
      if (salida.ok) return;
      expect(salida.error.codigo).toBe('ENTRADA_INVALIDA');
      // No escribió nada: ningún pedido nuevo con teléfono.
      const despues = await db()
        .selectFrom('ordenes')
        .select('id')
        .where('telefono_pedido', 'is not', null)
        .execute();
      expect(despues).toHaveLength(antes.length);
    },
    60_000,
  );

  it('la base es la última red: un teléfono inválido escrito directo también cae', async () => {
    const armado = exigirOk(await armar({}), 'restaurante.armar_para_llevar');
    await expect(
      sql`update ordenes set telefono_pedido = 'no es un teléfono' where id = ${armado.ordenId}`.execute(
        db(),
      ),
    ).rejects.toThrow(/ordenes_telefono_pedido_valido/);
  }, 60_000);
});

describe('no se arrastra de un pedido al siguiente', () => {
  it('rearmar el mismo borrador sin teléfono lo borra', async () => {
    const primero = exigirOk(
      await armar({ nombrePedido: 'Ana', telefonoPedido: '5524685678' }),
      'restaurante.armar_para_llevar',
    );
    expect((await guardado(primero.ordenId)).telefono_pedido).toBe('5524685678');
    const segundo = exigirOk(await armar({ nombrePedido: 'Ana' }), 'restaurante.armar_para_llevar');
    expect(segundo.ordenId).toBe(primero.ordenId);
    expect((await guardado(segundo.ordenId)).telefono_pedido).toBeNull();
  }, 60_000);

  it('descartar el pedido deja el borrador sin nombre ni teléfono', async () => {
    const armado = exigirOk(
      await armar({ nombrePedido: 'Luis', telefonoPedido: '+52 55 2468 5678' }),
      'restaurante.armar_para_llevar',
    );
    exigirOk(
      await comando(descartarParaLlevar, {
        entrada: { ordenId: armado.ordenId },
        ambito: caja(),
        idempotencyKey: clave(),
      }),
      'restaurante.descartar_para_llevar',
    );
    expect(await guardado(armado.ordenId)).toMatchObject({
      nombre_pedido: null,
      telefono_pedido: null,
    });
  }, 60_000);
});

describe('el ticket del cliente', () => {
  it('lleva el nombre («PARA LLEVAR · N · nombre») pero NUNCA el teléfono', async () => {
    const armado = exigirOk(
      await armar({ nombrePedido: 'Marta', telefonoPedido: '5598765432' }),
      'restaurante.armar_para_llevar',
    );
    exigirOk(
      await cobrarExacto(caja(), armado.ordenId, Number(armado.totalCentavos)),
      'venta.cobrar',
    );
    const ticket = exigirOk(
      await comando(ticketDeOrden, {
        entrada: { ordenId: armado.ordenId },
        ambito: caja(),
        idempotencyKey: clave(),
      }),
      'venta.ticket',
    );
    expect(ticket.paraLlevar?.nombre).toBe('Marta');
    expect(JSON.stringify(ticket)).not.toContain('5598765432');
  }, 60_000);
});
