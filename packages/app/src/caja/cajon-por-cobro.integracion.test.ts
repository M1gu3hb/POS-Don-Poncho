import type { Ambito, Resultado } from '@morphiqpos/contracts';
import { obtenerDb } from '@morphiqpos/data';
import { sql } from 'kysely';
import { beforeAll, describe, expect, it } from 'vitest';

import { comando } from '../produccion.ts';
import { clave, exigirOk, sembrarCompanero } from '../pruebas/negocio-real.ts';
import {
  PRECIO_ARRACHERA,
  abrirLasCajas,
  ambitoDeCaja,
  cobrar,
  sembrarSalon,
  sentarYPedir,
  type Salon,
} from '../restaurante/pruebas/salon-real.ts';
import {
  SIN_EFECTIVO,
  YA_ABRIO_EL_CAJON,
  cajonPorCobro,
  type ResultadoCajonPorCobro,
} from './cajon-por-cobro.ts';

/**
 * DP-21 · Bloque 7 · X2 · EL CAJÓN QUE SE ABRE AL COBRAR EXIGE UN COBRO EN EFECTIVO, contra Postgres.
 *
 * `caja.cajon_por_cobro` ya no es un sello que cualquiera pone: exige que la orden tenga un pago en
 * EFECTIVO hecho en ESTA terminal en los últimos 2 minutos, y se registra una sola vez por cobro.
 */

const POR_COMANDOS = 120_000;
const TOTAL = Number(PRECIO_ARRACHERA);

let salon: Salon;
let cajera: Ambito;
let mesero: Ambito;
let otraCaja: Ambito;

beforeAll(async () => {
  salon = await sembrarSalon({ nombre: 'Fonda del cajón por cobro', mesas: 12, terminales: 2 });
  const cajeraId = await sembrarCompanero(salon.negocio, { nombre: 'La Cajera', rol: 'cajero' });
  const meseroId = await sembrarCompanero(salon.negocio, { nombre: 'El Mesero', rol: 'mesero' });
  cajera = { ...ambitoDeCaja(salon, 0), rol: 'cajero', empleoId: cajeraId };
  otraCaja = { ...ambitoDeCaja(salon, 1), rol: 'cajero', empleoId: cajeraId };
  mesero = { ...ambitoDeCaja(salon, 0), rol: 'mesero', empleoId: meseroId };
  await abrirLasCajas(salon);
}, POR_COMANDOS);

let mesa = 0;

/** Una cuenta nueva cobrada en `donde` con `metodo`; devuelve su orden. */
async function cobrada(metodo: 'efectivo' | 'tarjeta', donde: Ambito = cajera): Promise<string> {
  const { ordenId } = await sentarYPedir(salon, mesa++, [{ platillo: 'arrachera', cantidad: '1' }]);
  exigirOk(await cobrar(donde, ordenId, TOTAL, [{ metodo, montoCentavos: TOTAL }]), 'cobrar');
  return ordenId;
}

function abrirPorCobro(
  ordenId: string,
  ambito: Ambito = cajera,
  idempotencyKey = clave(),
): Promise<Resultado<ResultadoCajonPorCobro>> {
  return comando(cajonPorCobro, {
    entrada: { ordenId, referencia: '12' },
    ambito,
    idempotencyKey,
  });
}

/** Por qué se negó: el código del error y su mensaje, que es lo que distingue una negativa de otra. */
function negada<T>(r: Resultado<T>): string | null {
  if (r.ok) return null;
  const regla = (r.error.datos as { readonly regla?: unknown } | undefined)?.regla;
  return `${typeof regla === 'string' ? regla : r.error.codigo}: ${r.error.mensaje}`;
}

const NO_HUBO_COBRO = `MOVIMIENTO_NO_PERMITIDO: ${SIN_EFECTIVO}`;
const SEGUNDA_VEZ = `MOVIMIENTO_NO_PERMITIDO: ${YA_ABRIO_EL_CAJON}`;

async function aperturasDe(ordenId: string): Promise<number> {
  const filas = await obtenerDb()
    .selectFrom('auditoria')
    .select('id')
    .where('organizacion_id', '=', salon.negocio.organizacionId)
    .where('accion', '=', 'caja.cajon_por_cobro')
    .where(sql<string>`payload ->> 'ordenId'`, '=', ordenId)
    .execute();
  return filas.length;
}

