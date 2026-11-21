import { randomUUID } from 'node:crypto';

import { conTransaccion, obtenerDb, repoCaja } from '@morphiqpos/data';
import { sql } from 'kysely';
import { beforeAll, describe, expect, it } from 'vitest';

import { ventasPorMetodo } from '../caja/corte/consultas.ts';
import { ejecutarComandoPublico } from '../portal/comando-publico.ts';
import { pedirCuentaQR } from '../portal/cuenta.ts';
import { enviarPedidoDesdeQR } from '../portal/pedido.ts';
import { comando } from '../produccion.ts';
import { fijarPropina } from '../propinas/fijar-propina.ts';
import {
  abrirCajaReal,
  ambitoDe,
  clave,
  exigirOk,
  sembrarNegocio,
  sembrarProducto,
  sembrarSucursal,
  type NegocioReal,
} from '../pruebas/negocio-real.ts';
import { abrirMesa } from '../restaurante/mesas.ts';
import { rotarQr } from '../restaurante/qr.ts';
import { cobrarOrden } from './cobrar.ts';

/**
 * DP-24 · LA TARJETA DE COBRO NUEVA, contra Postgres: cada caso de dinero del encargo.
 *
 * La pantalla hace su cuenta en `apps/web/src/venta/cuenta-del-cobro.ts` (con sus pruebas); aquí
 * viajan a `venta.cobrar` los MISMOS renglones que esa cuenta arma y se mira lo persistido: los
 * pagos uno por uno, el cajón, el corte por método, el resumen del ticket y cómo quedó escrita la
 * propina. Lo que la pantalla frena (un «Recibido» menor al total) también lo frena el servidor.
 */

const PIMIENTA = 'pimienta-de-la-tarjeta-de-cobro-0123456789';
const LARGO = 300_000;
const PLATO_CENTAVOS = 46_000;

let negocio: NegocioReal;
let ambito: ReturnType<typeof ambitoDe>;
let sucursalId: string;
let sesionCajaId: string;
let plato: string;
let siguienteMesa = 400;

