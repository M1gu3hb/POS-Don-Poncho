import { randomUUID } from 'node:crypto';

import type { Resultado } from '@morphiqpos/contracts';
import { conTransaccion, obtenerDb } from '@morphiqpos/data';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { calcularCuenta } from '../../../../qa/qa-final/oraculo/dinero.ts';
import { cerrarCaja } from '../caja/sesion.ts';
import { fijarCajasSimultaneas } from '../caja/cajas-a-la-vez.ts';
import { nombrarCajas } from '../caja/lugares.ts';
import { cambiarPrecioProducto } from '../catalogo/productos.ts';
import { marcarAgotado } from '../catalogo/agotado.ts';
import { guardarEmpleado } from '../identidad/empleados.ts';
import { establecerPin } from '../identidad/comandos.ts';
import { entrarConPin } from '../identidad/entrar.ts';
import { comando } from '../produccion.ts';
import { clave, abrirCajaReal, exigirOk, sembrarCompanero } from '../pruebas/negocio-real.ts';
import { escribir } from '../puente/escribir.ts';
import { fijarPropina } from '../propinas/fijar-propina.ts';
import { crearEstacion } from '../restaurante/estacion-crear.ts';
import { enviarPedido } from '../restaurante/pedido.ts';
import { mesaDe, PRECIO_ARRACHERA } from '../restaurante/pruebas/salon-real.ts';
import { resolverSesion } from '../sesion/resolver.ts';
import { cobrarOrden } from '../venta/cobrar.ts';

import { abrirYPedir, dividir, type FilaDeDinero } from './pruebas/flujo-de-dinero.ts';
import {
  IVAS,
  SECRETO,
  fijarElIva,
  fijarQuienEligeLaPropinaEnElMundo,
  sembrarMundo,
  type Mundo,
} from './pruebas/mundo.ts';
import { renglonesDelPedido } from './pruebas/verificar-cuenta.ts';

/**
 * DP-22 · FASE D · LOS CAMBIOS DE CONFIGURACIÓN A MEDIA OPERACIÓN.
 *
 * Con cuentas abiertas, una a medio pagar y una caja abierta, se cambia un ajuste y se comprueba que
 * nada se rompe, qué regla siguen las cuentas que ya estaban abiertas y que el dinero sigue
 * cuadrando con el oráculo. Cada prueba dice la REGLA que el sistema sigue hoy; donde no hay una
 * decisión escrita, el nombre de la prueba lo dice («PARA DECISIÓN»).
 */

const PIMIENTA = 'pimienta_de_integracion_de_los_cambios_2026';
vi.mock('@morphiqpos/contracts', async (original) => ({
  ...(await original<typeof import('@morphiqpos/contracts')>()),
  validarEntorno: () => ({ SESSION_SECRET: SECRETO, PIN_PEPPER: PIMIENTA }),
}));

const POR_PRUEBA = 240_000;
let mundo: Mundo;
let indiceDeMesa = 0;

const FILA: FilaDeDinero = {
  iva: 'iva16_incluido',
  propina: 'ninguna',
  descuento: 'ninguno',
  division: 'sin_dividir',
  pago: 'efectivo_exacto',
  canal: 'mesa',
};

const cajera = () => mundo.quienes(0).cajera;
const dueno = () => mundo.quienes(0).dueno;
const sinFalla = (texto: string): void => {
  throw new Error(texto);
};

/** Abre una mesa, pide el pedido completo y pide la cuenta; devuelve el id de la cuenta. */
async function cuentaPedida(fila: FilaDeDinero = FILA, pedirLaCuenta = true): Promise<string> {
  const id = await abrirYPedir(mundo, 0, indiceDeMesa, fila, sinFalla, pedirLaCuenta);
  indiceDeMesa += 1;
  if (id === null) throw new Error('No se pudo abrir la cuenta.');
  return id;
}

async function filaDe(ordenId: string) {
  return obtenerDb()
    .selectFrom('ordenes')
    .select([
      'estado',
      'subtotal_centavos',
      'descuento_centavos',
      'impuestos_centavos',
      'total_centavos',
    ])
    .where('id', '=', ordenId)
    .executeTakeFirstOrThrow();
}

