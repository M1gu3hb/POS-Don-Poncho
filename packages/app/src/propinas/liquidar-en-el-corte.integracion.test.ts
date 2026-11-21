import { randomUUID } from 'node:crypto';

import { conTransaccion, obtenerDb, repoCaja } from '@morphiqpos/data';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { cerrarCaja } from '../caja/sesion.ts';
import { firmarAutorizacion, type CargaDeAutorizacion } from '../identidad/supervisor.ts';
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
import { solicitarCuenta } from '../restaurante/cuenta.ts';
import { abrirMesa } from '../restaurante/mesas.ts';
import { enviarPedido } from '../restaurante/pedido.ts';
import { cobrarOrden } from '../venta/cobrar.ts';
import { liquidarPropinas } from './liquidar.ts';

/**
 * DP-24 · LIQUIDAR PROPINAS EN EL CORTE, CON EL CONTEO CUADRANDO, contra Postgres.
 *
 * La falla: al cerrar el día se le entregaba su propina a cada mesero en EFECTIVO, del cajón, y esa
 * salida no quedaba en ninguna parte: el corte seguía esperando ese dinero y el conteo salía «con
 * faltante» por exactamente lo entregado. Ahora la liquidación hecha desde la caja (la misma
 * `propinas.liquidar` del Tablero, con `entregarDeLaCaja`) deja su SALIDA en el cajón de esa caja:
 * el esperado baja lo que se entregó —la propina cobrada en efectivo Y la cobrada con tarjeta, que
 * también se paga en billetes— y el cierre cuadra.
 *
 * Sin ese aviso (la liquidación del Tablero, que no sale de ningún cajón) nada cambia.
 */

const SECRETO = 'secreto_de_integracion_de_las_propinas_del_corte_2026';
vi.mock('@morphiqpos/contracts', async (original) => ({
  ...(await original<typeof import('@morphiqpos/contracts')>()),
  validarEntorno: () => ({ SESSION_SECRET: SECRETO }),
}));

const LARGO = 300_000;
const PLATO_CENTAVOS = 46_000;
const FONDO = 50_000;

let negocio: NegocioReal;
let ambito: ReturnType<typeof ambitoDe>;
let sucursalId: string;
let plato: string;
let lupita: string;
let pablo: string;
let rosa: string;
let gema: string;
let siguienteMesa = 900;

beforeAll(async () => {
  negocio = await sembrarNegocio({
    nombre: 'Fonda que liquida en el corte',
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
  await conTransaccion((tx) =>
    tx
      .insertInto('estaciones_preparacion')
      .values({
        organizacion_id: negocio.organizacionId,
        nombre: 'Cocina general',
        es_general: true,
      })
      .execute(),
  );
  lupita = await sembrarCompanero(negocio, { nombre: 'Lupita', rol: 'mesero' });
  pablo = await sembrarCompanero(negocio, { nombre: 'Pablo', rol: 'mesero' });
  rosa = await sembrarCompanero(negocio, { nombre: 'Rosa', rol: 'cajero' });
  gema = await sembrarCompanero(negocio, { nombre: 'Gema', rol: 'gerente' });
}, LARGO);

const como = (empleoId: string, rol: 'mesero' | 'cajero') => ({ ...ambito, empleoId, rol });

/** Una mesa que atiende ese mesero, servida y cobrada con esa propina. */
async function mesaCobrada(
  mesero: string,
  pago: { readonly metodo: 'efectivo' | 'tarjeta'; readonly propinaCentavos: number },
): Promise<string> {
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
      ambito: como(mesero, 'mesero'),
      idempotencyKey: clave(),
    }),
    'restaurante.abrir_mesa',
  );
  exigirOk(
    await comando(enviarPedido, {
      entrada: { ordenId, lineas: [{ productoId: plato, cantidad: '1' }] },
      ambito: como(mesero, 'mesero'),
      idempotencyKey: clave(),
    }),
    'restaurante.enviar_pedido',
  );
  exigirOk(
    await comando(solicitarCuenta, {
      entrada: { ordenId },
      ambito: como(mesero, 'mesero'),
      idempotencyKey: clave(),
    }),
    'restaurante.solicitar_cuenta',
  );
  exigirOk(
    await comando(cobrarOrden, {
      entrada: {
        ordenId,
        pagos: [
          {
            metodo: pago.metodo,
            montoCentavos: PLATO_CENTAVOS,
            propinaCentavos: pago.propinaCentavos,
          },
        ],
        totalEsperadoCentavos: PLATO_CENTAVOS,
        propinaTipo: 'monto_manual',
        propinaOrigen: 'caja',
      },
      ambito: como(rosa, 'cajero'),
      idempotencyKey: clave(),
    }),
    'venta.cobrar',
  );
  return ordenId;
}

