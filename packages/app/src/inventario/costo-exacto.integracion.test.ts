import { randomUUID } from 'node:crypto';

import { conTransaccion, obtenerDb } from '@morphiqpos/data';
import { sql } from 'kysely';
import { beforeAll, describe, expect, it } from 'vitest';

import { salidasSinVenta, insumosConsumidos } from '../caja/corte/consultas.ts';
import { registrarCompra } from '../compras/index.ts';
import { comando } from '../produccion.ts';
import {
  ambitoDe,
  clave,
  exigirOk,
  sembrarNegocio,
  sembrarProducto,
  sembrarSucursal,
  type NegocioReal,
  type SucursalReal,
} from '../pruebas/negocio-real.ts';
import { cancelarOrden } from '../restaurante/cancelacion.ts';
import { transicionarPedido } from '../restaurante/preparacion.ts';
import {
  PRECIO_ARRACHERA,
  abrirLasCajas,
  ambitoDeCaja,
  cobrarExacto,
  lineasDe,
  sembrarSalon,
  sentarYPedir,
} from '../restaurante/pruebas/salon-real.ts';
import { ajustarStock, inventarioInicial } from './inventario.ts';
import { guardarReceta } from './recetas.ts';
import { tomarValuacion } from './valuacion.ts';

/**
 * DP-22 · DP-D165 · EL COSTO EXACTO DE UN INSUMO (hallazgo 14 de la auditoría), contra Postgres.
 *
 * El costo por unidad base (el gramo, el mililitro, la pieza) se guardaba en centavos ENTEROS: la
 * leche, a $480.00 los 20 litros, son 2.4 ¢/ml y quedaba en 2 (−16.7 %); el maíz, a 4.5 ¢/g, en 5
 * (+11 %). Con siete compras que sumaban lo mismo, «Valor de inventario» decía otra cosa. Ahora se
 * guarda además el costo EXACTO en diezmilésimas de centavo por unidad base, quien MULTIPLICA usa ése y
 * se redondea UNA sola vez, a centavos, al final.
 *
 * Cada prueba lleva en su nombre el número que pide el encargo: (a) siete compras, (b) la leche y la
 * receta, (c) el promedio ponderado, (d) merma y consumo, (e) la existencia en negativo.
 */

let negocio: NegocioReal;
let sucursal: SucursalReal;

beforeAll(async () => {
  negocio = await sembrarNegocio({
    nombre: 'Fonda del costo exacto',
    rol: 'dueno',
    giro: 'restaurante',
    paquete: 'restaurante',
  });
  sucursal = await sembrarSucursal(negocio, { terminales: ['Caja 1'] });
}, 60_000);

const ambito = () => ambitoDe(negocio, sucursal.sucursalId, null);

interface CompraDe {
  readonly nombre: string;
  readonly unidadBase: 'g' | 'ml' | 'pieza';
  readonly cantidad: string;
  readonly unidadCapturada: string;
  readonly equivalencia: string;
  readonly total: string;
}

/** Registra UNA compra de un insumo nuevo y devuelve el id del insumo. */
async function comprar(compra: CompraDe): Promise<string> {
  const hecha = exigirOk(
    await comando(registrarCompra, {
      entrada: {
        proveedorNombre: 'Don Beto',
        metodoPago: 'transferencia',
        lineas: [
          {
            nuevo: {
              nombre: `${compra.nombre} ${randomUUID().slice(0, 6)}`,
              unidadBase: compra.unidadBase,
            },
            cantidadCapturada: compra.cantidad,
            unidadCapturada: compra.unidadCapturada,
            equivalencia: compra.equivalencia,
            costoTotal: compra.total,
          },
        ],
      },
      ambito: ambito(),
      idempotencyKey: clave(),
    }),
    'compras.registrar',
  );
  const entrada = await obtenerDb()
    .selectFrom('movimientos_stock')
    .select('insumo_id')
    .where('referencia_id', '=', hecha.compraId)
    .executeTakeFirstOrThrow();
  return entrada.insumo_id;
}

