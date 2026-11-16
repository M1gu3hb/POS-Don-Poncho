import type { Ambito, Resultado } from '@morphiqpos/contracts';
import { obtenerDb } from '@morphiqpos/data';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import {
  firmarAutorizacion,
  type CargaDeAutorizacion,
  type ParaQueSeAutoriza,
} from '../identidad/supervisor.ts';
import { comando } from '../produccion.ts';
import { abrirCajaReal, clave, exigirOk, sembrarCompanero } from '../pruebas/negocio-real.ts';
import { ambitoDeCaja, sembrarSalon, type Salon } from '../restaurante/pruebas/salon-real.ts';
import { abrirCajon, PULSO_CAJON, type ResultadoCajon } from './multiples.ts';

/**
 * DP-21 · Bloque 7 · «ABRIR CAJÓN» A MANO PIDE EL PIN DE UN GERENTE, contra Postgres.
 *
 * El PIN lo exige el SERVIDOR, no sólo la pantalla: sin la autorización firmada del supervisor
 * (`para: 'cajon'`), de un solo uso, vigente y de un gerente, administrador o dueño, el comando
 * niega la apertura. Sin excepción para quien ya es de mando: el gerente con la sesión abierta
 * también la presenta (una tableta olvidada no sirve para abrir el cajón).
 */

const SECRETO = 'secreto_de_integracion_del_cajon_con_pin_2026';
vi.mock('@morphiqpos/contracts', async (original) => ({
  ...(await original<typeof import('@morphiqpos/contracts')>()),
  validarEntorno: () => ({ SESSION_SECRET: SECRETO }),
}));

const POR_COMANDOS = 120_000;

let salon: Salon;
let cajera: Ambito;
let gerente: Ambito;
let dueno: Ambito;
let gerenteId = '';
let sesionId = '';

beforeAll(async () => {
  salon = await sembrarSalon({ nombre: 'Fonda del cajón con PIN', mesas: 1, terminales: 1 });
  const cajeraId = await sembrarCompanero(salon.negocio, { nombre: 'La Cajera', rol: 'cajero' });
  gerenteId = await sembrarCompanero(salon.negocio, { nombre: 'La Gerente', rol: 'gerente' });
  const duenoId = await sembrarCompanero(salon.negocio, { nombre: 'Don Poncho', rol: 'dueno' });
  cajera = { ...ambitoDeCaja(salon), rol: 'cajero', empleoId: cajeraId };
  gerente = { ...ambitoDeCaja(salon), rol: 'gerente', empleoId: gerenteId };
  dueno = { ...ambitoDeCaja(salon), rol: 'dueno', empleoId: duenoId };
  sesionId = await abrirCajaReal(cajera, 5_000_000);
}, POR_COMANDOS);

interface Firma {
  readonly para?: ParaQueSeAutoriza | 'sin-para';
  readonly rol?: string;
  readonly solicita?: string;
  readonly venceEnSegundos?: number;
  readonly n?: string;
}

/** Una autorización de supervisor como la firma `/api/identidad/supervisor`. */
function firma(f: Firma = {}, solicitante: Ambito = cajera): string {
  const carga: CargaDeAutorizacion = {
    org: salon.negocio.organizacionId,
    supervisor: gerenteId,
    rol: f.rol ?? 'gerente',
    solicita: f.solicita ?? solicitante.empleoId,
    exp: Math.floor(Date.now() / 1000) + (f.venceEnSegundos ?? 120),
    n: f.n ?? clave(),
    ...(f.para === 'sin-para' ? {} : { para: f.para ?? 'cajon' }),
  };
  return firmarAutorizacion(carga, SECRETO);
}

function abrir(autorizacion?: string, ambito: Ambito = cajera): Promise<Resultado<ResultadoCajon>> {
  return comando(abrirCajon, {
    entrada: {
      sesionCajaId: sesionId,
      motivo: 'dar_cambio',
      ...(autorizacion === undefined ? {} : { autorizacion }),
    },
    ambito,
    idempotencyKey: clave(),
  });
}

function regla<T>(r: Resultado<T>): string | null {
  if (r.ok) return null;
  const dato = (r.error.datos as { readonly regla?: unknown } | undefined)?.regla;
  return typeof dato === 'string' ? dato : r.error.codigo;
}

async function aperturasEnElTurno(): Promise<number> {
  const filas = await obtenerDb()
    .selectFrom('movimientos_caja')
    .select('id')
    .where('sesion_caja_id', '=', sesionId)
    .where('tipo', '=', 'ajuste')
    .execute();
  return filas.length;
}

