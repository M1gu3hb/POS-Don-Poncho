import { randomUUID } from 'node:crypto';

import { conTransaccion, obtenerDb, repoCaja } from '@morphiqpos/data';
import { sql } from 'kysely';
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
 * DP-25 · VARIAS ENTREGAS DE PROPINA EN EL MISMO TURNO DE CAJA, y de qué caja sale la del
 * Tablero, contra Postgres.
 *
 * La falla (DP-24): la liquidación entregada desde la caja dejaba su sesión en
 * `liquidaciones_propina.sesion_caja_id`, la columna del REPARTO del turno (087), que es única por
 * turno. La primera entrega pasaba; la segunda del mismo turno chocaba con
 * `liquidaciones_un_reparto_por_turno` y salía «Algo falló de nuestro lado». Ahora la entrega tiene
 * su propia columna y el reparto del turno sigue siendo uno.
 */

const SECRETO = 'secreto_de_integracion_de_varias_entregas_2026';
vi.mock('@morphiqpos/contracts', async (original) => ({
  ...(await original<typeof import('@morphiqpos/contracts')>()),
  validarEntorno: () => ({ SESSION_SECRET: SECRETO }),
}));

const LARGO = 300_000;
const PLATO = 46_000;
const FONDO = 50_000;

let negocio: NegocioReal;
let enLaCaja: ReturnType<typeof ambitoDe>;
let enLaOficina: ReturnType<typeof ambitoDe>;
let sucursalId: string;
let plato: string;
let meseros: { lupita: string; pablo: string; memo: string };
let rosa: string;
let gema: string;
let siguienteMesa = 700;

beforeAll(async () => {
  negocio = await sembrarNegocio({
    nombre: 'Fonda que entrega varias propinas',
    rol: 'dueno',
    giro: 'restaurante',
    paquete: 'restaurante',
  });
  const sucursal = await sembrarSucursal(negocio, { terminales: ['Caja', 'Oficina'] });
  sucursalId = sucursal.sucursalId;
  enLaCaja = ambitoDe(negocio, sucursalId, sucursal.terminales[0] ?? null);
  enLaOficina = ambitoDe(negocio, sucursalId, sucursal.terminales[1] ?? null);
  ({ productoId: plato } = await sembrarProducto(negocio, sucursal.almacenId, {
    nombre: 'Barbacoa de horno',
    precioCentavos: BigInt(PLATO),
    existencia: '100000',
  }));
  await conTransaccion((tx) =>
    tx
      .insertInto('estaciones_preparacion')
      .values({ organizacion_id: negocio.organizacionId, nombre: 'Cocina', es_general: true })
      .execute(),
  );
  meseros = {
    lupita: await sembrarCompanero(negocio, { nombre: 'Lupita', rol: 'mesero' }),
    pablo: await sembrarCompanero(negocio, { nombre: 'Pablo', rol: 'mesero' }),
    memo: await sembrarCompanero(negocio, { nombre: 'Memo', rol: 'mesero' }),
  };
  rosa = await sembrarCompanero(negocio, { nombre: 'Rosa', rol: 'cajero' });
  gema = await sembrarCompanero(negocio, { nombre: 'Gema', rol: 'gerente' });
}, LARGO);

const como = (empleoId: string, rol: 'mesero' | 'cajero' | 'gerente', donde = enLaCaja) => ({
  ...donde,
  empleoId,
  rol,
});