/** Otra compra de un insumo que ya existe. */
async function comprarMas(
  insumoId: string,
  cantidad: string,
  unidadCapturada: string,
  equivalencia: string,
  total: string,
): Promise<void> {
  exigirOk(
    await comando(registrarCompra, {
      entrada: {
        proveedorNombre: 'Don Beto',
        metodoPago: 'transferencia',
        lineas: [
          {
            insumoId,
            cantidadCapturada: cantidad,
            unidadCapturada,
            equivalencia,
            costoTotal: total,
          },
        ],
      },
      ambito: ambito(),
      idempotencyKey: clave(),
    }),
    'compras.registrar',
  );
}

const insumoDe = (id: string) =>
  obtenerDb()
    .selectFrom('insumos')
    .select(['costo_unitario_centavos', 'costo_exacto_dmc'])
    .where('id', '=', id)
    .executeTakeFirstOrThrow();

/** La suma de la vista de existencias que alimenta «Valor de inventario» de una lista de insumos. */
async function valorEnLaVista(ids: readonly string[]): Promise<bigint> {
  const { rows } = await sql<{ v: string }>`
    select coalesce(sum(valor_centavos), 0)::text as v
      from existencias_por_insumo
     where organizacion_id = ${negocio.organizacionId} and insumo_id = any(${ids}::uuid[])
  `.execute(obtenerDb());
  return BigInt(rows[0]?.v ?? '0');
}

/** La valuación guardada de todo el almacén. */
async function valuar() {
  const resultado = exigirOk(
    await comando(tomarValuacion, {
      entrada: { almacenId: sucursal.almacenId, metodo: 'promedio', umbralDias: 180 },
      ambito: ambito(),
      idempotencyKey: clave(),
    }),
    'inventario.valuar',
  );
  const lineas = await obtenerDb()
    .selectFrom('valuacion_lineas')
    .select(['insumo_id', 'valor_centavos', 'costo_exacto_dmc'])
    .where('valuacion_id', '=', resultado.valuacionId)
    .execute();
  return { total: BigInt(resultado.valorCentavos), lineas };
}

const valorDeLaLinea = (
  lineas: readonly { insumo_id: string; valor_centavos: bigint }[],
  id: string,
): bigint => lineas.find((l) => l.insumo_id === id)?.valor_centavos ?? -1n;

