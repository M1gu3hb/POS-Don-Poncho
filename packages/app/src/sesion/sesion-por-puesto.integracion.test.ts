import type { Ambito } from '@morphiqpos/contracts';
import { conTransaccion, obtenerDb, repoSesion } from '@morphiqpos/data';
import { beforeAll, describe, expect, it } from 'vitest';

import { candadoDeMandoEn, fijarCandadoDeMando } from '../configuracion/candado-de-mando.ts';
import { comando } from '../produccion.ts';
import {
  ambitoDe,
  clave,
  exigirOk,
  sembrarCompanero,
  sembrarNegocio,
  type NegocioReal,
} from '../pruebas/negocio-real.ts';
import { resolverSesion } from './resolver.ts';
import { firmarSesion, nuevoIdDeSesion } from './token.ts';

/**
 * DP-21 · Bloque 2 · LA SESIÓN VENCE EN EL SERVIDOR, contra Postgres (M14, O10 y A18).
 *
 *   · con la fila vencida no hay sesión, tenga la cookie el tope que tenga;
 *   · el uso corre el vencimiento del mando (30 min) y del mesero (12 h); el del cajero, no;
 *   · renovar sólo alarga: no acorta, y no revive una sesión vencida ni una cerrada con «Salir»;
 *   · el candado de mando (de 5 a 30 minutos) lo cambian sólo el dueño o el administrador.
 */

const SECRETO = 'secreto-de-prueba-largo-y-distinto-del-real';
const MINUTO = 60_000;
const HORA = 60 * MINUTO;
const POR_COMANDOS = 120_000;

/**
 * Un negocio por puesto: `sembrarNegocio` deja a su persona con identidad y empleo, que es lo
 * que la sesión necesita para resolver su ámbito (un compañero sembrado no tiene identidad).
 */
const negocios: Record<string, NegocioReal> = {};
const ROLES_DE_LA_PRUEBA = ['administrador', 'cajero', 'mesero', 'gerente'] as const;

beforeAll(async () => {
  for (const rol of ROLES_DE_LA_PRUEBA) {
    negocios[rol] = await sembrarNegocio({
      nombre: `Fonda del ${rol}`,
      rol,
      giro: 'restaurante',
      paquete: 'restaurante',
    });
  }
}, POR_COMANDOS);

function negocioDe(rol: string): NegocioReal {
  const negocio = negocios[rol];
  if (negocio === undefined) throw new Error(`sin negocio sembrado para ${rol}`);
  return negocio;
}

/** Una sesión registrada que vence dentro de `venceEnMs`, con su token (tope: `topeEnMs`). */
async function sesionDe(rol: string, venceEnMs: number, topeEnMs = 12 * HORA) {
  const { empleoId, identidadId, organizacionId } = negocioDe(rol);
  const sid = nuevoIdDeSesion();
  const ahora = new Date();
  // La base no admite una sesión que venza antes de crearse: la que ya venció se creó ayer.
  const creadaEn = new Date(Math.min(ahora.getTime(), ahora.getTime() + venceEnMs) - 13 * HORA);
  await conTransaccion((tx) =>
    repoSesion.crearSesion(tx, {
      sid,
      organizacionId,
      empleoId,
      creadaEn,
      expiraEn: new Date(ahora.getTime() + venceEnMs),
    }),
  );
  const token = firmarSesion(
    {
      sid,
      identidadId,
      empleoId,
      terminalId: null,
      exp: Math.floor((ahora.getTime() + topeEnMs) / 1000),
    },
    SECRETO,
  );
  return { sid, token };
}

/** Los minutos que le quedan a la fila, redondeados. */
async function minutosQueLeQuedan(sid: string): Promise<number> {
  const fila = await obtenerDb()
    .selectFrom('sesiones')
    .select('expira_en')
    .where('sid', '=', sid)
    .executeTakeFirstOrThrow();
  return Math.round((fila.expira_en.getTime() - Date.now()) / MINUTO);
}