describe('caja.abrir_cajon exige la autorización del supervisor', () => {
  it(
    'sin autorización se niega, sea quien sea el que tiene la sesión',
    async () => {
      expect(regla(await abrir(undefined, cajera))).toBe('PUESTO_NO_OTORGABLE');
      expect(regla(await abrir(undefined, gerente))).toBe('PUESTO_NO_OTORGABLE');
      expect(regla(await abrir(undefined, dueno))).toBe('PUESTO_NO_OTORGABLE');
      expect(await aperturasEnElTurno()).toBe(0);
    },
    POR_COMANDOS,
  );

  it(
    'una autorización de descuento o de retiro no sirve para el cajón',
    async () => {
      expect(regla(await abrir(firma({ para: 'descuento' })))).toBe('PUESTO_NO_OTORGABLE');
      expect(regla(await abrir(firma({ para: 'retiro' })))).toBe('PUESTO_NO_OTORGABLE');
      expect(regla(await abrir(firma({ para: 'cancelacion' })))).toBe('PUESTO_NO_OTORGABLE');
      // La firmada sin `para` es de descuento, como las de antes.
      expect(regla(await abrir(firma({ para: 'sin-para' })))).toBe('PUESTO_NO_OTORGABLE');
      expect(await aperturasEnElTurno()).toBe(0);
    },
    POR_COMANDOS,
  );

  it(
    'una autorización vencida se niega',
    async () => {
      expect(regla(await abrir(firma({ venceEnSegundos: -5 })))).toBe('PUESTO_NO_OTORGABLE');
      expect(await aperturasEnElTurno()).toBe(0);
    },
    POR_COMANDOS,
  );

  it(
    'una autorización de quien no es de mando se niega',
    async () => {
      expect(regla(await abrir(firma({ rol: 'cajero' })))).toBe('PUESTO_NO_OTORGABLE');
      expect(regla(await abrir(firma({ rol: 'mesero' })))).toBe('PUESTO_NO_OTORGABLE');
      expect(await aperturasEnElTurno()).toBe(0);
    },
    POR_COMANDOS,
  );

  it(
    'la que pidió otra persona no sirve para ésta',
    async () => {
      expect(regla(await abrir(firma({ solicita: gerente.empleoId })))).toBe('PUESTO_NO_OTORGABLE');
    },
    POR_COMANDOS,
  );

  it(
    'un texto que no es una autorización firmada se niega',
    async () => {
      expect(regla(await abrir('x'.repeat(40)))).toBe('PUESTO_NO_OTORGABLE');
      expect(regla(await abrir(`${firma()}0`))).toBe('PUESTO_NO_OTORGABLE');
    },
    POR_COMANDOS,
  );

  it(
    'con la autorización buena se abre, se anota y queda quién autorizó',
    async () => {
      const token = firma();
      const salida = exigirOk(await abrir(token), 'abrir con autorización');
      expect(salida.pulso).toEqual(PULSO_CAJON);
      expect(await aperturasEnElTurno()).toBe(1);

      const filas = await obtenerDb()
        .selectFrom('auditoria')
        .select('payload')
        .where('organizacion_id', '=', salon.negocio.organizacionId)
        .where('accion', '=', 'caja.abrir_cajon')
        .execute();
      expect(filas).toHaveLength(1);
      const payload = filas[0]?.payload as Record<string, unknown>;
      expect(payload).toMatchObject({
        motivo: 'dar_cambio',
        autorizadoPor: gerenteId,
        autorizadoRol: 'gerente',
      });
      // La auditoría guarda el nonce gastado, no la autorización firmada.
      expect(String(payload['autorizacion']).includes('.')).toBe(false);
    },
    POR_COMANDOS,
  );

  it(
    'la autorización se gasta: presentarla otra vez se niega',
    async () => {
      const token = firma();
      exigirOk(await abrir(token), 'primer uso');
      expect(regla(await abrir(token))).toBe('AUTORIZACION_USADA');
      expect(await aperturasEnElTurno()).toBe(2);
    },
    POR_COMANDOS,
  );

  it(
    'el gerente y el dueño con su sesión también presentan la suya',
    async () => {
      exigirOk(await abrir(firma({}, gerente), gerente), 'gerente con su PIN');
      exigirOk(await abrir(firma({}, dueno), dueno), 'dueño con su PIN');
      expect(await aperturasEnElTurno()).toBe(4);
    },
    POR_COMANDOS,
  );
});