describe('caja.cajon_por_cobro (X2)', () => {
  it(
    'con un cobro en efectivo de esta terminal, se registra y queda quién y con qué cobro',
    async () => {
      const ordenId = await cobrada('efectivo');
      const abierto = exigirOk(await abrirPorCobro(ordenId), 'cajón por cobro');
      expect(abierto.registrado).toBe(true);

      const filas = await obtenerDb()
        .selectFrom('auditoria')
        .select('payload')
        .where('organizacion_id', '=', salon.negocio.organizacionId)
        .where('accion', '=', 'caja.cajon_por_cobro')
        .where(sql<string>`payload ->> 'ordenId'`, '=', ordenId)
        .execute();
      expect(filas[0]?.payload).toMatchObject({
        motivo: 'cobro',
        ordenId,
        referencia: '12',
        rol: 'cajero',
      });
    },
    POR_COMANDOS,
  );

  it(
    'el mesero no puede',
    async () => {
      const ordenId = await cobrada('efectivo');
      expect((await abrirPorCobro(ordenId, mesero)).ok).toBe(false);
      expect(await aperturasDe(ordenId)).toBe(0);
    },
    POR_COMANDOS,
  );

  it(
    'una orden sin ningún pago se niega',
    async () => {
      const { ordenId } = await sentarYPedir(salon, mesa++, [
        { platillo: 'arrachera', cantidad: '1' },
      ]);
      expect(negada(await abrirPorCobro(ordenId))).toBe(NO_HUBO_COBRO);
      expect(await aperturasDe(ordenId)).toBe(0);
    },
    POR_COMANDOS,
  );

  it(
    'una orden que no existe en este negocio se niega',
    async () => {
      const ajena = '00000000-0000-4000-8000-000000000abc';
      expect(negada(await abrirPorCobro(ajena))).toBe(NO_HUBO_COBRO);
    },
    POR_COMANDOS,
  );

  it(
    'un cobro con tarjeta no abre el cajón',
    async () => {
      const ordenId = await cobrada('tarjeta');
      expect(negada(await abrirPorCobro(ordenId))).toBe(NO_HUBO_COBRO);
      expect(await aperturasDe(ordenId)).toBe(0);
    },
    POR_COMANDOS,
  );

  it(
    'un cobro de otra terminal no abre el cajón de ésta',
    async () => {
      const ordenId = await cobrada('efectivo', otraCaja);
      expect(negada(await abrirPorCobro(ordenId, cajera))).toBe(NO_HUBO_COBRO);
      expect(await aperturasDe(ordenId)).toBe(0);
      // En la terminal que sí cobró, sí.
      exigirOk(await abrirPorCobro(ordenId, otraCaja), 'en la terminal del cobro');
    },
    POR_COMANDOS,
  );

  it(
    'un cobro de hace más de 2 minutos ya no abre el cajón',
    async () => {
      const ordenId = await cobrada('efectivo');
      await obtenerDb()
        .updateTable('pagos')
        .set({ created_at: sql<Date>`now() - interval '3 minutes'` })
        .where('orden_id', '=', ordenId)
        .execute();
      expect(negada(await abrirPorCobro(ordenId))).toBe(NO_HUBO_COBRO);
      expect(await aperturasDe(ordenId)).toBe(0);
    },
    POR_COMANDOS,
  );

  it('un pago reembolsado ya no cuenta como cobro', { timeout: POR_COMANDOS }, async () => {
    const ordenId = await cobrada('efectivo');
    await obtenerDb()
      .updateTable('pagos')
      .set({ estado: 'reembolsado' })
      .where('orden_id', '=', ordenId)
      .execute();
    expect(negada(await abrirPorCobro(ordenId))).toBe(NO_HUBO_COBRO);
    expect(await aperturasDe(ordenId)).toBe(0);
  });

  it(
    'el reintento con la MISMA clave no cuenta como una segunda apertura',
    async () => {
      const ordenId = await cobrada('efectivo');
      const llave = clave();
      const una = exigirOk(await abrirPorCobro(ordenId, cajera, llave), 'primera');
      const otraVez = exigirOk(await abrirPorCobro(ordenId, cajera, llave), 'reintento');
      expect(otraVez).toEqual(una);
      expect(await aperturasDe(ordenId)).toBe(1);
    },
    POR_COMANDOS,
  );

  it(
    'una segunda llamada con OTRA clave se niega: una sola vez por cobro',
    async () => {
      const ordenId = await cobrada('efectivo');
      exigirOk(await abrirPorCobro(ordenId), 'primera');
      expect(negada(await abrirPorCobro(ordenId))).toBe(SEGUNDA_VEZ);
      expect(await aperturasDe(ordenId)).toBe(1);
    },
    POR_COMANDOS,
  );

  it(
    'varias llamadas a la vez con claves distintas: sólo una pasa',
    async () => {
      const ordenId = await cobrada('efectivo');
      const salidas = await Promise.all(Array.from({ length: 8 }, () => abrirPorCobro(ordenId)));
      expect(salidas.filter((salida) => salida.ok)).toHaveLength(1);
      expect(await aperturasDe(ordenId)).toBe(1);
    },
    POR_COMANDOS,
  );
});