const cobrarPor = (ordenId: string, total: bigint, extra: Record<string, unknown> = {}) =>
  comando(cobrarOrden, {
    entrada: {
      ordenId,
      pagos: [{ metodo: 'efectivo' as const, montoCentavos: Number(total) }],
      totalEsperadoCentavos: Number(total),
      ...extra,
    },
    ambito: cajera(),
    idempotencyKey: clave(),
  });

function codigoDe<T>(r: Resultado<T>): string {
  return r.ok ? 'ok' : JSON.stringify(r.error);
}

beforeAll(async () => {
  mundo = await sembrarMundo({ nombre: 'Cambios a media operación', mesas: 40, terminales: 2 });
  await fijarElIva(mundo, IVAS.iva16_incluido);
  await obtenerDb()
    .updateTable('sucursales')
    .set({ cajas_simultaneas: 2 })
    .where('id', '=', mundo.salon.sucursal.sucursalId)
    .execute();
  await abrirCajaReal(cajera(), mundo.fondoCentavos);
}, 600_000);

const oraculoEntera = (iva: keyof typeof IVAS) =>
  calcularCuenta({
    renglones: renglonesDelPedido(),
    impuesto: { puntosBase: IVAS[iva].puntosBase, incluidoEnPrecio: IVAS[iva].incluidoEnPrecio },
  });