describe('(a) las siete compras: «Valor de inventario» es lo comprado, al centavo', () => {
  it('siete compras que suman $12,000.00, con la leche y el maíz entre ellas', async () => {
    const compras: readonly CompraDe[] = [
      // 480.00 / 20 000 ml = 2.4 ¢/ml (antes 2: −16.7 %)
      {
        nombre: 'Leche',
        unidadBase: 'ml',
        cantidad: '20',
        unidadCapturada: 'l',
        equivalencia: '1000',
        total: '480.00',
      },
      // 540.00 / 12 000 g = 4.5 ¢/g (antes 5: +11 %)
      {
        nombre: 'Maíz',
        unidadBase: 'g',
        cantidad: '12',
        unidadCapturada: 'kg',
        equivalencia: '1000',
        total: '540.00',
      },
      // 87.35 / 3 000 g = 2.91166… ¢/g: no es exacto en diezmilésimas y aun así el valor sale al centavo
      {
        nombre: 'Tomate',
        unidadBase: 'g',
        cantidad: '3',
        unidadCapturada: 'kg',
        equivalencia: '1000',
        total: '87.35',
      },
      // 239.52 / 240 pzas = 99.8 ¢/pza
      {
        nombre: 'Cerveza',
        unidadBase: 'pieza',
        cantidad: '240',
        unidadCapturada: 'pieza',
        equivalencia: '1',
        total: '239.52',
      },
      // 2 945.50 / 9 500 g = 31.00526… ¢/g
      {
        nombre: 'Arrachera',
        unidadBase: 'g',
        cantidad: '9.5',
        unidadCapturada: 'kg',
        equivalencia: '1000',
        total: '2945.50',
      },
      // 1 687.50 / 6 250 g = 27 ¢/g
      {
        nombre: 'Queso',
        unidadBase: 'g',
        cantidad: '6.25',
        unidadCapturada: 'kg',
        equivalencia: '1000',
        total: '1687.50',
      },
      // 6 020.13 / 7 300 g = 82.4675… ¢/g
      {
        nombre: 'Camarón',
        unidadBase: 'g',
        cantidad: '7.3',
        unidadCapturada: 'kg',
        equivalencia: '1000',
        total: '6020.13',
      },
    ];
    expect(compras).toHaveLength(7);

    const ids: string[] = [];
    for (const compra of compras) ids.push(await comprar(compra));

    // Lo comprado: 48 000 + 54 000 + 8 735 + 23 952 + 294 550 + 168 750 + 602 013 = 1 200 000 centavos.
    const comprado = 1_200_000n;

    expect(await valorEnLaVista(ids)).toBe(comprado);

    const valuacion = await valuar();
    expect(valuacion.lineas.filter((l) => ids.includes(l.insumo_id))).toHaveLength(7);
    const deLasSiete = ids.reduce((suma, id) => suma + valorDeLaLinea(valuacion.lineas, id), 0n);
    expect(deLasSiete).toBe(comprado);
    // La leche y el maíz, que eran los que más se alejaban, valen lo que costaron.
    expect(valorDeLaLinea(valuacion.lineas, ids[0] ?? '')).toBe(48_000n);
    expect(valorDeLaLinea(valuacion.lineas, ids[1] ?? '')).toBe(54_000n);
    // La valuación guardada conserva el costo exacto con el que se valuó cada renglón.
    expect(valuacion.lineas.find((l) => l.insumo_id === ids[0])?.costo_exacto_dmc).toBe(24_000n);
    expect(valuacion.lineas.find((l) => l.insumo_id === ids[1])?.costo_exacto_dmc).toBe(45_000n);

    // El kardex valúa cada entrada de compra con el costo exacto con el que entró: la suma es lo comprado.
    const kardex = await sql<{ importe: string }>`
      select coalesce(sum(importe_centavos), 0)::text as importe
        from kardex
       where organizacion_id = ${negocio.organizacionId}
         and tipo = 'entrada_compra' and insumo_id = any(${ids}::uuid[])
    `.execute(obtenerDb());
    expect(BigInt(kardex.rows[0]?.importe ?? '0')).toBe(comprado);
  });
});