/** Una mesa de ese mesero, cobrada en la caja con esa propina. */
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
  const pide = { ambito: como(mesero, 'mesero') };
  const { ordenId } = exigirOk(
    await comando(abrirMesa, {
      ...pide,
      entrada: { mesaId, personas: 2 },
      idempotencyKey: clave(),
    }),
    'restaurante.abrir_mesa',
  );
  exigirOk(
    await comando(enviarPedido, {
      ...pide,
      entrada: { ordenId, lineas: [{ productoId: plato, cantidad: '1' }] },
      idempotencyKey: clave(),
    }),
    'restaurante.enviar_pedido',
  );
  exigirOk(
    await comando(solicitarCuenta, {
      ...pide,
      entrada: { ordenId, aunConPendientes: true },
      idempotencyKey: clave(),
    }),
    'restaurante.solicitar_cuenta',
  );
  exigirOk(
    await comando(cobrarOrden, {
      entrada: {
        ordenId,
        pagos: [
          { metodo: pago.metodo, montoCentavos: PLATO, propinaCentavos: pago.propinaCentavos },
        ],
        totalEsperadoCentavos: PLATO,
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

function hoy(): { desde: string; hasta: string } {
  const ahora = Date.now();
  return {
    desde: new Date(ahora - 3_600_000).toISOString(),
    hasta: new Date(ahora + 3_600_000).toISOString(),
  };
}

const esperado = (sesionCajaId: string) =>
  repoCaja
    .arqueoDeSesion(obtenerDb(), negocio.organizacionId, sesionCajaId)
    .then((arqueo) => arqueo.efectivoEsperadoCentavos);

const salidasDePropina = (sesionCajaId: string) =>
  obtenerDb()
    .selectFrom('movimientos_caja')
    .select(['monto_centavos', 'referencia_id'])
    .where('sesion_caja_id', '=', sesionCajaId)
    .where('tipo', '=', 'propina_entregada')
    .orderBy('created_at')
    .execute();

const filaDe = (liquidacionId: string) =>
  obtenerDb()
    .selectFrom('liquidaciones_propina')
    .select(['sesion_caja_id', 'entregada_en_sesion_caja_id', 'total_centavos'])
    .where('id', '=', liquidacionId)
    .executeTakeFirstOrThrow();

const liquidarA = (meseroId: string, extra: Record<string, unknown>, ambito = enLaCaja) =>
  comando(liquidarPropinas, {
    entrada: { rangoTipo: 'dia', ...hoy(), meseroId, entregarDeLaCaja: true, ...extra },
    ambito,
    idempotencyKey: clave(),
  });

async function cerrarCuadrando(sesionCajaId: string, entregado: bigint, antes: bigint) {
  const contado = Number(antes - entregado);
  const cierre = exigirOk(
    await comando(cerrarCaja, {
      entrada: { efectivoContadoCentavos: contado },
      ambito: enLaCaja,
      idempotencyKey: clave(),
    }),
    'caja.cerrar',
  );
  expect(cierre.efectivoEsperadoCentavos).toBe(String(contado));
  expect(cierre.diferenciaCentavos).toBe('0');
  expect(await esperado(sesionCajaId)).toBeDefined();
}

describe('varias entregas de propina en el mismo turno', () => {
  it(
    'TRES entregas en el mismo turno: cada una sale del cajón y el cierre cuadra',
    { timeout: LARGO },
    async () => {
      const sesionCajaId = await abrirCajaReal(enLaCaja, FONDO);
      await mesaCobrada(meseros.lupita, { metodo: 'efectivo', propinaCentavos: 4_600 });
      await mesaCobrada(meseros.pablo, { metodo: 'tarjeta', propinaCentavos: 3_000 });
      await mesaCobrada(meseros.memo, { metodo: 'efectivo', propinaCentavos: 2_000 });
      const antes = await esperado(sesionCajaId);

      const entregas = [];
      for (const [mesero, importe] of [
        [meseros.lupita, '4600'],
        [meseros.pablo, '3000'],
        [meseros.memo, '2000'],
      ] as const) {
        const liquidada = exigirOk(await liquidarA(mesero, {}), 'propinas.liquidar');
        expect(liquidada.entregadoDeLaCajaCentavos).toBe(importe);
        entregas.push(liquidada.liquidacionId);
      }

      expect((await salidasDePropina(sesionCajaId)).map((s) => s.monto_centavos)).toEqual([
        -4_600n,
        -3_000n,
        -2_000n,
      ]);
      expect(await esperado(sesionCajaId)).toBe(antes - 9_600n);
      // Cada entrega recuerda de qué caja salió, en SU columna: la del reparto del turno queda libre.
      for (const id of entregas) {
        expect(await filaDe(id)).toMatchObject({
          sesion_caja_id: null,
          entregada_en_sesion_caja_id: sesionCajaId,
        });
      }
      await cerrarCuadrando(sesionCajaId, 9_600n, antes);
    },
  );

  it('el doble toque no paga dos veces', { timeout: LARGO }, async () => {
    const sesionCajaId = await abrirCajaReal(enLaCaja, FONDO);
    const ordenId = await mesaCobrada(meseros.lupita, {
      metodo: 'efectivo',
      propinaCentavos: 1_500,
    });
    const antes = await esperado(sesionCajaId);
    const entrada = {
      rangoTipo: 'dia' as const,
      ...hoy(),
      meseroId: meseros.lupita,
      ordenIds: [ordenId],
      entregarDeLaCaja: true,
    };
    const llave = clave();
    const primera = exigirOk(
      await comando(liquidarPropinas, { entrada, ambito: enLaCaja, idempotencyKey: llave }),
      'propinas.liquidar',
    );
    // El mismo toque otra vez (la misma llave): la misma respuesta, sin otra salida.
    const repetida = exigirOk(
      await comando(liquidarPropinas, { entrada, ambito: enLaCaja, idempotencyKey: llave }),
      'propinas.liquidar',
    );
    expect(repetida.liquidacionId).toBe(primera.liquidacionId);
    // Otro intento de esa misma propina (otra llave): ya está liquidada.
    const otra = await comando(liquidarPropinas, {
      entrada,
      ambito: enLaCaja,
      idempotencyKey: clave(),
    });
    expect(otra.ok).toBe(false);
    if (!otra.ok) expect(otra.error.datos).toMatchObject({ regla: 'PROPINA_YA_LIQUIDADA' });
    // Y dos a la vez, de otra propina: sólo una gana.
    const ordenB = await mesaCobrada(meseros.pablo, { metodo: 'efectivo', propinaCentavos: 2_500 });
    const antesB = await esperado(sesionCajaId);
    const aLaVez = await Promise.all(
      [clave(), clave()].map((k) =>
        comando(liquidarPropinas, {
          entrada: { ...entrada, meseroId: meseros.pablo, ordenIds: [ordenB] },
          ambito: enLaCaja,
          idempotencyKey: k,
        }),
      ),
    );
    expect(aLaVez.filter((r) => r.ok)).toHaveLength(1);
    expect(await salidasDePropina(sesionCajaId)).toHaveLength(2);
    expect(await esperado(sesionCajaId)).toBe(antesB - 2_500n);
    await cerrarCuadrando(sesionCajaId, 1_500n + 2_500n, antes + BigInt(PLATO) + 2_500n);
  });

  it('el reparto del turno (087) sigue siendo uno solo', { timeout: LARGO }, async () => {
    const sesionCajaId = await abrirCajaReal(enLaCaja, FONDO);
    await mesaCobrada(meseros.memo, { metodo: 'efectivo', propinaCentavos: 1_000 });
    const antes = await esperado(sesionCajaId);
    exigirOk(await liquidarA(meseros.memo, {}), 'propinas.liquidar');
    // Una entrega no ocupa el lugar del reparto: el primer reparto del turno cabe…
    const reparto = (folio: bigint) =>
      conTransaccion((tx) =>
        tx
          .insertInto('liquidaciones_propina')
          .values({
            organizacion_id: negocio.organizacionId,
            sucursal_id: sucursalId,
            folio,
            rango_inicio: new Date(),
            rango_fin: new Date(),
            empleado_liquida_id: negocio.empleoId,
            reparto_base: 'horas',
            sesion_caja_id: sesionCajaId,
          })
          .execute(),
      );
    await reparto(990_001n);
    // …y el segundo, no: la protección de la 087 sigue en pie.
    await expect(reparto(990_002n)).rejects.toThrow(/liquidaciones_un_reparto_por_turno/);
    const indice = await sql<{ indexdef: string }>`
      select indexdef from pg_indexes where indexname = 'liquidaciones_un_reparto_por_turno'`.execute(
      obtenerDb(),
    );
    expect(indice.rows[0]?.indexdef).toMatch(/UNIQUE INDEX .*\(sesion_caja_id\) WHERE/);
    await cerrarCuadrando(sesionCajaId, 1_000n, antes);
  });
});

describe('la liquidación del Tablero dice de qué caja sale', () => {
  it(
    'la gerente, desde otro aparato, elige la caja abierta: sale de ese cajón y cuadra',
    { timeout: LARGO },
    async () => {
      const sesionCajaId = await abrirCajaReal(enLaCaja, FONDO);
      await mesaCobrada(meseros.lupita, { metodo: 'tarjeta', propinaCentavos: 3_300 });
      const antes = await esperado(sesionCajaId);
      const liquidada = exigirOk(
        await liquidarA(meseros.lupita, { sesionCajaId }, como(gema, 'gerente', enLaOficina)),
        'propinas.liquidar',
      );
      expect(liquidada.entregadoDeLaCajaCentavos).toBe('3300');
      expect(await esperado(sesionCajaId)).toBe(antes - 3_300n);
      expect(await filaDe(liquidada.liquidacionId)).toMatchObject({
        entregada_en_sesion_caja_id: sesionCajaId,
      });
      await cerrarCuadrando(sesionCajaId, 3_300n, antes);
    },
  );

  it(
    'sin elegir caja se paga FUERA de la caja: ningún cajón se mueve',
    { timeout: LARGO },
    async () => {
      const sesionCajaId = await abrirCajaReal(enLaCaja, FONDO);
      await mesaCobrada(meseros.pablo, { metodo: 'efectivo', propinaCentavos: 1_200 });
      const antes = await esperado(sesionCajaId);
      const liquidada = exigirOk(
        await liquidarA(
          meseros.pablo,
          { entregarDeLaCaja: undefined },
          como(gema, 'gerente', enLaOficina),
        ),
        'propinas.liquidar',
      );
      expect(liquidada.entregadoDeLaCajaCentavos).toBe('0');
      expect(await filaDe(liquidada.liquidacionId)).toMatchObject({
        entregada_en_sesion_caja_id: null,
      });
      expect(await salidasDePropina(sesionCajaId)).toEqual([]);
      await cerrarCuadrando(sesionCajaId, 0n, antes);
    },
  );

  it(
    'la cajera no saca de otra caja, y una caja cerrada no se elige',
    { timeout: LARGO },
    async () => {
      const sesionCajaId = await abrirCajaReal(enLaCaja, FONDO);
      const ordenId = await mesaCobrada(meseros.memo, {
        metodo: 'efectivo',
        propinaCentavos: 2_000,
      });
      const pin: CargaDeAutorizacion = {
        org: negocio.organizacionId,
        supervisor: gema,
        rol: 'gerente',
        solicita: rosa,
        exp: Math.floor(Date.now() / 1000) + 120,
        n: clave(),
        para: 'retiro',
        monto: '2000',
      };
      // La cajera en otro aparato, apuntando a la caja de la Caja: no.
      const deOtra = await liquidarA(
        meseros.memo,
        { ordenIds: [ordenId], sesionCajaId, autorizacion: firmarAutorizacion(pin, SECRETO) },
        como(rosa, 'cajero', enLaOficina),
      );
      expect(deOtra.ok).toBe(false);
      const antes = await esperado(sesionCajaId);
      await cerrarCuadrando(sesionCajaId, 0n, antes);
      // Ya cerrada, nadie la elige.
      const cerrada = await liquidarA(
        meseros.memo,
        { ordenIds: [ordenId], sesionCajaId },
        como(gema, 'gerente', enLaOficina),
      );
      expect(cerrada.ok).toBe(false);
      if (!cerrada.ok) expect(cerrada.error.datos).toMatchObject({ regla: 'CAJA_CERRADA' });
    },
  );
});