describe('4 · cambiar el IVA con cuentas abiertas', () => {
  it(
    'REGLA: la cuenta toma la tasa VIGENTE AL COBRAR; cobrar con el total de la precuenta vieja se rechaza con el total nuevo',
    { timeout: POR_PRUEBA },
    async () => {
      await fijarElIva(mundo, IVAS.iva16_incluido);
      const ordenId = await cuentaPedida();
      const precuenta = await filaDe(ordenId);
      expect(precuenta.total_centavos).toBe(oraculoEntera('iva16_incluido').totalCentavos);

      await fijarElIva(mundo, IVAS.iva16_sumado);
      const nuevo = oraculoEntera('iva16_sumado');

      // El cajero cobra con lo que la precuenta decía: el servidor se niega y dice el total vigente.
      const viejo = await cobrarPor(ordenId, precuenta.total_centavos);
      expect(viejo.ok).toBe(false);
      expect(codigoDe(viejo)).toContain('TOTAL_DESACTUALIZADO');
      // PARA DECISIÓN: el mensaje promete «con el total correcto» pero el total vigente no llega al cliente.
      expect((await filaDe(ordenId)).estado).not.toBe('pagada');

      // Con el total nuevo cobra, y la cuenta y su IVA son los del oráculo con la tasa nueva.
      exigirOk(await cobrarPor(ordenId, nuevo.totalCentavos), 'cobrar con la tasa nueva');
      const pagada = await filaDe(ordenId);
      expect(pagada.total_centavos).toBe(nuevo.totalCentavos);
      expect(pagada.impuestos_centavos).toBe(nuevo.impuestosCentavos);
      await fijarElIva(mundo, IVAS.iva16_incluido);
    },
  );

  it(
    'una cuenta DIVIDIDA antes del cambio: cada parte se cobra con la tasa nueva y la madre suma lo que se cobró',
    { timeout: POR_PRUEBA },
    async () => {
      await fijarElIva(mundo, IVAS.sin_iva);
      const madreId = await cuentaPedida({ ...FILA, division: 'por_platillo' });
      const partes = await dividir(
        mundo,
        0,
        madreId,
        { ...FILA, division: 'por_platillo' },
        sinFalla,
      );
      expect(partes).toHaveLength(2);
      await fijarElIva(mundo, IVAS.iva16_sumado);
      let cobrado = 0n;
      for (const parte of partes) {
        const lineas = await obtenerDb()
          .selectFrom('orden_lineas')
          .select(['subtotal_centavos', 'descuento_centavos'])
          .where('orden_id', '=', parte)
          .where('anulada_en', 'is', null)
          .execute();
        const esperado = calcularCuenta({
          renglones: lineas.map((l) => ({
            precioCentavos: l.subtotal_centavos,
            cantidad: '1',
            descuentoCentavos: l.descuento_centavos,
          })),
          impuesto: { puntosBase: 1600, incluidoEnPrecio: false },
        });
        const viejo = await cobrarPor(parte, (await filaDe(parte)).total_centavos);
        expect(codigoDe(viejo)).toContain('TOTAL_DESACTUALIZADO');
        exigirOk(await cobrarPor(parte, esperado.totalCentavos), 'cobrar la parte');
        expect((await filaDe(parte)).total_centavos).toBe(esperado.totalCentavos);
        cobrado += esperado.totalCentavos;
      }
      const madre = await filaDe(madreId);
      expect(madre.estado).toBe('dividida');
      // La madre suma lo que se cobró de sus partes (se ajusta al cobrar; antes el cobro reventaba con
      // «Algo falló» por la regla `division_cuadra`). Cada parte redondea su IVA: ±1 centavo por parte.
      expect(madre.total_centavos).toBe(cobrado);
      await fijarElIva(mundo, IVAS.iva16_incluido);
    },
  );

  it(
    'dividida SIN IVA y luego 16 % INCLUIDO: el total de cada parte no cambia, su IVA sí, y la madre suma también el IVA',
    { timeout: POR_PRUEBA },
    async () => {
      await fijarElIva(mundo, IVAS.sin_iva);
      const madreId = await cuentaPedida({ ...FILA, division: 'por_platillo' });
      const partes = await dividir(
        mundo,
        0,
        madreId,
        { ...FILA, division: 'por_platillo' },
        sinFalla,
      );
      expect(partes).toHaveLength(2);
      const totalDeLaMadreAntes = (await filaDe(madreId)).total_centavos;
      expect((await filaDe(madreId)).impuestos_centavos).toBe(0n);

      await fijarElIva(mundo, IVAS.iva16_incluido);
      let ivaCobrado = 0n;
      for (const parte of partes) {
        // Incluido en el precio: el total es el mismo de antes, así que se cobra sin rechazo.
        const antes = (await filaDe(parte)).total_centavos;
        exigirOk(await cobrarPor(parte, antes), 'cobrar la parte');
        const despues = await filaDe(parte);
        expect(despues.total_centavos).toBe(antes);
        expect(despues.impuestos_centavos).toBeGreaterThan(0n);
        ivaCobrado += despues.impuestos_centavos;
      }
      const madre = await filaDe(madreId);
      expect(madre.total_centavos).toBe(totalDeLaMadreAntes);
      // Si sólo se comparara el total, la madre se quedaría diciendo «sin IVA».
      expect(madre.impuestos_centavos).toBe(ivaCobrado);
    },
  );

  it(
    'una cuenta a medio pagar: la parte cobrada conserva SU tasa y la que falta toma la vigente (cada parte es una venta)',
    { timeout: POR_PRUEBA },
    async () => {
      await fijarElIva(mundo, IVAS.iva16_incluido);
      const madreId = await cuentaPedida({ ...FILA, division: 'por_platillo' });
      const [primera, segunda] = await dividir(
        mundo,
        0,
        madreId,
        { ...FILA, division: 'por_platillo' },
        sinFalla,
      );
      if (primera === undefined || segunda === undefined) throw new Error('Faltan partes.');
      const totalPrimera = (await filaDe(primera)).total_centavos;
      exigirOk(await cobrarPor(primera, totalPrimera), 'cobrar la primera parte');
      const ivaPrimera = (await filaDe(primera)).impuestos_centavos;

      await fijarElIva(mundo, IVAS.iva8_sumado);
      const lineas = await obtenerDb()
        .selectFrom('orden_lineas')
        .select(['subtotal_centavos'])
        .where('orden_id', '=', segunda)
        .where('anulada_en', 'is', null)
        .execute();
      const esperado = calcularCuenta({
        renglones: lineas.map((l) => ({ precioCentavos: l.subtotal_centavos, cantidad: '1' })),
        impuesto: { puntosBase: 800, incluidoEnPrecio: false },
      });
      exigirOk(await cobrarPor(segunda, esperado.totalCentavos), 'cobrar la segunda parte');
      expect((await filaDe(primera)).impuestos_centavos).toBe(ivaPrimera);
      expect((await filaDe(segunda)).impuestos_centavos).toBe(esperado.impuestosCentavos);
      await fijarElIva(mundo, IVAS.iva16_incluido);
    },
  );
});