describe('(b) la leche: 2.4 ¢/ml exactos y una receta de 250 ml que cuesta $6.00', () => {
  it('guarda el costo exacto además del redondeado, y la receta multiplica con el exacto', async () => {
    const leche = await comprar({
      nombre: 'Leche',
      unidadBase: 'ml',
      cantidad: '20',
      unidadCapturada: 'l',
      equivalencia: '1000',
      total: '480.00',
    });
    // 2.4 ¢/ml = 24 000 diezmilésimas de centavo; el redondeado sigue ahí, para quien sólo lo muestra.
    expect(await insumoDe(leche)).toEqual({
      costo_unitario_centavos: 2n,
      costo_exacto_dmc: 24_000n,
    });

    const cafe = await sembrarProducto(negocio, sucursal.almacenId, {
      nombre: 'Café con leche',
      precioCentavos: 5_000n,
      existencia: '0',
    });
    exigirOk(
      await comando(guardarReceta, {
        entrada: {
          productoId: cafe.productoId,
          ingredientes: [{ insumoId: leche, cantidad: '250', unidad: 'ml', mermaBp: 0 }],
        },
        ambito: ambito(),
        idempotencyKey: clave(),
      }),
      'inventario.guardar_receta',
    );
    const producto = await obtenerDb()
      .selectFrom('productos')
      .select('costo_unitario_centavos')
      .where('id', '=', cafe.productoId)
      .executeTakeFirstOrThrow();
    // 250 ml × 2.4 ¢ = $6.00 (con el entero de antes eran 250 × 2 = $5.00).
    expect(producto.costo_unitario_centavos).toBe(600n);
  });

  it('la receta redondea UNA sola vez, al final: dos líneas de 2.5 ¢ cuestan 5 ¢, no 6', async () => {
    // 25.00 / 1 000 g = 2.5 ¢/g.
    const base = {
      unidadBase: 'g',
      cantidad: '1',
      unidadCapturada: 'kg',
      equivalencia: '1000',
      total: '25.00',
    } as const;
    const sal = await comprar({ ...base, nombre: 'Sal' });
    const azucar = await comprar({ ...base, nombre: 'Azúcar' });
    expect((await insumoDe(sal)).costo_exacto_dmc).toBe(25_000n);

    const atole = await sembrarProducto(negocio, sucursal.almacenId, {
      nombre: 'Atole',
      precioCentavos: 3_000n,
      existencia: '0',
    });
    exigirOk(
      await comando(guardarReceta, {
        entrada: {
          productoId: atole.productoId,
          ingredientes: [
            { insumoId: sal, cantidad: '1', unidad: 'g', mermaBp: 0 },
            { insumoId: azucar, cantidad: '1', unidad: 'g', mermaBp: 0 },
          ],
        },
        ambito: ambito(),
        idempotencyKey: clave(),
      }),
      'inventario.guardar_receta',
    );
    const producto = await obtenerDb()
      .selectFrom('productos')
      .select('costo_unitario_centavos')
      .where('id', '=', atole.productoId)
      .executeTakeFirstOrThrow();
    expect(producto.costo_unitario_centavos).toBe(5n);
  });
});

describe('(c) dos compras del mismo insumo a precios distintos', () => {
  it('el costo es el promedio PONDERADO sobre el exacto y el valor es lo comprado (≤ 1 ¢)', async () => {
    // 10 kg a $250.00 (2.5 ¢/g) y 5 kg a $150.00 (3.0 ¢/g).
    const harina = await comprar({
      nombre: 'Harina',
      unidadBase: 'g',
      cantidad: '10',
      unidadCapturada: 'kg',
      equivalencia: '1000',
      total: '250.00',
    });
    expect(await insumoDe(harina)).toEqual({
      costo_unitario_centavos: 3n,
      costo_exacto_dmc: 25_000n,
    });
    await comprarMas(harina, '5', 'kg', '1000', '150.00');

    // (10 000 g × 2.5 + 15 000 ¢) / 15 000 g = 2.666… ¢/g → 26 667 diezmilésimas. SIN ponderar
    // saldría (2.5 + 3.0) / 2 = 2.75 ¢/g: 27 500.
    const insumo = await insumoDe(harina);
    expect(insumo.costo_exacto_dmc).toBe(26_667n);
    expect(insumo.costo_unitario_centavos).toBe(3n);

    // Lo comprado fueron 40 000 ¢. 15 000 g × 2.6667 = 40 000.5 → 40 001: una diezmilésima de centavo
    // por gramo, redondeada, son a lo más Q/20 000 ¢ (Q = 15 000 g) más el medio centavo del final.
    const enLaVista = await valorEnLaVista([harina]);
    expect(enLaVista).toBe(40_001n);
    expect(enLaVista - 40_000n <= 1n).toBe(true);
    const valuacion = await valuar();
    expect(valorDeLaLinea(valuacion.lineas, harina)).toBe(40_001n);
  });
});