describe('la sesión vence en el servidor', () => {
  it('con la fila vencida, el administrador ya no tiene sesión (la ruta contesta 401)', async () => {
    // Cerró la app hace más de 30 minutos: la cookie sigue ahí y el token no llegó a su tope.
    const { token } = await sesionDe('administrador', -1 * MINUTO);
    expect(await resolverSesion({ secreto: SECRETO, token })).toEqual({
      ok: false,
      motivo: 'revocada',
    });
  });

  it('el administrador que usa el sistema corre su vencimiento a 30 minutos', async () => {
    const { sid, token } = await sesionDe('administrador', 4 * MINUTO);
    const resultado = await resolverSesion({ secreto: SECRETO, token });
    expect(resultado.ok).toBe(true);
    expect(await minutosQueLeQuedan(sid)).toBe(30);
  });

  it('el cajero no se renueva: le queda lo que le quedaba', async () => {
    const { sid, token } = await sesionDe('cajero', 20 * MINUTO);
    expect((await resolverSesion({ secreto: SECRETO, token })).ok).toBe(true);
    expect(await minutosQueLeQuedan(sid)).toBe(20);
  });

  it('el mesero que sigue trabajando corre su vencimiento a 12 horas, sin pasar del tope', async () => {
    const { sid, token } = await sesionDe('mesero', 2 * HORA, 7 * 24 * HORA);
    expect((await resolverSesion({ secreto: SECRETO, token })).ok).toBe(true);
    expect(await minutosQueLeQuedan(sid)).toBe(12 * 60);

    const corta = await sesionDe('mesero', 10 * MINUTO, 3 * HORA);
    expect((await resolverSesion({ secreto: SECRETO, token: corta.token })).ok).toBe(true);
    expect(await minutosQueLeQuedan(corta.sid)).toBe(3 * 60);
  });

  it('a las 12 horas sin uso el mesero vuelve a teclear su PIN', async () => {
    const { token } = await sesionDe('mesero', -1_000, 7 * 24 * HORA);
    expect(await resolverSesion({ secreto: SECRETO, token })).toEqual({
      ok: false,
      motivo: 'revocada',
    });
  });
});

describe('repoSesion.renovarSesion', () => {
  const enMs = (ms: number): Date => new Date(Date.now() + ms);

  it('sólo alarga: una renovación más corta que lo que hay no cambia nada', async () => {
    const { sid } = await sesionDe('gerente', 8 * HORA);
    await conTransaccion((tx) => repoSesion.renovarSesion(tx, sid, enMs(30 * MINUTO)));
    expect(await minutosQueLeQuedan(sid)).toBe(8 * 60);
  });

  it('no revive una sesión vencida', async () => {
    const { sid } = await sesionDe('gerente', -1 * MINUTO);
    await conTransaccion((tx) => repoSesion.renovarSesion(tx, sid, enMs(30 * MINUTO)));
    expect(await minutosQueLeQuedan(sid)).toBeLessThan(0);
  });

  it('no revive una sesión cerrada con «Salir»', async () => {
    const { sid, token } = await sesionDe('gerente', 5 * MINUTO);
    await conTransaccion((tx) => repoSesion.revocarSesion(tx, sid));
    await conTransaccion((tx) => repoSesion.renovarSesion(tx, sid, enMs(30 * MINUTO)));
    expect(await minutosQueLeQuedan(sid)).toBe(5);
    expect((await resolverSesion({ secreto: SECRETO, token })).ok).toBe(false);
  });
});

describe('configuracion.fijar_candado_de_mando', () => {
  const fijar = (ambito: Ambito, minutos: number) =>
    comando(fijarCandadoDeMando, { entrada: { minutos }, ambito, idempotencyKey: clave() });

  it(
    'de 5 a 30 minutos, sólo el dueño o el administrador, con antes y después',
    { timeout: POR_COMANDOS },
    async () => {
      const negocio = negocioDe('administrador');
      const administrador = ambitoDe(negocio, null, null);
      const gerenteId = await sembrarCompanero(negocio, { nombre: 'La Gerente', rol: 'gerente' });
      const cajeraId = await sembrarCompanero(negocio, { nombre: 'La Cajera', rol: 'cajero' });
      const gerente: Ambito = { ...administrador, rol: 'gerente', empleoId: gerenteId };
      const cajera: Ambito = { ...administrador, rol: 'cajero', empleoId: cajeraId };

      expect((await fijar(gerente, 15)).ok).toBe(false);
      expect((await fijar(cajera, 15)).ok).toBe(false);
      expect((await fijar(administrador, 4)).ok).toBe(false);
      expect((await fijar(administrador, 31)).ok).toBe(false);

      expect(exigirOk(await fijar(administrador, 15), 'fijar')).toEqual({ minutos: 15 });
      const { valores } = await obtenerDb()
        .selectFrom('configuracion')
        .select('valores')
        .where('organizacion_id', '=', negocio.organizacionId)
        .executeTakeFirstOrThrow();
      expect(candadoDeMandoEn(valores)).toBe(15);

      const filas = await obtenerDb()
        .selectFrom('auditoria')
        .select('payload')
        .where('organizacion_id', '=', negocio.organizacionId)
        .where('accion', '=', 'configuracion.fijar_candado_de_mando')
        .execute();
      const cambios = filas
        .map((f) => f.payload as { antes?: unknown; despues?: unknown })
        .filter((p) => p.despues !== undefined)
        .map(({ antes, despues }) => ({ antes, despues }));
      expect(cambios).toEqual([{ antes: { minutos: 10 }, despues: { minutos: 15 } }]);
    },
  );
});