beforeAll(async () => {
  negocio = await sembrarNegocio({
    nombre: 'Fonda de la tarjeta de cobro',
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
  await conTransaccion(async (tx) => {
    await tx
      .updateTable('productos')
      .set({ visible_en_menu_digital: true })
      .where('organizacion_id', '=', negocio.organizacionId)
      .execute();
    const banderas = {
      portal_qr_activo: true,
      portal_qr_permitir_pedidos_cliente: true,
      portal_qr_envia_a_cocina: 'comensales',
      portal_qr_comensales_abren_mesa: true,
      portal_qr_cuenta_modo: 'ambos',
    };
    await sql`
      insert into configuracion (organizacion_id, valores)
      values (${negocio.organizacionId}, ${JSON.stringify(banderas)}::jsonb)
      on conflict (organizacion_id)
      do update set valores = configuracion.valores || excluded.valores
    `.execute(tx);
  });
  sesionCajaId = await abrirCajaReal(ambito);
}, LARGO);

/** Una mesa nueva con su QR y `platos` barbacoas pedidas: cada caso, su cuenta. */
async function mesaConCuenta(
  platos = 1,
): Promise<{ token: string; ordenId: string; total: number }> {
  const mesaId = randomUUID();
  siguienteMesa += 1;
  const numero = siguienteMesa;
  await conTransaccion((tx) =>
    tx
      .insertInto('mesas')
      .values({
        id: mesaId,
        organizacion_id: negocio.organizacionId,
        sucursal_id: sucursalId,
        numero,
        nombre: `Mesa ${String(numero)}`,
      })
      .execute(),
  );
  exigirOk(
    await comando(abrirMesa, { entrada: { mesaId, personas: 2 }, ambito, idempotencyKey: clave() }),
    'restaurante.abrir_mesa',
  );
  const { qrToken } = exigirOk(
    await comando(rotarQr, { entrada: { mesaId }, ambito, idempotencyKey: clave() }),
    'restaurante.rotar_qr',
  );
  exigirOk(
    await ejecutarComandoPublico(enviarPedidoDesdeQR, {
      token: qrToken,
      organizacionId: negocio.organizacionId,
      entrada: { items: [{ productoId: plato, cantidad: String(platos) }] },
      idempotencyKey: clave(),
      pimienta: PIMIENTA,
    }),
    'portal.enviar_pedido',
  );
  const mesa = await obtenerDb()
    .selectFrom('mesas')
    .select('orden_activa_id')
    .where('id', '=', mesaId)
    .executeTakeFirstOrThrow();
  if (mesa.orden_activa_id === null) throw new Error('La mesa abierta no tiene orden.');
  return { token: qrToken, ordenId: mesa.orden_activa_id, total: PLATO_CENTAVOS * platos };
}

async function cuenta(ordenId: string) {
  return obtenerDb()
    .selectFrom('ordenes')
    .select([
      'estado',
      'version',
      'total_centavos',
      'propina_tipo',
      'propina_puntos_base',
      'propina_origen',
    ])
    .where('id', '=', ordenId)
    .executeTakeFirstOrThrow();
}

function pagosDe(ordenId: string) {
  return obtenerDb()
    .selectFrom('pagos')
    .select([
      'metodo',
      'monto_centavos',
      'propina_centavos',
      'recibido_centavos',
      'cambio_centavos',
    ])
    .where('orden_id', '=', ordenId)
    .orderBy('metodo')
    .orderBy('monto_centavos', 'desc')
    .execute();
}

function movimientosDe(ordenId: string) {
  return obtenerDb()
    .selectFrom('movimientos_caja')
    .select(['tipo', 'monto_centavos'])
    .where('referencia_tipo', '=', 'orden')
    .where('referencia_id', '=', ordenId)
    .orderBy('tipo')
    .execute();
}

function arqueo() {
  return repoCaja.arqueoDeSesion(obtenerDb(), negocio.organizacionId, sesionCajaId);
}

/** Un renglón de pago, como lo arma la tarjeta de cobro. */
interface Pago {
  readonly metodo: 'efectivo' | 'tarjeta' | 'transferencia';
  readonly montoCentavos: number;
  readonly propinaCentavos?: number;
  readonly recibidoCentavos?: number;
}

function cobrar(
  ordenId: string,
  total: number,
  pagos: readonly Pago[],
  propina: {
    readonly tipo: 'sin_propina' | 'porcentaje' | 'monto_manual';
    readonly puntosBase: number;
  },
  versionDeLaCuenta?: number,
) {
  return comando(cobrarOrden, {
    entrada: {
      ordenId,
      pagos: [...pagos],
      totalEsperadoCentavos: total,
      propinaTipo: propina.tipo,
      propinaPuntosBase: propina.puntosBase,
      propinaOrigen: 'caja',
      ...(versionDeLaCuenta === undefined ? {} : { versionDeLaCuenta }),
    },
    ambito,
    idempotencyKey: clave(),
  });
}

describe('la propina, elegida en la tarjeta', () => {
  it('por PORCENTAJE, en efectivo y con billete de más: cambio, cajón y propina en su sitio', async () => {
    const { ordenId, total } = await mesaConCuenta();
    const antes = await arqueo();
    // 10 % de $460.00 = $46.00; paga con $600.00.
    const cobrado = exigirOk(
      await cobrar(
        ordenId,
        total,
        [
          {
            metodo: 'efectivo',
            montoCentavos: 46_000,
            propinaCentavos: 4_600,
            recibidoCentavos: 60_000,
          },
        ],
        { tipo: 'porcentaje', puntosBase: 1000 },
      ),
      'venta.cobrar',
    );
    expect(cobrado.cambioCentavos).toBe('9400');
    expect(cobrado.propinaCentavos).toBe('4600');
    expect(await pagosDe(ordenId)).toEqual([
      {
        metodo: 'efectivo',
        monto_centavos: 46_000n,
        propina_centavos: 4_600n,
        recibido_centavos: 60_000n,
        cambio_centavos: 9_400n,
      },
    ]);
    expect(await movimientosDe(ordenId)).toEqual([
      { tipo: 'propina', monto_centavos: 4_600n },
      { tipo: 'venta', monto_centavos: 46_000n },
    ]);
    const despues = await arqueo();
    expect(despues.efectivoEsperadoCentavos - antes.efectivoEsperadoCentavos).toBe(50_600n);
    const orden = await cuenta(ordenId);
    expect([orden.estado, orden.total_centavos]).toEqual(['pagada', 46_000n]);
    expect([orden.propina_tipo, orden.propina_puntos_base, orden.propina_origen]).toEqual([
      'porcentaje',
      1000,
      'caja',
    ]);
  });

  it('por MONTO, con tarjeta: el importe exacto en el pago y «monto» en la cuenta', async () => {
    const { ordenId, total } = await mesaConCuenta();
    const antes = await arqueo();
    exigirOk(
      await cobrar(
        ordenId,
        total,
        [{ metodo: 'tarjeta', montoCentavos: 46_000, propinaCentavos: 3_700 }],
        { tipo: 'monto_manual', puntosBase: 804 },
      ),
      'venta.cobrar',
    );
    expect(await pagosDe(ordenId)).toEqual([
      {
        metodo: 'tarjeta',
        monto_centavos: 46_000n,
        propina_centavos: 3_700n,
        recibido_centavos: null,
        cambio_centavos: 0n,
      },
    ]);
    // Con tarjeta el cajón no se mueve.
    expect(await movimientosDe(ordenId)).toEqual([]);
    expect((await arqueo()).efectivoEsperadoCentavos).toBe(antes.efectivoEsperadoCentavos);
    const orden = await cuenta(ordenId);
    expect([orden.propina_tipo, orden.propina_puntos_base, orden.propina_origen]).toEqual([
      'monto_manual',
      804,
      'caja',
    ]);
  });

  it('LA DEL PORTAL, cambiada en la Caja: queda la de la Caja y el cobro con la versión vieja se rechaza', async () => {
    const { token, ordenId, total } = await mesaConCuenta();
    exigirOk(
      await ejecutarComandoPublico(pedirCuentaQR, {
        token,
        organizacionId: negocio.organizacionId,
        entrada: { propinaTipo: 'porcentaje', propinaPorcentaje: 10 },
        idempotencyKey: clave(),
        pimienta: PIMIENTA,
      }),
      'portal.pedir_cuenta',
    );
    const delPortal = await cuenta(ordenId);
    expect([
      delPortal.propina_tipo,
      delPortal.propina_puntos_base,
      delPortal.propina_origen,
    ]).toEqual(['porcentaje', 1000, 'portal_qr']);

    // La tarjeta la enseña ya puesta; la cajera toca 15 %: es un cambio a propósito.
    const fijada = exigirOk(
      await comando(fijarPropina, {
        entrada: {
          ordenId,
          version: delPortal.version,
          propinaTipo: 'porcentaje',
          propinaPuntosBase: 1500,
          cambiar: true,
        },
        ambito,
        idempotencyKey: clave(),
      }),
      'cuenta.fijar_propina',
    );
    expect(fijada.propinaOrigen).toBe('caja');
    expect(fijada.version).toBe(delPortal.version + 1);

    // Con la versión que tenía ANTES de cambiarla: se rechaza con la vigente y no se paga.
    const viejo = await cobrar(
      ordenId,
      total,
      [{ metodo: 'tarjeta', montoCentavos: 46_000, propinaCentavos: 4_600 }],
      { tipo: 'porcentaje', puntosBase: 1000 },
      delPortal.version,
    );
    expect(viejo.ok).toBe(false);
    if (!viejo.ok) {
      expect(viejo.error.codigo).toBe('CONFLICTO_ESTADO');
      expect(viejo.error.datos).toMatchObject({
        regla: 'PROPINA_VIGENTE',
        propinaPuntosBase: 1500,
      });
    }
    expect((await cuenta(ordenId)).estado).not.toBe('pagada');
    expect(await pagosDe(ordenId)).toEqual([]);

    // Con la vigente: 15 % de $460.00 = $69.00.
    exigirOk(
      await cobrar(
        ordenId,
        total,
        [{ metodo: 'tarjeta', montoCentavos: 46_000, propinaCentavos: 6_900 }],
        { tipo: 'porcentaje', puntosBase: 1500 },
        fijada.version,
      ),
      'venta.cobrar',
    );
    const pagada = await cuenta(ordenId);
    expect([pagada.estado, pagada.propina_puntos_base, pagada.propina_origen]).toEqual([
      'pagada',
      1500,
      'caja',
    ]);
  });
});

describe('el efectivo', () => {
  it('EL CAMBIO CONVERTIDO EN PROPINA: no se devuelve nada y todo el billete queda en el cajón', async () => {
    const { ordenId, total } = await mesaConCuenta();
    const antes = await arqueo();
    // $460.00 + 10 % ($46.00) = $506.00; entrega $600.00 y deja los $94.00 de cambio: propina $140.00.
    const cobrado = exigirOk(
      await cobrar(
        ordenId,
        total,
        [
          {
            metodo: 'efectivo',
            montoCentavos: 46_000,
            propinaCentavos: 14_000,
            recibidoCentavos: 60_000,
          },
        ],
        { tipo: 'monto_manual', puntosBase: 3043 },
      ),
      'venta.cobrar',
    );
    expect(cobrado.cambioCentavos).toBe('0');
    expect(cobrado.propinaCentavos).toBe('14000');
    expect(await movimientosDe(ordenId)).toEqual([
      { tipo: 'propina', monto_centavos: 14_000n },
      { tipo: 'venta', monto_centavos: 46_000n },
    ]);
    expect((await arqueo()).efectivoEsperadoCentavos - antes.efectivoEsperadoCentavos).toBe(
      60_000n,
    );
    const orden = await cuenta(ordenId);
    // La venta no se infla con la propina.
    expect([orden.total_centavos, orden.propina_tipo]).toEqual([46_000n, 'monto_manual']);
  });

  it('RECIBIDO MENOR AL TOTAL: el servidor no lo cobra como exacto; no queda nada escrito', async () => {
    const { ordenId, total } = await mesaConCuenta();
    const antes = await arqueo();
    const corto = await cobrar(
      ordenId,
      total,
      [{ metodo: 'efectivo', montoCentavos: 46_000, recibidoCentavos: 40_000 }],
      { tipo: 'sin_propina', puntosBase: 0 },
    );
    expect(corto.ok).toBe(false);
    if (!corto.ok) {
      expect(corto.error.datos).toMatchObject({ regla: 'EFECTIVO_INSUFICIENTE' });
    }
    // Y si alcanza para la venta pero no para la propina, tampoco.
    const sinPropina = await cobrar(
      ordenId,
      total,
      [
        {
          metodo: 'efectivo',
          montoCentavos: 46_000,
          propinaCentavos: 4_600,
          recibidoCentavos: 50_000,
        },
      ],
      { tipo: 'porcentaje', puntosBase: 1000 },
    );
    expect(sinPropina.ok).toBe(false);
    expect((await cuenta(ordenId)).estado).not.toBe('pagada');
    expect(await pagosDe(ordenId)).toEqual([]);
    expect(await movimientosDe(ordenId)).toEqual([]);
    expect((await arqueo()).efectivoEsperadoCentavos).toBe(antes.efectivoEsperadoCentavos);
  });
});

describe('varias tarjetas', () => {
  it('TRES TARJETAS MÁS EFECTIVO: cada pago por separado, el corte cuadra y el ticket dice una sola «Tarjeta»', async () => {
    // Dos platos: $920.00 + 10 % ($92.00) = $1,012.00. Tarjetas $400, $300 y $200; el resto ($112) en efectivo.
    const { ordenId, total } = await mesaConCuenta(2);
    const antes = await arqueo();
    const metodosAntes = await conTransaccion((tx) =>
      ventasPorMetodo(tx, negocio.organizacionId, sesionCajaId),
    );
    const cobrado = exigirOk(
      await cobrar(
        ordenId,
        total,
        [
          // La propina sale primero del efectivo: $20.00 de venta y $92.00 de propina, con billete de $200.
          {
            metodo: 'efectivo',
            montoCentavos: 2_000,
            propinaCentavos: 9_200,
            recibidoCentavos: 20_000,
          },
          { metodo: 'tarjeta', montoCentavos: 40_000 },
          { metodo: 'tarjeta', montoCentavos: 30_000 },
          { metodo: 'tarjeta', montoCentavos: 20_000 },
        ],
        { tipo: 'porcentaje', puntosBase: 1000 },
      ),
      'venta.cobrar',
    );
    expect(cobrado.cambioCentavos).toBe('8800');
    expect(cobrado.pagadoCentavos).toBe('92000');

    // Registros y el corte: cada pago es su renglón.
    expect(await pagosDe(ordenId)).toEqual([
      {
        metodo: 'efectivo',
        monto_centavos: 2_000n,
        propina_centavos: 9_200n,
        recibido_centavos: 20_000n,
        cambio_centavos: 8_800n,
      },
      {
        metodo: 'tarjeta',
        monto_centavos: 40_000n,
        propina_centavos: 0n,
        recibido_centavos: null,
        cambio_centavos: 0n,
      },
      {
        metodo: 'tarjeta',
        monto_centavos: 30_000n,
        propina_centavos: 0n,
        recibido_centavos: null,
        cambio_centavos: 0n,
      },
      {
        metodo: 'tarjeta',
        monto_centavos: 20_000n,
        propina_centavos: 0n,
        recibido_centavos: null,
        cambio_centavos: 0n,
      },
    ]);

    // El corte por método: la tarjeta suma las tres y dice que fueron tres pagos.
    const metodosDespues = await conTransaccion((tx) =>
      ventasPorMetodo(tx, negocio.organizacionId, sesionCajaId),
    );
    const de = (lista: typeof metodosDespues, metodo: string) =>
      lista.find((m) => m.metodo === metodo) ?? {
        ventasCentavos: '0',
        propinasCentavos: '0',
        pagos: 0,
      };
    expect(
      Number(de(metodosDespues, 'tarjeta').ventasCentavos) -
        Number(de(metodosAntes, 'tarjeta').ventasCentavos),
    ).toBe(90_000);
    expect(de(metodosDespues, 'tarjeta').pagos - de(metodosAntes, 'tarjeta').pagos).toBe(3);
    expect(
      Number(de(metodosDespues, 'efectivo').ventasCentavos) -
        Number(de(metodosAntes, 'efectivo').ventasCentavos),
    ).toBe(2_000);
    expect(
      Number(de(metodosDespues, 'efectivo').propinasCentavos) -
        Number(de(metodosAntes, 'efectivo').propinasCentavos),
    ).toBe(9_200);

    // El cajón: sólo el efectivo (venta y propina). Y es UNA venta, aunque sean cuatro pagos.
    const despues = await arqueo();
    expect(despues.efectivoEsperadoCentavos - antes.efectivoEsperadoCentavos).toBe(11_200n);
    expect(despues.ventasCentavos - antes.ventasCentavos).toBe(92_000n);
    expect(despues.numeroVentas - antes.numeroVentas).toBe(1);

    // El ticket lee este resumen: UNA sola cifra de tarjeta, con la suma.
    // (La vista no está en los tipos generados: se lee con SQL.)
    const { rows } = await sql<{
      metodo_pago: string;
      tarjeta: string;
      efectivo: string;
      cambio: string;
    }>`
      select metodo_pago,
             monto_tarjeta_centavos::text as tarjeta,
             monto_efectivo_centavos::text as efectivo,
             cambio_centavos::text as cambio
        from ordenes_pagos_resumen
       where orden_id = ${ordenId}
    `.execute(obtenerDb());
    expect(rows).toEqual([
      { metodo_pago: 'mixto', tarjeta: '90000', efectivo: '11200', cambio: '8800' },
    ]);
  });

  it('SEIS TARJETAS y efectivo (siete pagos): una mesa grande que reparte la cuenta', async () => {
    // Tres platos: $1,380.00, sin propina. Seis tarjetas de $200 y $180 en efectivo.
    const { ordenId, total } = await mesaConCuenta(3);
    const cobrado = exigirOk(
      await cobrar(
        ordenId,
        total,
        [
          { metodo: 'efectivo', montoCentavos: 18_000 },
          ...Array.from({ length: 6 }, () => ({
            metodo: 'tarjeta' as const,
            montoCentavos: 20_000,
          })),
        ],
        { tipo: 'sin_propina', puntosBase: 0 },
      ),
      'venta.cobrar',
    );
    expect(cobrado.pagadoCentavos).toBe('138000');
    expect(await pagosDe(ordenId)).toHaveLength(7);
  });

  it('las tarjetas que no suman el total no cobran nada', async () => {
    const { ordenId, total } = await mesaConCuenta(2);
    const corto = await cobrar(
      ordenId,
      total,
      [
        { metodo: 'tarjeta', montoCentavos: 40_000 },
        { metodo: 'tarjeta', montoCentavos: 30_000 },
      ],
      { tipo: 'sin_propina', puntosBase: 0 },
    );
    expect(corto.ok).toBe(false);
    if (!corto.ok) expect(corto.error.datos).toMatchObject({ regla: 'PAGO_NO_CUADRA' });
    expect(await pagosDe(ordenId)).toEqual([]);
    expect((await cuenta(ordenId)).estado).not.toBe('pagada');
  });
});
