import { obtenerDb } from '@morphiqpos/data';
import { beforeAll, describe, expect, it } from 'vitest';
import type { z } from 'zod';

import { hojaDelCorte } from '../caja/corte/documento.ts';
import { comando } from '../produccion.ts';
import { clave, exigirOk } from '../pruebas/negocio-real.ts';
import { ticketDeOrden } from '../venta/consultas.ts';
import { abrirMesa } from './mesas.ts';
import { unirMesasComando } from './union-de-mesas.ts';
import { entradaEnviarPedido } from './esquemas.ts';
import { armarParaLlevar } from './para-llevar.ts';
import { enviarPedido } from './pedido.ts';
import {
  abrirLasCajas,
  ambitoDeCaja,
  cobrar,
  dividirEn,
  mesaDe,
  ordenPersistida,
  PRECIO_ARRACHERA,
  PRECIO_GUACAMOLE,
  pedirLaCuenta,
  sembrarSalon,
  sumaDeLosPagos,
  type Salon,
} from './pruebas/salon-real.ts';

/**
 * DP-16 · LA MATRIZ DE LAS OPCIONES CON PRECIO, contra Postgres y al centavo.
 *
 * Una opción única con precio, una múltiple (una que suma y otra que resta), dos grupos en el mismo
 * platillo, la barbacoa por peso con su opción y una nota larga, para llevar, y una cuenta dividida
 * con opciones. En cada caso: la línea guarda el precio con opciones, la instantánea y el firmado;
 * el ticket dice cada opción con su precio; el cobro y el corte cuadran al centavo.
 */

const KILO = 79_500n;
let salon: Salon;
let sesion = '';
let barbacoa = '';
const g: Record<string, string> = {};
const o: Record<string, string> = {};
const caja = () => ambitoDeCaja(salon);