describe('7 · cambiar un precio con la cuenta abierta', () => {
  it(
    'REGLA: lo ya pedido conserva el precio con que se pidió; lo que se pide después, el nuevo; el total es el del oráculo',
    { timeout: POR_PRUEBA },
    async () => {
      await fijarElIva(mundo, IVAS.sin_iva);
      const ordenId = await cuentaPedida(FILA, false);
      const antes = await filaDe(ordenId);
      const nuevoPrecio = 40_000;
      exigirOk(
        await comando(cambiarPrecioProducto, {
          entrada: {
            productoId: mundo.salon.platillos.arrachera,
            precioVenta: (nuevoPrecio / 100).toFixed(2),
          },
          ambito: dueno(),
          idempotencyKey: clave(),
        }),
        'catalogo.cambiar_precio',
      );
      // Lo ya pedido no se mueve.
      expect((await filaDe(ordenId)).subtotal_centavos).toBe(antes.subtotal_centavos);
      // Una arrachera más: entra al precio nuevo.
      exigirOk(
        await comando(enviarPedido, {
          entrada: {
            ordenId,
            lineas: [{ productoId: mundo.salon.platillos.arrachera, cantidad: '1' }],
          },
          ambito: cajera(),
          idempotencyKey: clave(),
        }),
        'restaurante.enviar_pedido',
      );
      const esperado = calcularCuenta({
        renglones: [
          ...renglonesDelPedido(),
          { precioCentavos: BigInt(nuevoPrecio), cantidad: '1' },
        ],
        impuesto: { puntosBase: 0, incluidoEnPrecio: true },
      });
      const despues = await filaDe(ordenId);
      expect(despues.subtotal_centavos).toBe(esperado.subtotalCentavos);
      exigirOk(await cobrarPor(ordenId, esperado.totalCentavos), 'cobrar');
      // Se deja el precio como estaba para las demás pruebas.
      exigirOk(
        await comando(cambiarPrecioProducto, {
          entrada: {
            productoId: mundo.salon.platillos.arrachera,
            precioVenta: (Number(PRECIO_ARRACHERA) / 100).toFixed(2),
          },
          ambito: dueno(),
          idempotencyKey: clave(),
        }),
        'catalogo.cambiar_precio (restaurar)',
      );
      await fijarElIva(mundo, IVAS.iva16_incluido);
    },
  );
});

describe('6 · cambiar el cupo o el nombre de las cajas con cajas abiertas', () => {
  it(
    'REGLA: no se baja el cupo por debajo de las cajas abiertas; el nombre nuevo no toca las cuentas ni el corte de la caja abierta',
    { timeout: POR_PRUEBA },
    async () => {
      // La segunda caja se abre mientras la primera sigue abierta (cupo 2).
      const segunda = mundo.quienes(1).cajera;
      await abrirCajaReal(segunda, mundo.fondoCentavos);
      const bajar = await comando(fijarCajasSimultaneas, {
        entrada: { cajas: 1 },
        ambito: dueno(),
        idempotencyKey: clave(),
      });
      expect(bajar.ok).toBe(false);
      expect(codigoDe(bajar)).toContain('CONFIGURACION_INVALIDA');
      const cupo = await obtenerDb()
        .selectFrom('sucursales')
        .select('cajas_simultaneas')
        .where('id', '=', mundo.salon.sucursal.sucursalId)
        .executeTakeFirstOrThrow();
      expect(cupo.cajas_simultaneas).toBe(2);

      // Renombrar con las dos abiertas: se puede, y no rompe una cuenta cobrada después.
      exigirOk(
        await comando(nombrarCajas, {
          entrada: { nombres: ['Mostrador', 'Barra'] },
          ambito: dueno(),
          idempotencyKey: clave(),
        }),
        'caja.nombrar_cajas',
      );
      const ordenId = await cuentaPedida();
      const total = (await filaDe(ordenId)).total_centavos;
      exigirOk(await cobrarPor(ordenId, total), 'cobrar con el nombre nuevo');

      // Cierra la segunda: el cupo ya puede bajar a 1... pero la primera sigue abierta, así que sí cabe.
      exigirOk(
        await comando(cerrarCaja, {
          entrada: { efectivoContadoCentavos: mundo.fondoCentavos },
          ambito: segunda,
          idempotencyKey: clave(),
        }),
        'cerrar la segunda caja',
      );
      exigirOk(
        await comando(fijarCajasSimultaneas, {
          entrada: { cajas: 1 },
          ambito: dueno(),
          idempotencyKey: clave(),
        }),
        'bajar el cupo con una sola abierta',
      );
      await obtenerDb()
        .updateTable('sucursales')
        .set({ cajas_simultaneas: 2 })
        .where('id', '=', mundo.salon.sucursal.sucursalId)
        .execute();
    },
  );
});