describe('(e) una existencia en negativo vale cero', () => {
  async function insumoConExistencia(existencia: string, exactoDmc: bigint): Promise<string> {
    const db = obtenerDb();
    const id = randomUUID();
    await db
      .insertInto('insumos')
      .values({
        id,
        organizacion_id: negocio.organizacionId,
        nombre: `Crema ${id.slice(0, 6)}`,
        unidad_base: 'g',
        costo_exacto_dmc: exactoDmc,
      })
      .execute();
    await db
      .insertInto('existencias')
      .values({
        organizacion_id: negocio.organizacionId,
        almacen_id: sucursal.almacenId,
        insumo_id: id,
        cantidad: existencia,
      })
      .execute();
    return id;
  }

  it('ni la vista ni la valuación lo restan del total (DP-D146)', async () => {
    const crema = await insumoConExistencia('-500', 24_000n);
    const queso = await insumoConExistencia('100', 24_000n);

    expect(await valorEnLaVista([crema])).toBe(0n);
    expect(await valorEnLaVista([queso])).toBe(240n);

    const valuacion = await valuar();
    expect(valorDeLaLinea(valuacion.lineas, crema)).toBe(0n);
    expect(valorDeLaLinea(valuacion.lineas, queso)).toBe(240n);
  });

  it('una compra sobre una existencia negativa pondera contra cero: el costo es el de la compra', async () => {
    const jamon = await insumoConExistencia('-500', 30_000n);
    // 1 000 g a $50.00 = 5 ¢/g. La deuda con el conteo (−500 g) no tiene costo: no entra al promedio.
    await comprarMas(jamon, '1', 'kg', '1000', '50.00');

    expect((await insumoDe(jamon)).costo_exacto_dmc).toBe(50_000n);
    // Quedan 500 g a 5 ¢.
    expect(await valorEnLaVista([jamon])).toBe(2_500n);
  });
});

describe('(d) el ajuste y el inventario inicial copian el costo exacto al kardex', () => {
  it('100 g de leche a 2.4 ¢ valen 240 ¢ en el kardex, no 200', async () => {
    const leche = await comprar({
      nombre: 'Leche',
      unidadBase: 'ml',
      cantidad: '20',
      unidadCapturada: 'l',
      equivalencia: '1000',
      total: '480.00',
    });
    exigirOk(
      await comando(inventarioInicial, {
        entrada: { almacenId: sucursal.almacenId, insumoId: leche, cantidad: '100' },
        ambito: ambito(),
        idempotencyKey: clave(),
      }),
      'inventario.inicial',
    );
    exigirOk(
      await comando(ajustarStock, {
        entrada: {
          almacenId: sucursal.almacenId,
          insumoId: leche,
          cantidad: '-100',
          motivo: 'ajuste_conteo',
          nota: 'Conteo',
        },
        ambito: ambito(),
        idempotencyKey: clave(),
      }),
      'inventario.ajustar',
    );
    const { rows } = await sql<{ tipo: string; importe: string }>`
      select tipo, importe_centavos::text as importe
        from kardex
       where organizacion_id = ${negocio.organizacionId} and insumo_id = ${leche}
         and tipo in ('inventario_inicial', 'ajuste')
       order by created_at, movimiento_id
    `.execute(obtenerDb());
    expect(rows).toEqual([
      { tipo: 'inventario_inicial', importe: '240' },
      { tipo: 'ajuste', importe: '-240' },
    ]);
  });
});