/** El PIN de la gerente, ya tecleado: la autorización firmada para ESE importe (un solo uso). */
function pinDeGema(montoCentavos: number): string {
  const carga: CargaDeAutorizacion = {
    org: negocio.organizacionId,
    supervisor: gema,
    rol: 'gerente',
    solicita: rosa,
    exp: Math.floor(Date.now() / 1000) + 120,
    n: clave(),
    para: 'retiro',
    monto: String(montoCentavos),
  };
  return firmarAutorizacion(carga, SECRETO);
}

function hoy(): { desde: string; hasta: string } {
  const ahora = Date.now();
  return {
    desde: new Date(ahora - 3_600_000).toISOString(),
    hasta: new Date(ahora + 3_600_000).toISOString(),
  };
}

function esperado(sesionCajaId: string): Promise<bigint> {
  return repoCaja
    .arqueoDeSesion(obtenerDb(), negocio.organizacionId, sesionCajaId)
    .then((arqueo) => arqueo.efectivoEsperadoCentavos);
}

function salidasDePropina(sesionCajaId: string) {
  return obtenerDb()
    .selectFrom('movimientos_caja')
    .select(['tipo', 'monto_centavos', 'referencia_tipo', 'referencia_id', 'motivo'])
    .where('sesion_caja_id', '=', sesionCajaId)
    .where('tipo', '=', 'propina_entregada')
    .orderBy('created_at')
    .execute();
}