describe('5 · cambiar quién elige la propina con cuentas pidiendo la cuenta', () => {
  it(
    'REGLA (DP-D131): la propina ya decidida se queda; la Caja sólo la pisa con «Cambiarla»; si la Caja ya no elige, el servidor se niega',
    { timeout: POR_PRUEBA },
    async () => {
      await fijarQuienEligeLaPropinaEnElMundo(mundo, {
        comensales: true,
        mesero: true,
        caja: true,
      });
      const decidida = await cuentaPedida({ ...FILA, propina: 'porcentaje_mesero' });
      const sinDecidir = await cuentaPedida();
      const versionDe = async (id: string) =>
        (
          await obtenerDb()
            .selectFrom('ordenes')
            .select('version')
            .where('id', '=', id)
            .executeTakeFirstOrThrow()
        ).version;
      const propinaDe = async (id: string) =>
        obtenerDb()
          .selectFrom('ordenes')
          .select(['propina_tipo', 'propina_puntos_base', 'propina_origen'])
          .where('id', '=', id)
          .executeTakeFirstOrThrow();
      expect(await propinaDe(decidida)).toMatchObject({
        propina_origen: 'mesero',
        propina_puntos_base: 1000,
      });

      // El dueño deja que sólo la Caja elija.
      await fijarQuienEligeLaPropinaEnElMundo(mundo, {
        comensales: false,
        mesero: false,
        caja: true,
      });
      expect(await propinaDe(decidida)).toMatchObject({
        propina_origen: 'mesero',
        propina_puntos_base: 1000,
      });

      const pisa = (id: string, version: number, cambiar: boolean) =>
        comando(fijarPropina, {
          entrada: {
            ordenId: id,
            version,
            propinaTipo: 'porcentaje',
            propinaPuntosBase: 1500,
            cambiar,
          },
          ambito: cajera(),
          idempotencyKey: clave(),
        });
      const sin = await pisa(decidida, await versionDe(decidida), false);
      expect(codigoDe(sin)).toContain('PROPINA_VIGENTE');
      exigirOk(await pisa(decidida, await versionDe(decidida), true), 'cambiarla a propósito');
      expect(await propinaDe(decidida)).toMatchObject({
        propina_origen: 'caja',
        propina_puntos_base: 1500,
      });

      // Nadie elige: la Caja ya no puede escribir la propina de la cuenta sin decidir.
      await fijarQuienEligeLaPropinaEnElMundo(mundo, {
        comensales: false,
        mesero: false,
        caja: false,
      });
      const nadie = await pisa(sinDecidir, await versionDe(sinDecidir), false);
      expect(nadie.ok).toBe(false);
      await fijarQuienEligeLaPropinaEnElMundo(mundo, {
        comensales: true,
        mesero: false,
        caja: true,
      });
    },
  );

  it(
    'PARA DECISIÓN: con la Caja sin permiso de elegir, `venta.cobrar` SÍ acepta la propina que le manden (sólo `cuenta.fijar_propina` la guarda)',
    { timeout: POR_PRUEBA },
    async () => {
      await fijarQuienEligeLaPropinaEnElMundo(mundo, {
        comensales: false,
        mesero: false,
        caja: false,
      });
      const ordenId = await cuentaPedida();
      const total = (await filaDe(ordenId)).total_centavos;
      const cobro = await cobrarPor(ordenId, total, {
        pagos: [
          {
            metodo: 'efectivo',
            montoCentavos: Number(total),
            propinaCentavos: 500,
            recibidoCentavos: Number(total) + 500,
          },
        ],
        propinaTipo: 'monto_manual',
        propinaOrigen: 'caja',
      });
      // Lo que hace hoy: la acepta. Se anota; si algún día se cierra, esta prueba avisa del cambio de regla.
      expect(cobro.ok).toBe(true);
      await fijarQuienEligeLaPropinaEnElMundo(mundo, {
        comensales: true,
        mesero: false,
        caja: true,
      });
    },
  );
});

