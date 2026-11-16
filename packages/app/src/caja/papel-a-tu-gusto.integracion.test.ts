import type { Ambito } from '@morphiqpos/contracts';
import { PAPEL_POR_OMISION, completarPapel } from '@morphiqpos/domain/venta';
import { conTransaccion, obtenerDb } from '@morphiqpos/data';
import { beforeAll, describe, expect, it } from 'vitest';

import { comando } from '../produccion.ts';
import { clave, exigirOk, sembrarCompanero } from '../pruebas/negocio-real.ts';
import { guardarConfiguracionParcial, leerConfiguracion } from '../puente/configuracion.ts';
import { ambitoDeCaja, sembrarSalon, type Salon } from '../restaurante/pruebas/salon-real.ts';
import { fijarPapelATuGusto } from './papel-a-tu-gusto.ts';

/**
 * DP-21 · Bloque 12 · «EL TICKET A TU GUSTO», contra Postgres.
 *
 *   · lo guardan sólo el dueño y el administrador, por SU comando;
 *   · lo que se guarda es estricto: nada de quitar el total, el subtotal ni los platillos;
 *   · queda en la auditoría con su antes, su después y lo que se apagó;
 *   · la Configuración lo lee completo (un negocio que nunca lo tocó: todo encendido);
 *   · por el camino genérico de la configuración no se escribe.
 */

const POR_COMANDOS = 120_000;

let salon: Salon;
let cajera: Ambito;
let gerente: Ambito;
let administrador: Ambito;
let dueno: Ambito;

beforeAll(async () => {
  salon = await sembrarSalon({ nombre: 'Fonda del Papel', mesas: 2, terminales: 1 });
  const { negocio } = salon;
  const cajeraId = await sembrarCompanero(negocio, { nombre: 'La Cajera', rol: 'cajero' });
  const gerenteId = await sembrarCompanero(negocio, { nombre: 'La Gerente', rol: 'gerente' });
  const adminId = await sembrarCompanero(negocio, { nombre: 'El Admin', rol: 'administrador' });
  const duenoId = await sembrarCompanero(negocio, { nombre: 'Don Poncho', rol: 'dueno' });
  cajera = { ...ambitoDeCaja(salon), rol: 'cajero', empleoId: cajeraId };
  gerente = { ...ambitoDeCaja(salon), rol: 'gerente', empleoId: gerenteId };
  administrador = { ...ambitoDeCaja(salon), rol: 'administrador', empleoId: adminId };
  dueno = { ...ambitoDeCaja(salon), rol: 'dueno', empleoId: duenoId };
}, POR_COMANDOS);

const sinTelefonoNiFolio = {
  ...completarPapel(undefined),
  ticket: { ...completarPapel(undefined).ticket, telefono: false, folio: false },
};
const sinLogoEnLaPrecuenta = {
  ...completarPapel(undefined),
  precuenta: { ...completarPapel(undefined).precuenta, logo: false },
};

const fijar = (ambito: Ambito, entrada: unknown) =>
  comando(fijarPapelATuGusto, {
    entrada: entrada as typeof sinTelefonoNiFolio,
    ambito,
    idempotencyKey: clave(),
  });

const guardado = async () => {
  const fila = await obtenerDb()
    .selectFrom('configuracion')
    .select('valores')
    .where('organizacion_id', '=', salon.negocio.organizacionId)
    .executeTakeFirst();
  return (fila?.valores as { papel_a_tu_gusto?: unknown } | undefined)?.papel_a_tu_gusto;
};

describe('caja.fijar_papel_a_tu_gusto', () => {
  it('un negocio que nunca lo tocó lo lee todo encendido', async () => {
    const configuracion = await leerConfiguracion(salon.negocio.organizacionId);
    expect(configuracion['papel_a_tu_gusto']).toEqual(PAPEL_POR_OMISION);
  });

  it(
    'sólo el dueño o el administrador; la cajera y la gerente no, y no dejan huella',
    { timeout: POR_COMANDOS },
    async () => {
      expect((await fijar(cajera, sinTelefonoNiFolio)).ok).toBe(false);
      expect((await fijar(gerente, sinTelefonoNiFolio)).ok).toBe(false);
      expect(await guardado()).toBeUndefined();
    },
  );

  it(
    'rechaza lo que no se puede quitar y lo incompleto: nada se guarda',
    { timeout: POR_COMANDOS },
    async () => {
      const completo = completarPapel(undefined);
      for (const malo of [
        { ...completo, ticket: { ...completo.ticket, total: false } },
        { ...completo, ticket: { ...completo.ticket, subtotal: false } },
        { ...completo, precuenta: { ...completo.precuenta, platillos: false } },
        { ...completo, extra: true },
        { ticket: completo.ticket },
        { ...completo, ticket: { ...completo.ticket, logo: 'no' } },
      ]) {
        expect((await fijar(dueno, malo)).ok).toBe(false);
      }
      expect(await guardado()).toBeUndefined();
    },
  );

  it('el administrador lo guarda y vuelve completo', { timeout: POR_COMANDOS }, async () => {
    const devuelto = exigirOk(await fijar(administrador, sinTelefonoNiFolio), 'fijar');
    expect(devuelto).toEqual(sinTelefonoNiFolio);
    expect(await guardado()).toEqual(sinTelefonoNiFolio);
  });

  it(
    'el dueño lo cambia; cada cambio queda con su antes, su después y lo que se apagó',
    { timeout: POR_COMANDOS },
    async () => {
      exigirOk(await fijar(dueno, sinLogoEnLaPrecuenta), 'fijar de nuevo');
      const filas = await obtenerDb()
        .selectFrom('auditoria')
        .select('payload')
        .where('organizacion_id', '=', salon.negocio.organizacionId)
        .where('accion', '=', 'caja.fijar_papel_a_tu_gusto')
        .orderBy('id')
        .execute();
      const cambios = filas
        .map((f) => f.payload as Record<string, unknown>)
        .filter((p) => p['despues'] !== undefined);
      expect(cambios).toHaveLength(2);
      expect(cambios[0]).toMatchObject({
        antes: { apagados: { precuenta: [], ticket: [] } },
        despues: { apagados: { precuenta: [], ticket: ['telefono', 'folio'] } },
        apagados: ['ticket.telefono', 'ticket.folio'],
        encendidos: [],
      });
      expect(cambios[1]).toMatchObject({
        antes: { apagados: { precuenta: [], ticket: ['telefono', 'folio'] } },
        despues: { apagados: { precuenta: ['logo'], ticket: [] } },
        apagados: ['precuenta.logo'],
        encendidos: ['ticket.telefono', 'ticket.folio'],
      });
    },
  );

  it('la Configuración lo lee completo, y el portal del comensal no lo recibe', async () => {
    const configuracion = await leerConfiguracion(salon.negocio.organizacionId);
    expect(configuracion['papel_a_tu_gusto']).toEqual(sinLogoEnLaPrecuenta);
    const publica = await leerConfiguracion(salon.negocio.organizacionId, { publica: true });
    expect('papel_a_tu_gusto' in publica).toBe(false);
  });

  it('por el camino genérico no se escribe: tiene su comando', async () => {
    const intento = conTransaccion((tx) =>
      guardarConfiguracionParcial(tx, salon.negocio.organizacionId, {
        papel_a_tu_gusto: sinTelefonoNiFolio,
      }),
    );
    await expect(intento).rejects.toThrow(/tiene su propio comando/);
    expect(await guardado()).toEqual(sinLogoEnLaPrecuenta);
  });
});