async function grupo(
  clave: string,
  nombre: string,
  tipo: 'unica' | 'multiple',
  opciones: readonly (readonly [string, bigint])[],
  productos: readonly string[],
  extra: { obligatorio?: boolean; minimo?: number; maximo?: number } = {},
) {
  const db = obtenerDb();
  const org = salon.negocio.organizacionId;
  const fila = await db
    .insertInto('modificadores')
    .values({
      organizacion_id: org,
      nombre,
      tipo,
      obligatorio: extra.obligatorio ?? false,
      minimo_elecciones: extra.minimo ?? null,
      maximo_elecciones: extra.maximo ?? null,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  g[clave] = fila.id;
  for (const [i, [nombreOpcion, delta]] of opciones.entries()) {
    const op = await db
      .insertInto('modificador_opciones')
      .values({
        modificador_id: fila.id,
        nombre: nombreOpcion,
        orden: i,
        delta_precio_centavos: delta,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    o[nombreOpcion] = op.id;
  }
  for (const [i, productoId] of productos.entries()) {
    await db
      .insertInto('producto_modificadores')
      .values({ organizacion_id: org, producto_id: productoId, modificador_id: fila.id, orden: i })
      .execute();
  }
}

async function pedirEnMesa(indice: number, lineas: z.input<typeof entradaEnviarPedido>['lineas']) {
  const { ordenId } = exigirOk(
    await comando(abrirMesa, {
      entrada: { mesaId: mesaDe(salon, indice), personas: 2 },
      ambito: caja(),
      idempotencyKey: clave(),
    }),
    'restaurante.abrir_mesa',
  );
  exigirOk(
    await comando(enviarPedido, {
      entrada: { ordenId, lineas },
      ambito: caja(),
      idempotencyKey: clave(),
    }),
    'restaurante.enviar_pedido',
  );
  return ordenId;
}

async function lineas(ordenId: string) {
  return obtenerDb()
    .selectFrom('orden_lineas')
    .select(['id', 'producto_nombre', 'subtotal_centavos', 'precio_unitario_centavos', 'opciones'])
    .where('orden_id', '=', ordenId)
    .orderBy('orden_visual')
    .execute();
}

async function cobrarTodo(ordenId: string): Promise<bigint> {
  const total = (await ordenPersistida(ordenId)).total_centavos;
  exigirOk(
    await cobrar(caja(), ordenId, Number(total), [
      { metodo: 'efectivo', montoCentavos: Number(total) },
    ]),
    'venta.cobrar',
  );
  expect(await sumaDeLosPagos([ordenId])).toBe(total);
  return total;
}

async function ticket(ordenId: string) {
  return exigirOk(
    await comando(ticketDeOrden, { entrada: { ordenId }, ambito: caja(), idempotencyKey: clave() }),
    'venta.ticket',
  );
}

beforeAll(async () => {
  salon = await sembrarSalon({ nombre: 'Opciones con precio', mesas: 8, terminales: 1 });
  [sesion = ''] = await abrirLasCajas(salon, 50_000);
  const fila = await obtenerDb()
    .insertInto('productos')
    .values({
      organizacion_id: salon.negocio.organizacionId,
      nombre: 'Barbacoa de horno',
      precio_venta_centavos: KILO,
      tipo_venta: 'variable_medida',
      unidad_venta: 'kg',
      unidad_variable: 'kg',
      precio_por_unidad_variable_centavos: KILO,
      estrategia_consumo: 'ninguno',
      area_preparacion: 'cocina',
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  barbacoa = fila.id;
  await grupo(
    'totopos',
    'Totopos',
    'unica',
    [
      ['Normales', 0n],
      ['Con queso', 1_500n],
    ],
    [salon.platillos.guacamole],
    { obligatorio: true },
  );
  await grupo(
    'extras',
    'Extras',
    'multiple',
    [
      ['Queso extra', 2_000n],
      ['Sin cebolla', -500n],
      ['Aguacate', 2_500n],
    ],
    [salon.platillos.arrachera],
    { maximo: 2 },
  );
  await grupo(
    'termino',
    'Término',
    'unica',
    [
      ['Término medio', 0n],
      ['Bien cocida', 0n],
    ],
    [salon.platillos.arrachera],
  );
  await grupo(
    'tortillas',
    'Tortillas',
    'unica',
    [
      ['Maíz', 0n],
      ['Harina', 2_000n],
    ],
    [barbacoa],
    { obligatorio: true },
  );
});

describe('DP-16 · las opciones con precio, de la mesa al corte', () => {
  it('única con precio: el guacamole con queso cuesta $15 más, y el ticket lo dice', async () => {
    const ordenId = await pedirEnMesa(0, [
      {
        productoId: salon.platillos.guacamole,
        cantidad: '1',
        opciones: [{ grupoId: g['totopos'] ?? '', opcionIds: [o['Con queso'] ?? ''] }],
      },
    ]);
    const [linea] = await lineas(ordenId);
    expect(linea?.subtotal_centavos).toBe(PRECIO_GUACAMOLE + 1_500n);
    const delta = await obtenerDb()
      .selectFrom('orden_linea_modificadores')
      .select(['precio_extra_centavos', 'delta_precio_centavos'])
      .where('orden_linea_id', '=', linea?.id ?? '')
      .executeTakeFirstOrThrow();
    expect(delta).toEqual({ precio_extra_centavos: 1_500n, delta_precio_centavos: 1_500n });
    await pedirLaCuenta(salon, ordenId);
    expect(await cobrarTodo(ordenId)).toBe(PRECIO_GUACAMOLE + 1_500n);
    expect((await ticket(ordenId)).lineas[0]?.opciones).toBe('Totopos: Con queso (+$15.00)');
  });

  it('múltiple y dos grupos: 2 arracheras con queso (+$20) y sin cebolla (−$5), término medio', async () => {
    const ordenId = await pedirEnMesa(1, [
      {
        productoId: salon.platillos.arrachera,
        cantidad: '2',
        opciones: [
          {
            grupoId: g['extras'] ?? '',
            opcionIds: [o['Queso extra'] ?? '', o['Sin cebolla'] ?? ''],
          },
          { grupoId: g['termino'] ?? '', opcionIds: [o['Término medio'] ?? ''] },
        ],
      },
    ]);
    const [linea] = await lineas(ordenId);
    // Por unidad: (329.90 + 20 − 5) × 2.
    expect(linea?.precio_unitario_centavos).toBe(PRECIO_ARRACHERA + 1_500n);
    expect(linea?.subtotal_centavos).toBe((PRECIO_ARRACHERA + 1_500n) * 2n);
    const firmados = await obtenerDb()
      .selectFrom('orden_linea_modificadores')
      .select(['opcion_nombre', 'precio_extra_centavos', 'delta_precio_centavos'])
      .where('orden_linea_id', '=', linea?.id ?? '')
      .orderBy('opcion_nombre')
      .execute();
    expect(firmados.find((f) => f.opcion_nombre === 'Sin cebolla')).toMatchObject({
      precio_extra_centavos: 0n,
      delta_precio_centavos: -500n,
    });
    await pedirLaCuenta(salon, ordenId);
    await cobrarTodo(ordenId);
    expect((await ticket(ordenId)).lineas[0]?.opciones).toContain('Sin cebolla (−$5.00)');
  });

  it('más opciones que el máximo del grupo no entran', async () => {
    const { ordenId } = exigirOk(
      await comando(abrirMesa, {
        entrada: { mesaId: mesaDe(salon, 2), personas: 2 },
        ambito: caja(),
        idempotencyKey: clave(),
      }),
      'restaurante.abrir_mesa',
    );
    const r = await comando(enviarPedido, {
      entrada: {
        ordenId,
        lineas: [
          {
            productoId: salon.platillos.arrachera,
            cantidad: '1',
            opciones: [
              {
                grupoId: g['extras'] ?? '',
                opcionIds: [o['Queso extra'] ?? '', o['Sin cebolla'] ?? '', o['Aguacate'] ?? ''],
              },
            ],
          },
        ],
      },
      ambito: caja(),
      idempotencyKey: clave(),
    });
    expect(r.ok).toBe(false);
  });

  it('barbacoa ½ kg con tortillas de harina (+$20 por renglón) y una nota larga, para llevar', async () => {
    const nota = 'Bien dorada, sin cebolla, con su consomé aparte, '.repeat(5).slice(0, 280);
    const { ordenId, totalCentavos } = exigirOk(
      await comando(armarParaLlevar, {
        entrada: {
          nombrePedido: 'Lupita',
          lineas: [
            {
              productoId: barbacoa,
              cantidad: '0.5',
              unidad: 'kg',
              notas: nota,
              opciones: [{ grupoId: g['tortillas'] ?? '', opcionIds: [o['Harina'] ?? ''] }],
            },
          ],
        },
        ambito: caja(),
        idempotencyKey: clave(),
      }),
      'restaurante.armar_para_llevar',
    );
    expect(totalCentavos).toBe(String(KILO / 2n + 2_000n));
    expect(await cobrarTodo(ordenId)).toBe(KILO / 2n + 2_000n);
    const t = await ticket(ordenId);
    expect(t.paraLlevar).toMatchObject({ nombre: 'Lupita' });
    expect(t.lineas[0]?.opciones).toBe('Tortillas: Harina (+$20.00)');
    const comandas = await obtenerDb()
      .selectFrom('comandas')
      .select('id')
      .where('orden_id', '=', ordenId)
      .execute();
    expect(comandas).toHaveLength(1);
  });

  it('dividir una cuenta con opciones: las partes suman el total al centavo', async () => {
    const ordenId = await pedirEnMesa(3, [
      {
        productoId: salon.platillos.guacamole,
        cantidad: '1',
        opciones: [{ grupoId: g['totopos'] ?? '', opcionIds: [o['Con queso'] ?? ''] }],
      },
      {
        productoId: salon.platillos.arrachera,
        cantidad: '2',
        opciones: [{ grupoId: g['extras'] ?? '', opcionIds: [o['Aguacate'] ?? ''] }],
      },
    ]);
    const total = (await ordenPersistida(ordenId)).total_centavos;
    expect(total).toBe(PRECIO_GUACAMOLE + 1_500n + (PRECIO_ARRACHERA + 2_500n) * 2n);
    await pedirLaCuenta(salon, ordenId);
    const division = await dividirEn(salon, ordenId, [
      [
        { platillo: 'guacamole', cantidad: 1 },
        { platillo: 'arrachera', cantidad: 1 },
      ],
      [{ platillo: 'arrachera', cantidad: 1 }],
    ]);
    let cobrado = 0n;
    for (const hija of division.hijas) {
      cobrado += await cobrarTodo(hija.ordenId);
      // Cada parte con arrachera conserva su opción y su precio en el ticket.
      const deArrachera = (await ticket(hija.ordenId)).lineas.find((l) =>
        l.nombre.startsWith('Arrachera'),
      );
      expect(deArrachera?.opciones).toBe('Extras: Aguacate (+$25.00)');
    }
    expect(cobrado).toBe(total);
  });

  it('lo que va por peso «sólo en presentaciones» no acepta otra cantidad', async () => {
    const fija = await obtenerDb()
      .insertInto('productos')
      .values({
        organizacion_id: salon.negocio.organizacionId,
        nombre: 'Barbacoa por presentación',
        precio_venta_centavos: KILO,
        tipo_venta: 'variable_medida',
        unidad_venta: 'kg',
        unidad_variable: 'kg',
        precio_por_unidad_variable_centavos: KILO,
        estrategia_consumo: 'ninguno',
        area_preparacion: 'cocina',
        presets_variable: JSON.stringify([0.25, 0.5, 1]),
        solo_presets_variable: true,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    const { ordenId } = exigirOk(
      await comando(abrirMesa, {
        entrada: { mesaId: mesaDe(salon, 4), personas: 2 },
        ambito: caja(),
        idempotencyKey: clave(),
      }),
      'restaurante.abrir_mesa',
    );
    const libre = await comando(enviarPedido, {
      entrada: { ordenId, lineas: [{ productoId: fija.id, cantidad: '0.3', unidad: 'kg' }] },
      ambito: caja(),
      idempotencyKey: clave(),
    });
    expect(libre.ok).toBe(false);
    exigirOk(
      await comando(enviarPedido, {
        entrada: { ordenId, lineas: [{ productoId: fija.id, cantidad: '0.5', unidad: 'kg' }] },
        ambito: caja(),
        idempotencyKey: clave(),
      }),
      'restaurante.enviar_pedido',
    );
  });

  it('mesa unida: las opciones de las dos cuentas viajan a la principal y se cobran', async () => {
    const principal = await pedirEnMesa(5, [
      {
        productoId: salon.platillos.arrachera,
        cantidad: '1',
        opciones: [{ grupoId: g['extras'] ?? '', opcionIds: [o['Queso extra'] ?? ''] }],
      },
    ]);
    await pedirEnMesa(6, [
      {
        productoId: salon.platillos.guacamole,
        cantidad: '1',
        opciones: [{ grupoId: g['totopos'] ?? '', opcionIds: [o['Con queso'] ?? ''] }],
      },
    ]);
    const union = exigirOk(
      await comando(unirMesasComando, {
        entrada: { mesaPrincipalId: mesaDe(salon, 5), mesaIds: [mesaDe(salon, 6)] },
        ambito: caja(),
        idempotencyKey: clave(),
      }),
      'restaurante.unir_mesas',
    );
    expect(union.ordenPrincipalId).toBe(principal);
    const esperado = PRECIO_ARRACHERA + 2_000n + PRECIO_GUACAMOLE + 1_500n;
    expect(union.totalCentavos).toBe(esperado.toString());
    await pedirLaCuenta(salon, principal);
    expect(await cobrarTodo(principal)).toBe(esperado);
    const opciones = (await ticket(principal)).lineas.map((l) => l.opciones);
    expect(opciones).toEqual(
      expect.arrayContaining(['Extras: Queso extra (+$20.00)', 'Totopos: Con queso (+$15.00)']),
    );
  });

  it('el corte de la caja cuadra con todo lo cobrado, al centavo', async () => {
    const hoja = exigirOk(
      await comando(hojaDelCorte, {
        entrada: { sesionCajaId: sesion },
        ambito: caja(),
        idempotencyKey: clave(),
      }),
      'caja.hoja_del_corte',
    );
    const suma = hoja.ventas.reduce((s, v) => s + BigInt(v.totalCentavos), 0n);
    expect(suma.toString()).toBe(hoja.resumen.totalCentavos);
    const pagos = await obtenerDb()
      .selectFrom('pagos')
      .select((eb) => eb.fn.sum<string>('monto_centavos').as('total'))
      .where('sesion_caja_id', '=', sesion)
      .executeTakeFirstOrThrow();
    expect(pagos.total).toBe(hoja.resumen.totalCentavos);

    // «Opciones vendidas»: cuántas veces salió cada una y cuánto sumó (por pieza; lo que va por
    // peso, una vez por renglón). La división reparte la opción entre las partes sin perderla.
    const porOpcion = new Map(
      hoja.opciones.map((op) => [`${op.grupo} · ${op.opcion}`, [op.veces, op.importeCentavos]]),
    );
    expect(porOpcion.get('Totopos · Con queso')).toEqual(['3', '4500']);
    expect(porOpcion.get('Extras · Queso extra')).toEqual(['3', '6000']);
    expect(porOpcion.get('Extras · Sin cebolla')).toEqual(['2', '-1000']);
    expect(porOpcion.get('Extras · Aguacate')).toEqual(['2', '5000']);
    expect(porOpcion.get('Tortillas · Harina')).toEqual(['1', '2000']);
    expect(porOpcion.get('Término · Término medio')).toEqual(['2', '0']);
    // Lo que más sumó, primero.
    expect(hoja.opciones[0]).toMatchObject({ grupo: 'Extras', opcion: 'Queso extra' });
  });
});