describe('liquidar propinas en el corte', () => {
  it('lo entregado sale del cajón de esa caja y el cierre CUADRA', { timeout: LARGO }, async () => {
    const sesionCajaId = await abrirCajaReal(ambito, FONDO);
    // Lupita: $46.00 de propina en efectivo y $30.00 con tarjeta. Pablo: $20.00 en efectivo.
    await mesaCobrada(lupita, { metodo: 'efectivo', propinaCentavos: 4_600 });
    await mesaCobrada(lupita, { metodo: 'tarjeta', propinaCentavos: 3_000 });
    await mesaCobrada(pablo, { metodo: 'efectivo', propinaCentavos: 2_000 });

    // El cajón: fondo + dos ventas en efectivo + sus propinas en efectivo.
    const antes = await esperado(sesionCajaId);
    expect(antes).toBe(BigInt(FONDO + 2 * PLATO_CENTAVOS + 4_600 + 2_000));

    // La gerente le liquida a Lupita desde el corte: sus $76.00 salen del cajón, en billetes.
    const liquidada = exigirOk(
      await comando(liquidarPropinas, {
        entrada: { rangoTipo: 'dia', ...hoy(), meseroId: lupita, entregarDeLaCaja: true },
        ambito,
        idempotencyKey: clave(),
      }),
      'propinas.liquidar',
    );
    expect(liquidada.totalCentavos).toBe('7600');
    expect(liquidada.numeroVentas).toBe(2);
    expect(liquidada.entregadoDeLaCajaCentavos).toBe('7600');

    const salidas = await salidasDePropina(sesionCajaId);
    expect(salidas).toHaveLength(1);
    expect(salidas[0]).toMatchObject({
      monto_centavos: -7_600n,
      referencia_tipo: 'liquidacion',
      referencia_id: liquidada.liquidacionId,
    });
    expect(salidas[0]?.motivo).toContain(liquidada.folio);
    expect(await esperado(sesionCajaId)).toBe(antes - 7_600n);

    // La liquidación recuerda de qué caja salió, en SU columna (DP-25): la del reparto del turno
    // (087, única por turno) queda libre, para que otra entrega del mismo turno quepa.
    const fila = await obtenerDb()
      .selectFrom('liquidaciones_propina')
      .select(['sesion_caja_id', 'entregada_en_sesion_caja_id', 'total_centavos', 'empleado_id'])
      .where('id', '=', liquidada.liquidacionId)
      .executeTakeFirstOrThrow();
    expect(fila).toEqual({
      sesion_caja_id: null,
      entregada_en_sesion_caja_id: sesionCajaId,
      total_centavos: 7_600n,
      empleado_id: lupita,
    });

    // Liquidar es opcional: lo de Pablo se queda pendiente y su efectivo sigue en el cajón.
    // Se cuenta lo que hay —lo de antes menos lo entregado— y el cierre cuadra en cero.
    const contado = Number(antes - 7_600n);
    const cierre = exigirOk(
      await comando(cerrarCaja, {
        entrada: { efectivoContadoCentavos: contado },
        ambito,
        idempotencyKey: clave(),
      }),
      'caja.cerrar',
    );
    expect(cierre.efectivoEsperadoCentavos).toBe(String(contado));
    expect(cierre.diferenciaCentavos).toBe('0');
  });

  it(
    'la del Tablero (sin «de la caja») no mueve ningún cajón, como siempre',
    { timeout: LARGO },
    async () => {
      const sesionCajaId = await abrirCajaReal(ambito, FONDO);
      await mesaCobrada(lupita, { metodo: 'efectivo', propinaCentavos: 1_500 });
      const antes = await esperado(sesionCajaId);
      const liquidada = exigirOk(
        await comando(liquidarPropinas, {
          entrada: { rangoTipo: 'dia', ...hoy(), meseroId: lupita },
          ambito,
          idempotencyKey: clave(),
        }),
        'propinas.liquidar',
      );
      expect(liquidada.totalCentavos).toBe('1500');
      expect(liquidada.entregadoDeLaCajaCentavos).toBe('0');
      expect(await salidasDePropina(sesionCajaId)).toEqual([]);
      expect(await esperado(sesionCajaId)).toBe(antes);
      exigirOk(
        await comando(cerrarCaja, {
          entrada: { efectivoContadoCentavos: Number(antes) },
          ambito,
          idempotencyKey: clave(),
        }),
        'caja.cerrar',
      );
    },
  );

  it(
    'sin caja abierta en este aparato no se entrega «de la caja»: nada queda liquidado',
    { timeout: LARGO },
    async () => {
      const sesionCajaId = await abrirCajaReal(ambito, FONDO);
      const ordenId = await mesaCobrada(pablo, { metodo: 'efectivo', propinaCentavos: 2_500 });
      exigirOk(
        await comando(cerrarCaja, {
          entrada: { efectivoContadoCentavos: Number(await esperado(sesionCajaId)) },
          ambito,
          idempotencyKey: clave(),
        }),
        'caja.cerrar',
      );
      const sinCaja = await comando(liquidarPropinas, {
        entrada: {
          rangoTipo: 'dia',
          ...hoy(),
          meseroId: pablo,
          ordenIds: [ordenId],
          entregarDeLaCaja: true,
        },
        ambito,
        idempotencyKey: clave(),
      });
      expect(sinCaja.ok).toBe(false);
      if (!sinCaja.ok) expect(sinCaja.error.datos).toMatchObject({ regla: 'CAJA_CERRADA' });
      const orden = await obtenerDb()
        .selectFrom('ordenes')
        .select('propina_liquidacion_id')
        .where('id', '=', ordenId)
        .executeTakeFirstOrThrow();
      // Todo se revirtió: la propina sigue pendiente y se puede liquidar después.
      expect(orden.propina_liquidacion_id).toBeNull();
    },
  );

  it(
    'LA CAJERA: sólo desde el corte y con el PIN de un gerente, para ese importe y una vez',
    { timeout: LARGO },
    async () => {
      const sesionCajaId = await abrirCajaReal(ambito, FONDO);
      const ordenId = await mesaCobrada(lupita, { metodo: 'efectivo', propinaCentavos: 4_000 });
      const antes = await esperado(sesionCajaId);
      const pedir = (extra: Record<string, unknown>) =>
        comando(liquidarPropinas, {
          entrada: { rangoTipo: 'dia', ...hoy(), meseroId: lupita, ordenIds: [ordenId], ...extra },
          ambito: como(rosa, 'cajero'),
          idempotencyKey: clave(),
        });
      const sigueLiquidable = async () =>
        (
          await obtenerDb()
            .selectFrom('ordenes')
            .select('propina_liquidacion_id')
            .where('id', '=', ordenId)
            .executeTakeFirstOrThrow()
        ).propina_liquidacion_id === null;

      // Por el Tablero (sin «de la caja»), no: es de gerencia.
      const porElTablero = await pedir({});
      expect(porElTablero.ok).toBe(false);
      if (!porElTablero.ok)
        expect(porElTablero.error.datos).toMatchObject({ regla: 'PUESTO_NO_OTORGABLE' });
      // Desde el corte pero sin PIN: se le pide.
      const sinPin = await pedir({ entregarDeLaCaja: true });
      expect(sinPin.ok).toBe(false);
      if (!sinPin.ok) expect(sinPin.error.datos).toMatchObject({ regla: 'PUESTO_NO_OTORGABLE' });
      // Con un PIN firmado para OTRO importe: tampoco.
      const otroMonto = await pedir({ entregarDeLaCaja: true, autorizacion: pinDeGema(9_999) });
      expect(otroMonto.ok).toBe(false);
      expect(await sigueLiquidable()).toBe(true);
      expect(await esperado(sesionCajaId)).toBe(antes);

      // Con el PIN de la gerente para los $40.00: se entrega y sale del cajón.
      const autorizacion = pinDeGema(4_000);
      const liquidada = exigirOk(
        await pedir({ entregarDeLaCaja: true, autorizacion }),
        'propinas.liquidar',
      );
      expect(liquidada.entregadoDeLaCajaCentavos).toBe('4000');
      expect(await esperado(sesionCajaId)).toBe(antes - 4_000n);
      const rastro = await obtenerDb()
        .selectFrom('auditoria')
        .select('payload')
        .where('organizacion_id', '=', negocio.organizacionId)
        .where('accion', '=', 'propinas.liquidar')
        .where('entidad_id', '=', liquidada.liquidacionId)
        .executeTakeFirstOrThrow();
      expect(rastro.payload).toMatchObject({
        autorizadoPor: gema,
        entregadoDeLaCajaCentavos: '4000',
      });

      // La misma autorización no sirve dos veces.
      const otra = await mesaCobrada(lupita, { metodo: 'efectivo', propinaCentavos: 4_000 });
      const repetida = await comando(liquidarPropinas, {
        entrada: {
          rangoTipo: 'dia',
          ...hoy(),
          meseroId: lupita,
          ordenIds: [otra],
          entregarDeLaCaja: true,
          autorizacion,
        },
        ambito: como(rosa, 'cajero'),
        idempotencyKey: clave(),
      });
      expect(repetida.ok).toBe(false);
      expect(await esperado(sesionCajaId)).toBe(antes - 4_000n + BigInt(PLATO_CENTAVOS) + 4_000n);
      exigirOk(
        await comando(cerrarCaja, {
          entrada: { efectivoContadoCentavos: Number(await esperado(sesionCajaId)) },
          ambito,
          idempotencyKey: clave(),
        }),
        'caja.cerrar',
      );
    },
  );

  it('el mesero no liquida, ni con PIN', async () => {
    const intento = await comando(liquidarPropinas, {
      entrada: {
        rangoTipo: 'dia',
        ...hoy(),
        meseroId: lupita,
        entregarDeLaCaja: true,
        autorizacion: 'x'.repeat(40),
      },
      ambito: como(lupita, 'mesero'),
      idempotencyKey: clave(),
    });
    expect(intento.ok).toBe(false);
    if (!intento.ok) expect(intento.error.codigo).toBe('SIN_PERMISO');
  });
});