describe('(d) merma y consumo valen cantidad × costo exacto', () => {
  it('el consumo de una venta, la merma «Por cancelación» y el kardex usan 2.4 ¢/g, no 2', async () => {
    const salon = await sembrarSalon({
      nombre: 'Fonda de la merma exacta',
      mesas: 2,
      terminales: 1,
    });
    const [sesion] = await abrirLasCajas(salon);
    const db = obtenerDb();
    // 2.4 ¢ el gramo de arrachera: 24 000 diezmilésimas. El redondeado (2) lo deriva la base.
    await db
      .updateTable('insumos')
      .set({ costo_exacto_dmc: 24_000n })
      .where('id', '=', salon.insumos.arrachera)
      .execute();
    expect(await insumoDe(salon.insumos.arrachera)).toEqual({
      costo_unitario_centavos: 2n,
      costo_exacto_dmc: 24_000n,
    });

    // Una arrachera vendida: 280 g × 2.4 = 672 ¢ (con 2 serían 560).
    const vendida = await sentarYPedir(salon, 0, [{ platillo: 'arrachera', cantidad: '1' }]);
    exigirOk(
      await cobrarExacto(ambitoDeCaja(salon), vendida.ordenId, Number(PRECIO_ARRACHERA)),
      'venta.cobrar',
    );
    const consumidos = await conTransaccion((tx) =>
      insumosConsumidos(tx, salon.negocio.organizacionId, sesion ?? ''),
    );
    const arracheraVendida = consumidos.find((c) => c.nombre.includes('arrachera'));
    expect(arracheraVendida).toMatchObject({ cantidad: '280', costoCentavos: '672' });

    // Una arrachera cancelada ya lista: la merma vale lo mismo.
    const cancelada = await sentarYPedir(salon, 1, [{ platillo: 'arrachera', cantidad: '1' }]);
    const linea = (await lineasDe(cancelada.ordenId)).get('Arrachera al carbón')?.[0] ?? '';
    const item = await db
      .selectFrom('comanda_items')
      .select(['id', 'comanda_id'])
      .where('orden_linea_id', '=', linea)
      .executeTakeFirstOrThrow();
    exigirOk(
      await comando(transicionarPedido, {
        entrada: { comandaId: item.comanda_id, comandaItemId: item.id, estado: 'listo' },
        ambito: ambitoDeCaja(salon),
        idempotencyKey: clave(),
      }),
      'restaurante.transicionar_pedido',
    );
    exigirOk(
      await comando(cancelarOrden, {
        entrada: { ordenId: cancelada.ordenId, motivo: 'Se fueron sin pagar' },
        ambito: ambitoDeCaja(salon),
        idempotencyKey: clave(),
      }),
      'restaurante.cancelar_orden',
    );
    const salidas = await conTransaccion((tx) =>
      salidasSinVenta(tx, salon.negocio.organizacionId, {
        sesionId: sesion ?? '',
        sucursalId: salon.sucursal.sucursalId,
        abreId: '00000000-0000-4000-8000-000000000000',
        cierraElDia: true,
        desde: new Date(Date.now() - 3_600_000),
        hasta: new Date(Date.now() + 60_000),
      }),
    );
    expect(salidas.find((s) => s.nombre.includes('arrachera'))).toMatchObject({
      tipo: 'merma',
      cantidad: '280',
      costoCentavos: '672',
    });

    // El kardex: el valor del movimiento es cantidad × costo exacto, con signo de salida.
    const { rows } = await sql<{ tipo: string; importe: string }>`
      select tipo, importe_centavos::text as importe
        from kardex
       where organizacion_id = ${salon.negocio.organizacionId} and insumo_id = ${salon.insumos.arrachera}
       order by created_at, movimiento_id
    `.execute(db);
    expect(rows.filter((r) => r.tipo === 'merma').map((r) => r.importe)).toEqual(['-672']);
    expect(rows.filter((r) => r.tipo === 'salida_venta').map((r) => r.importe)).toEqual(['-672']);

    // La vista «consumido hoy» de las ventas: lo mismo, cantidad × costo exacto.
    const consumido = await sql<{ costo: string }>`
      select costo_total_descontado::text as costo
        from descuentos_inventario_venta
       where organizacion_id = ${salon.negocio.organizacionId} and ingrediente_id = ${salon.insumos.arrachera}
    `.execute(db);
    expect(consumido.rows.map((r) => r.costo)).toEqual(['672']);
  });
});