describe('8 · marcar un platillo como no disponible', () => {
  it(
    'REGLA: lo ya pedido se sigue cobrando; pedirlo de nuevo se rechaza («se agotó por hoy»); al desmarcarlo vuelve',
    { timeout: POR_PRUEBA },
    async () => {
      const ordenId = await cuentaPedida(FILA, false);
      exigirOk(
        await comando(marcarAgotado, {
          entrada: { productoId: mundo.salon.platillos.guacamole, agotado: true },
          ambito: dueno(),
          idempotencyKey: clave(),
        }),
        'catalogo.marcar_agotado',
      );
      const otra = await comando(enviarPedido, {
        entrada: {
          ordenId,
          lineas: [{ productoId: mundo.salon.platillos.guacamole, cantidad: '1' }],
        },
        ambito: cajera(),
        idempotencyKey: clave(),
      });
      expect(codigoDe(otra)).toContain('PRODUCTO_AGOTADO');
      const total = (await filaDe(ordenId)).total_centavos;
      exigirOk(await cobrarPor(ordenId, total), 'cobrar la cuenta con el platillo ya pedido');
      expect(total).toBe(oraculoEntera('iva16_incluido').totalCentavos);
      exigirOk(
        await comando(marcarAgotado, {
          entrada: { productoId: mundo.salon.platillos.guacamole, agotado: false },
          ambito: dueno(),
          idempotencyKey: clave(),
        }),
        'desmarcar',
      );
    },
  );
});

describe('2 y 3 · estaciones y categorías en pleno servicio', () => {
  it(
    'una estación nueva y una categoría reasignada con comandas abiertas: las comandas que ya salieron conservan su estación; las nuevas toman la de la categoría',
    { timeout: POR_PRUEBA },
    async () => {
      const db = obtenerDb();
      const org = mundo.salon.negocio.organizacionId;
      const ordenId = await cuentaPedida(FILA, false);
      const antes = await db
        .selectFrom('comandas')
        .select(['id', 'estacion_preparacion_id'])
        .where('orden_id', '=', ordenId)
        .execute();
      expect(antes.length).toBeGreaterThan(0);

      // 3 · Una estación nueva y una categoría nueva ligada a ella, en pleno servicio.
      const bebidas = exigirOk(
        await comando(crearEstacion, {
          entrada: {
            nombre: `Bebidas ${randomUUID().slice(0, 4)}`,
            descripcion: '',
            color: '#0891b2',
            orden: 1,
            esGeneral: false,
          },
          ambito: dueno(),
          idempotencyKey: clave(),
        }),
        'restaurante.crear_estacion',
      );
      const categoria = await db
        .insertInto('categorias')
        .values({
          organizacion_id: org,
          tipo: 'producto',
          nombre: `Bebidas ${randomUUID().slice(0, 4)}`,
          estacion_preparacion_id: bebidas.estacionId,
        })
        .returning('id')
        .executeTakeFirstOrThrow();

      // 2 · La cerveza pasa a esa categoría con la cuenta abierta.
      await db
        .updateTable('productos')
        .set({ categoria_id: categoria.id })
        .where('id', '=', mundo.salon.platillos.cerveza)
        .execute();
      const despues = await db
        .selectFrom('comandas')
        .select(['id', 'estacion_preparacion_id'])
        .where('orden_id', '=', ordenId)
        .execute();
      expect(despues).toEqual(antes);

      exigirOk(
        await comando(enviarPedido, {
          entrada: {
            ordenId,
            lineas: [{ productoId: mundo.salon.platillos.cerveza, cantidad: '1' }],
          },
          ambito: cajera(),
          idempotencyKey: clave(),
        }),
        'restaurante.enviar_pedido',
      );
      const nueva = await db
        .selectFrom('comandas')
        .select(['id', 'estacion_preparacion_id'])
        .where('orden_id', '=', ordenId)
        .where(
          'id',
          'not in',
          antes.map((c) => c.id),
        )
        .execute();
      expect(nueva.map((c) => c.estacion_preparacion_id)).toEqual([bebidas.estacionId]);

      // El total y el cobro no saben de estaciones: cuadra con el oráculo (más una cerveza).
      const esperado = calcularCuenta({
        renglones: [...renglonesDelPedido(), { precioCentavos: 5_555n, cantidad: '1' }],
        impuesto: { puntosBase: 1600, incluidoEnPrecio: true },
      });
      exigirOk(await cobrarPor(ordenId, esperado.totalCentavos), 'cobrar');
    },
  );
});

