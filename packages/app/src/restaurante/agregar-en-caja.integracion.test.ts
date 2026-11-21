import { randomUUID } from 'node:crypto';

import { conTransaccion, obtenerDb } from '@morphiqpos/data';
import { beforeAll, describe, expect, it } from 'vitest';

import { comando } from '../produccion.ts';
import {
  abrirCajaReal,
  ambitoDe,
  clave,
  exigirOk,
  sembrarCompanero,
  sembrarNegocio,
  sembrarProducto,
  sembrarSucursal,
  type NegocioReal,
} from '../pruebas/negocio-real.ts';
import { cobrarOrden } from '../venta/cobrar.ts';
import { agregarEnCaja } from './agregar-en-caja.ts';
import { solicitarCuenta } from './cuenta.ts';
import { abrirMesa } from './mesas.ts';
import { enviarPedido } from './pedido.ts';

/**
 * DP-24 · LA CAJA AGREGA PRODUCTOS A LA CUENTA QUE ESTÁ COBRANDO, contra Postgres.
 *
 * «Y dos tamales para llevar», con la cuenta ya pedida. Antes la cuenta pedida no se editaba: había
 * que cobrarla y abrir otra venta, o pedirle al mesero que reabriera la mesa. Ahora la Caja agrega
 * a ESA cuenta —«Agregar a la cuenta» y «Para llevar»— y lo agregado sale a cocina como cualquier
 * pedido; lo de «para llevar» va marcado en la comanda y en la cuenta. La cuenta sigue pedida, su
 * total lo recalcula el servidor y su versión sube (la caja que la tenía abierta se entera).
 */

const LARGO = 300_000;
const PLATO_CENTAVOS = 46_000;
const TAMAL_CENTAVOS = 2_500;

let negocio: NegocioReal;
let ambito: ReturnType<typeof ambitoDe>;
let sucursalId: string;
let plato: string;
let tamal: string;
let mesero: string;
let cajera: string;
let siguienteMesa = 700;

beforeAll(async () => {
  negocio = await sembrarNegocio({
    nombre: 'Fonda que agrega en la caja',
    rol: 'dueno',
    giro: 'restaurante',
    paquete: 'restaurante',
  });
  const sucursal = await sembrarSucursal(negocio, { terminales: ['Caja'] });
  sucursalId = sucursal.sucursalId;
  ambito = ambitoDe(negocio, sucursalId, sucursal.terminales[0] ?? null);
  ({ productoId: plato } = await sembrarProducto(negocio, sucursal.almacenId, {
    nombre: 'Barbacoa de horno',
    precioCentavos: BigInt(PLATO_CENTAVOS),
    existencia: '100000',
  }));
  ({ productoId: tamal } = await sembrarProducto(negocio, sucursal.almacenId, {
    nombre: 'Tamales de frijol',
    precioCentavos: BigInt(TAMAL_CENTAVOS),
    existencia: '100000',
  }));
  // La cocina: una estación general, y los dos platillos se preparan ahí (salen en comanda).
  await conTransaccion(async (tx) => {
    await tx
      .insertInto('estaciones_preparacion')
      .values({
        organizacion_id: negocio.organizacionId,
        nombre: 'Cocina general',
        es_general: true,
      })
      .execute();
    await tx
      .updateTable('productos')
      .set({ area_preparacion: 'cocina' })
      .where('organizacion_id', '=', negocio.organizacionId)
      .execute();
  });
  mesero = await sembrarCompanero(negocio, { nombre: 'Lupita', rol: 'mesero' });
  cajera = await sembrarCompanero(negocio, { nombre: 'Rosa', rol: 'cajero' });
  await abrirCajaReal(ambito);
}, LARGO);

const comoMesero = () => ({ ...ambito, empleoId: mesero, rol: 'mesero' as const });
const comoCajera = () => ({ ...ambito, empleoId: cajera, rol: 'cajero' as const });

