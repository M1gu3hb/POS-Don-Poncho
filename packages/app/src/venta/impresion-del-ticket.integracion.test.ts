import type { Ambito } from '@morphiqpos/contracts';
import { obtenerDb } from '@morphiqpos/data';
import { beforeAll, describe, expect, it } from 'vitest';

import { cajonPorCobro } from '../caja/cajon-por-cobro.ts';
import { copiasDeImpresionEn, fijarCopiasDeImpresion } from '../caja/copias-de-impresion.ts';
import { comando } from '../produccion.ts';
import { clave, exigirOk, sembrarCompanero } from '../pruebas/negocio-real.ts';
import { leerConfiguracion } from '../puente/configuracion.ts';
import {
  PRECIO_ARRACHERA,
  abrirLasCajas,
  ambitoDeCaja,
  cobrarExacto,
  sembrarSalon,
  sentarYPedir,
  type Salon,
} from '../restaurante/pruebas/salon-real.ts';
import { registrarImpresion } from './impresion-del-ticket.ts';

/**
 * DP-20 · LA IMPRESIÓN DEJA RASTRO, contra Postgres (refuerzo §3 y Parte 3.4).
 *
 *   · Cada ticket que sale queda en la auditoría; la primera salida es la original y desde la
 *     segunda el servidor contesta «reimpresión». El reintento con la MISMA clave no cuenta.
 *   · El cajón que se abre al cobrar queda en la auditoría con quién y con qué cobro.
 *   · Las copias (1 a 3) las cambian sólo el dueño o el administrador, con antes y después.
 */

const POR_COMANDOS = 120_000;

let salon: Salon;
let otro: Salon;
let cajera: Ambito;
let mesero: Ambito;
let gerente: Ambito;
let dueno: Ambito;
let ordenId = '';

beforeAll(async () => {
  salon = await sembrarSalon({ nombre: 'Fonda que imprime', mesas: 2, terminales: 1 });
  otro = await sembrarSalon({ nombre: 'La fonda de enfrente', mesas: 1, terminales: 1 });
  const cajeraId = await sembrarCompanero(salon.negocio, { nombre: 'La Cajera', rol: 'cajero' });
  const meseroId = await sembrarCompanero(salon.negocio, { nombre: 'El Mesero', rol: 'mesero' });
  const gerenteId = await sembrarCompanero(salon.negocio, { nombre: 'La Gerente', rol: 'gerente' });
  const duenoId = await sembrarCompanero(salon.negocio, { nombre: 'Don Poncho', rol: 'dueno' });
  cajera = { ...ambitoDeCaja(salon), rol: 'cajero', empleoId: cajeraId };
  mesero = { ...ambitoDeCaja(salon), rol: 'mesero', empleoId: meseroId };
  gerente = { ...ambitoDeCaja(salon), rol: 'gerente', empleoId: gerenteId };
  dueno = { ...ambitoDeCaja(salon), rol: 'dueno', empleoId: duenoId };
  await abrirLasCajas(salon);
  ({ ordenId } = await sentarYPedir(salon, 0, [{ platillo: 'arrachera', cantidad: '1' }]));
  exigirOk(await cobrarExacto(ambitoDeCaja(salon), ordenId, Number(PRECIO_ARRACHERA)), 'cobrar');
}, POR_COMANDOS);

function registrar(ambito: Ambito, idempotencyKey = clave(), orden = ordenId) {
  return comando(registrarImpresion, { entrada: { ordenId: orden }, ambito, idempotencyKey });
}

async function rastro(accion: string, organizacionId = salon.negocio.organizacionId) {
  return obtenerDb()
    .selectFrom('auditoria')
    .select(['entidad_id', 'payload', 'identidad_id'])
    .where('organizacion_id', '=', organizacionId)
    .where('accion', '=', accion)
    .orderBy('id')
    .execute();
}