describe('9 · mover mesas de lugar en el editor con cuentas abiertas', () => {
  it(
    'REGLA: la cuenta sigue ligada a su mesa (por id): mover su posición o cambiarle el número no la toca ni cambia el total',
    { timeout: POR_PRUEBA },
    async () => {
      const ordenId = await cuentaPedida();
      const mesaId = mesaDe(mundo.salon, indiceDeMesa - 1);
      const totalAntes = (await filaDe(ordenId)).total_centavos;
      await conTransaccion((tx) =>
        escribir(
          tx,
          {
            organizacionId: mundo.salon.negocio.organizacionId,
            sucursalId: mundo.salon.sucursal.sucursalId,
            rol: 'dueno',
          },
          {
            entidad: 'Mesa',
            operacion: 'update',
            id: mesaId,
            datos: { posicion_x: 480, posicion_y: 220 },
          },
        ),
      );
      const mesa = await obtenerDb()
        .selectFrom('mesas')
        .select(['posicion_x', 'posicion_y', 'orden_activa_id', 'estado'])
        .where('id', '=', mesaId)
        .executeTakeFirstOrThrow();
      expect(mesa).toMatchObject({ posicion_x: 480, posicion_y: 220, orden_activa_id: ordenId });
      expect((await filaDe(ordenId)).total_centavos).toBe(totalAntes);
      exigirOk(await cobrarPor(ordenId, totalAntes), 'cobrar tras mover la mesa');
    },
  );
});

describe('10 · desactivar a un mesero con mesas abiertas', () => {
  it(
    'REGLA: sus mesas quedan sin asignar, su sesión se revoca y las cuentas abiertas se cobran igual',
    { timeout: POR_PRUEBA },
    async () => {
      const meseroId = mundo.quienes(0).mesero.empleoId ?? '';
      const ordenId = await cuentaPedida();
      const mesaId = mesaDe(mundo.salon, indiceDeMesa - 1);
      await obtenerDb()
        .updateTable('mesas')
        .set({ empleado_asignado_id: meseroId })
        .where('id', '=', mesaId)
        .execute();
      const detalle = await obtenerDb()
        .selectFrom('empleos')
        .innerJoin('personas', 'personas.id', 'empleos.persona_id')
        .select(['personas.nombre as nombre'])
        .where('empleos.id', '=', meseroId)
        .executeTakeFirstOrThrow();
      exigirOk(
        await comando(guardarEmpleado, {
          entrada: {
            empleado: meseroId,
            nombre: detalle.nombre,
            puesto: 'mesero',
            telefono: null,
            color: null,
            estacionPreparacionId: null,
            veTodasLasEstaciones: false,
            activo: false,
          },
          ambito: dueno(),
          idempotencyKey: clave(),
        }),
        'identidad.guardar_empleado',
      );
      const mesa = await obtenerDb()
        .selectFrom('mesas')
        .select(['empleado_asignado_id', 'orden_activa_id'])
        .where('id', '=', mesaId)
        .executeTakeFirstOrThrow();
      expect(mesa).toMatchObject({ empleado_asignado_id: null, orden_activa_id: ordenId });
      const total = (await filaDe(ordenId)).total_centavos;
      exigirOk(await cobrarPor(ordenId, total), 'cobrar la cuenta del mesero dado de baja');
      expect(total).toBe(oraculoEntera('iva16_incluido').totalCentavos);
    },
  );
});