/** Una mesa con una barbacoa ya en cocina y la cuenta pedida: lo que la Caja tiene en «Pendientes». */
async function mesaConCuentaPedida(): Promise<{ ordenId: string; mesaId: string }> {
  const mesaId = randomUUID();
  siguienteMesa += 1;
  await conTransaccion((tx) =>
    tx
      .insertInto('mesas')
      .values({
        id: mesaId,
        organizacion_id: negocio.organizacionId,
        sucursal_id: sucursalId,
        numero: siguienteMesa,
        nombre: `Mesa ${String(siguienteMesa)}`,
      })
      .execute(),
  );
  const { ordenId } = exigirOk(
    await comando(abrirMesa, {
      entrada: { mesaId, personas: 2 },
      ambito: comoMesero(),
      idempotencyKey: clave(),
    }),
    'restaurante.abrir_mesa',
  );
  exigirOk(
    await comando(enviarPedido, {
      entrada: { ordenId, lineas: [{ productoId: plato, cantidad: '1' }] },
      ambito: comoMesero(),
      idempotencyKey: clave(),
    }),
    'restaurante.enviar_pedido',
  );
  exigirOk(
    await comando(solicitarCuenta, {
      entrada: { ordenId },
      ambito: comoMesero(),
      idempotencyKey: clave(),
    }),
    'restaurante.solicitar_cuenta',
  );
  return { ordenId, mesaId };
}

function cuenta(ordenId: string) {
  return obtenerDb()
    .selectFrom('ordenes')
    .select(['estado', 'version', 'total_centavos'])
    .where('id', '=', ordenId)
    .executeTakeFirstOrThrow();
}

function lineasDe(ordenId: string) {
  return obtenerDb()
    .selectFrom('orden_lineas')
    .select(['producto_nombre', 'cantidad', 'notas', 'total_centavos'])
    .where('orden_id', '=', ordenId)
    .orderBy('orden_visual')
    .execute();
}

function enCocina(ordenId: string) {
  return obtenerDb()
    .selectFrom('comanda_items as i')
    .innerJoin('comandas as c', 'c.id', 'i.comanda_id')
    .select([
      'i.producto_nombre',
      'i.notas',
      'i.estado',
      'c.notas as notaDeLaComanda',
      'c.estado as estadoDeLaComanda',
    ])
    .where('c.orden_id', '=', ordenId)
    .orderBy('c.created_at')
    .orderBy('i.orden_visual')
    .execute();
}