describe('venta.registrar_impresion', () => {
  it(
    'la primera salida es la original; la segunda, «reimpresión», con la hora del servidor',
    { timeout: POR_COMANDOS },
    async () => {
      const primera = exigirOk(await registrar(cajera), 'primera salida');
      expect(primera).toMatchObject({ numero: 1, reimpresion: false });

      const segunda = exigirOk(await registrar(gerente), 'segunda salida');
      expect(segunda).toMatchObject({ numero: 2, reimpresion: true });
      expect(Number.isNaN(Date.parse(segunda.impresoEn))).toBe(false);

      const filas = await rastro('venta.registrar_impresion');
      expect(filas).toHaveLength(2);
      expect(filas.map((f) => f.entidad_id)).toEqual([ordenId, ordenId]);
      expect(filas[0]?.payload).toMatchObject({ numero: 1, reimpresion: false, rol: 'cajero' });
      expect(filas[1]?.payload).toMatchObject({ numero: 2, reimpresion: true, rol: 'gerente' });
    },
  );

  it(
    'el reintento con la misma clave recibe la misma respuesta y no cuenta otra salida',
    { timeout: POR_COMANDOS },
    async () => {
      const llave = clave();
      const una = exigirOk(await registrar(cajera, llave), 'salida');
      const otraVez = exigirOk(await registrar(cajera, llave), 'el reintento');
      expect(otraVez).toEqual(una);
      const siguiente = exigirOk(await registrar(cajera), 'la siguiente');
      expect(siguiente.numero).toBe(una.numero + 1);
    },
  );

  it('la venta de otro negocio no existe para éste', { timeout: POR_COMANDOS }, async () => {
    const ajena = await registrar({ ...ambitoDeCaja(otro) });
    expect(ajena.ok).toBe(false);
    expect(await rastro('venta.registrar_impresion', otro.negocio.organizacionId)).toHaveLength(0);
  });
});

describe('caja.cajon_por_cobro', () => {
  it(
    'deja en la auditoría quién abrió el cajón y con qué cobro; el mesero no puede',
    { timeout: POR_COMANDOS },
    async () => {
      const abierto = exigirOk(
        await comando(cajonPorCobro, {
          entrada: { referencia: '12' },
          ambito: cajera,
          idempotencyKey: clave(),
        }),
        'cajón por cobro',
      );
      expect(abierto.registrado).toBe(true);

      const negado = await comando(cajonPorCobro, {
        entrada: {},
        ambito: mesero,
        idempotencyKey: clave(),
      });
      expect(negado.ok).toBe(false);

      const filas = await rastro('caja.cajon_por_cobro');
      const aceptadas = filas.filter((f) => (f.payload as { motivo?: unknown }).motivo === 'cobro');
      expect(aceptadas).toHaveLength(1);
      expect(aceptadas[0]?.payload).toMatchObject({ referencia: '12', rol: 'cajero' });
    },
  );
});

describe('caja.fijar_copias_de_impresion', () => {
  const fijar = (ambito: Ambito, entrada: { ticket: number; precuenta: number; corte: number }) =>
    comando(fijarCopiasDeImpresion, { entrada, ambito, idempotencyKey: clave() });

  it(
    'sólo el dueño o el administrador; de 1 a 3; queda guardado y con su antes y después',
    { timeout: POR_COMANDOS },
    async () => {
      expect((await fijar(cajera, { ticket: 2, precuenta: 1, corte: 1 })).ok).toBe(false);
      expect((await fijar(gerente, { ticket: 2, precuenta: 1, corte: 1 })).ok).toBe(false);
      expect((await fijar(dueno, { ticket: 4, precuenta: 1, corte: 1 })).ok).toBe(false);
      expect((await fijar(dueno, { ticket: 0, precuenta: 1, corte: 1 })).ok).toBe(false);

      exigirOk(await fijar(dueno, { ticket: 2, precuenta: 1, corte: 3 }), 'fijar copias');

      const { valores } = await obtenerDb()
        .selectFrom('configuracion')
        .select('valores')
        .where('organizacion_id', '=', salon.negocio.organizacionId)
        .executeTakeFirstOrThrow();
      expect(copiasDeImpresionEn(valores)).toEqual({ ticket: 2, precuenta: 1, corte: 3 });

      const filas = await rastro('caja.fijar_copias_de_impresion');
      const guardada = filas.find(
        (f) => (f.payload as { despues?: unknown }).despues !== undefined,
      );
      expect(guardada?.payload).toMatchObject({
        antes: { ticket: 1, precuenta: 1, corte: 1 },
        despues: { ticket: 2, precuenta: 1, corte: 3 },
      });
    },
  );

  it('la pantalla las lee de la configuración del negocio', { timeout: POR_COMANDOS }, async () => {
    const configuracion = await leerConfiguracion(salon.negocio.organizacionId);
    expect((configuracion as { copias_de_impresion?: unknown }).copias_de_impresion).toEqual({
      ticket: 2,
      precuenta: 1,
      corte: 3,
    });
  });
});