describe('11 · cambiar el PIN de alguien que tiene la sesión abierta', () => {
  it(
    'el PIN viejo deja de entrar, el nuevo entra, y la sesión que estaba abierta con el anterior SE CIERRA (hallazgo 10); cambiar el propio no cierra la sesión con la que se cambia',
    { timeout: POR_PRUEBA },
    async () => {
      const empleoId = await sembrarCompanero(mundo.salon.negocio, {
        // Administradora y no cajera: el PIN sólo lo cambian los mandos, también el propio.
        nombre: 'Administradora con sesión',
        rol: 'administrador',
      });
      const db = obtenerDb();
      const persona = await db
        .selectFrom('empleos')
        .select('persona_id')
        .where('id', '=', empleoId)
        .executeTakeFirstOrThrow();
      await db
        .insertInto('identidades')
        .values({ id: randomUUID(), persona_id: persona.persona_id })
        .execute();
      const org = mundo.salon.negocio.organizacionId;
      exigirOk(
        await comando(establecerPin, {
          entrada: { empleado: empleoId, pin: '4821' },
          ambito: dueno(),
          idempotencyKey: clave(),
        }),
        'establecer el PIN',
      );
      const peticion = {
        empleoId,
        deviceToken: '',
        organizacionId: org,
        pimienta: PIMIENTA,
        secretoSesion: SECRETO,
      };
      const entrada = await entrarConPin({ ...peticion, pin: '4821' });
      expect(entrada.ok).toBe(true);
      if (!entrada.ok) return;
      const viva = await resolverSesion({ secreto: SECRETO, token: entrada.token });
      expect(viva.ok).toBe(true);

      exigirOk(
        await comando(establecerPin, {
          entrada: { empleado: empleoId, pin: '9374' },
          ambito: dueno(),
          idempotencyKey: clave(),
        }),
        'cambiar el PIN',
      );
      expect((await entrarConPin({ ...peticion, pin: '4821' })).ok).toBe(false);
      // Se lo cambió OTRA persona (el dueño): quien estaba dentro con el PIN anterior queda fuera.
      // Si se lo cambian porque alguien lo vio, ese alguien no se queda con la sesión abierta.
      const despues = await resolverSesion({ secreto: SECRETO, token: entrada.token });
      expect(despues).toEqual({ ok: false, motivo: 'revocada' });

      // Con el PIN nuevo entra, y desde ESA sesión se cambia el suyo: no se saca a sí misma.
      const nueva = await entrarConPin({ ...peticion, pin: '9374' });
      expect(nueva.ok).toBe(true);
      if (!nueva.ok) return;
      const suya = await resolverSesion({ secreto: SECRETO, token: nueva.token });
      expect(suya.ok).toBe(true);
      if (!suya.ok) return;
      exigirOk(
        await comando(establecerPin, {
          entrada: { empleado: empleoId, pin: '5560' },
          ambito: suya.ambito,
          idempotencyKey: clave(),
        }),
        'cambiar el PIN propio',
      );
      expect((await resolverSesion({ secreto: SECRETO, token: nueva.token })).ok).toBe(true);
      expect((await entrarConPin({ ...peticion, pin: '5560' })).ok).toBe(true);
    },
  );
});

// 1 · apagar el portal con carritos abiertos: `portal-apagado.integracion.test.ts` (necesita el portal armado).