describe('la Caja agrega a la cuenta que está cobrando', () => {
  it('PARA LLEVAR a una cuenta de mesa ya pedida: se suma, sale a cocina marcado y la cuenta sigue pedida', async () => {
    const { ordenId, mesaId } = await mesaConCuentaPedida();
    const antes = await cuenta(ordenId);
    expect([antes.estado, antes.total_centavos]).toEqual(['cuenta_solicitada', 46_000n]);

    const agregado = exigirOk(
      await comando(agregarEnCaja, {
        entrada: {
          ordenId,
          paraLlevar: true,
          lineas: [
            { productoId: tamal, cantidad: '2' },
            { productoId: plato, cantidad: '1', notas: 'sin cebolla' },
          ],
        },
        ambito: comoCajera(),
        idempotencyKey: clave(),
      }),
      'restaurante.agregar_en_caja',
    );
    // $460 + 2 × $25 + $460 = $970.00: el total lo dice el servidor.
    expect(agregado.totalCentavos).toBe('97000');
    expect(agregado.lineas).toBe(2);
    expect(agregado.version).toBe(antes.version + 1);

    const despues = await cuenta(ordenId);
    expect([despues.estado, despues.total_centavos, despues.version]).toEqual([
      'cuenta_solicitada',
      97_000n,
      antes.version + 1,
    ]);
    expect((await lineasDe(ordenId)).map((l) => [l.producto_nombre, l.notas])).toEqual([
      ['Barbacoa de horno', null],
      ['Tamales de frijol', 'PARA LLEVAR'],
      ['Barbacoa de horno', 'PARA LLEVAR · sin cebolla'],
    ]);

    // A cocina como cualquier pedido: comandas nuevas, con su marca en el platillo y en el bloque.
    const cocina = await enCocina(ordenId);
    const nuevos = cocina.filter((i) => i.notas?.startsWith('PARA LLEVAR'));
    expect(nuevos.map((i) => [i.producto_nombre, i.notas, i.estado])).toEqual([
      ['Tamales de frijol', 'PARA LLEVAR', 'pendiente'],
      ['Barbacoa de horno', 'PARA LLEVAR · sin cebolla', 'pendiente'],
    ]);
    expect(new Set(nuevos.map((i) => i.notaDeLaComanda))).toEqual(new Set(['PARA LLEVAR']));
    expect(new Set(nuevos.map((i) => i.estadoDeLaComanda))).toEqual(new Set(['nuevo']));
    // Lo que ya estaba en cocina no se toca.
    expect(cocina.filter((i) => i.notas === null)).toHaveLength(1);

    // La mesa sigue con la cuenta pedida: agregar en la caja no la «reabre».
    const mesa = await obtenerDb()
      .selectFrom('mesas')
      .select('estado')
      .where('id', '=', mesaId)
      .executeTakeFirstOrThrow();
    expect(mesa.estado).toBe('cuenta_solicitada');

    // Y se cobra por el total nuevo; con el de antes, el servidor avisa que cambió.
    const conElViejo = await comando(cobrarOrden, {
      entrada: {
        ordenId,
        pagos: [{ metodo: 'tarjeta', montoCentavos: 46_000 }],
        totalEsperadoCentavos: 46_000,
      },
      ambito: comoCajera(),
      idempotencyKey: clave(),
    });
    expect(conElViejo.ok).toBe(false);
    exigirOk(
      await comando(cobrarOrden, {
        entrada: {
          ordenId,
          pagos: [{ metodo: 'tarjeta', montoCentavos: 97_000 }],
          totalEsperadoCentavos: 97_000,
          versionDeLaCuenta: agregado.version,
        },
        ambito: comoCajera(),
        idempotencyKey: clave(),
      }),
      'venta.cobrar',
    );
    expect((await cuenta(ordenId)).estado).toBe('pagada');
  });

  it('«Agregar a la cuenta» (para comer aquí): sin marca', async () => {
    const { ordenId } = await mesaConCuentaPedida();
    exigirOk(
      await comando(agregarEnCaja, {
        entrada: { ordenId, lineas: [{ productoId: tamal, cantidad: '1' }] },
        ambito: comoCajera(),
        idempotencyKey: clave(),
      }),
      'restaurante.agregar_en_caja',
    );
    expect((await lineasDe(ordenId)).map((l) => [l.producto_nombre, l.notas])).toEqual([
      ['Barbacoa de horno', null],
      ['Tamales de frijol', null],
    ]);
    expect((await cuenta(ordenId)).total_centavos).toBe(48_500n);
    const cocina = await enCocina(ordenId);
    expect(cocina.map((i) => i.notaDeLaComanda)).toEqual([null, null]);
  });

  it('queda en la auditoría, con cuánto se agregó y que era para llevar', async () => {
    const { ordenId } = await mesaConCuentaPedida();
    exigirOk(
      await comando(agregarEnCaja, {
        entrada: { ordenId, paraLlevar: true, lineas: [{ productoId: tamal, cantidad: '3' }] },
        ambito: comoCajera(),
        idempotencyKey: clave(),
      }),
      'restaurante.agregar_en_caja',
    );
    const rastro = await obtenerDb()
      .selectFrom('auditoria')
      .select(['identidad_id', 'payload'])
      .where('organizacion_id', '=', negocio.organizacionId)
      .where('accion', '=', 'restaurante.agregar_en_caja')
      .where('entidad_id', '=', ordenId)
      .executeTakeFirstOrThrow();
    // Quién: la identidad de la sesión (en la prueba, la de la persona del negocio).
    expect(rastro.identidad_id).toBe(negocio.identidadId);
    expect(rastro.payload).toMatchObject({ lineas: 1, paraLlevar: true, totalCentavos: '53500' });
  });

  it('el mesero no agrega por aquí (es de la Caja), ni nadie a una cuenta ya cobrada', async () => {
    const { ordenId } = await mesaConCuentaPedida();
    const delMesero = await comando(agregarEnCaja, {
      entrada: { ordenId, lineas: [{ productoId: tamal, cantidad: '1' }] },
      ambito: comoMesero(),
      idempotencyKey: clave(),
    });
    expect(delMesero.ok).toBe(false);
    if (!delMesero.ok) expect(delMesero.error.codigo).toBe('SIN_PERMISO');
    expect(await lineasDe(ordenId)).toHaveLength(1);

    exigirOk(
      await comando(cobrarOrden, {
        entrada: {
          ordenId,
          pagos: [{ metodo: 'tarjeta', montoCentavos: 46_000 }],
          totalEsperadoCentavos: 46_000,
        },
        ambito: comoCajera(),
        idempotencyKey: clave(),
      }),
      'venta.cobrar',
    );
    const tarde = await comando(agregarEnCaja, {
      entrada: { ordenId, lineas: [{ productoId: tamal, cantidad: '1' }] },
      ambito: comoCajera(),
      idempotencyKey: clave(),
    });
    expect(tarde.ok).toBe(false);
    if (!tarde.ok) expect(tarde.error.datos).toMatchObject({ regla: 'ORDEN_NO_EDITABLE' });
    expect(await lineasDe(ordenId)).toHaveLength(1);
    expect((await cuenta(ordenId)).total_centavos).toBe(46_000n);
  });
});
