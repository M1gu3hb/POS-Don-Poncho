import { randomUUID } from 'node:crypto';

import { conTransaccion, obtenerDb } from '@morphiqpos/data';
import { sql, type RawBuilder } from 'kysely';
import { beforeAll, describe, expect, it } from 'vitest';

import {
  ambitoDe,
  clave,
  exigirOk,
  sembrarCompanero,
  sembrarNegocio,
  sembrarSucursal,
  type NegocioReal,
} from '../pruebas/negocio-real.ts';
import { comando } from '../produccion.ts';
import { CLASE_DE_CERROJO } from './limpieza-de-solicitudes.ts';
import { limpiarSolicitudes } from './solicitudes.ts';

/**
 * DP-12.6 · LA LIMPIEZA AUTOMÁTICA DE SOLICITUDES CORRE A LO MUCHO UNA VEZ POR HORA Y POR NEGOCIO,
 * decidido en el servidor, contra Postgres real.
 *
 * Antes la pantalla del mesero la pedía en cada visita a Mesas y cada pedido dejaba una línea de
 * auditoría. Aquí: la segunda llamada dentro de la hora no escribe NADA (ni auditoría ni clave de
 * idempotencia ni borra); pasada la hora, sí; el botón del dueño siempre; y cada negocio por
 * separado.
 */

const ACCION = 'restaurante.limpiar_solicitudes';

interface Caso {
  readonly negocio: NegocioReal;
  readonly mesaId: string;
  readonly ambito: ReturnType<typeof ambitoDe>;
}

async function sembrarCaso(nombre: string): Promise<Caso> {
  const negocio = await sembrarNegocio({
    nombre,
    rol: 'dueno',
    giro: 'restaurante',
    paquete: 'restaurante',
  });
  const sucursal = await sembrarSucursal(negocio, { terminales: ['Caja'] });
  const mesaId = randomUUID();
  await obtenerDb()
    .insertInto('mesas')
    .values({
      id: mesaId,
      organizacion_id: negocio.organizacionId,
      sucursal_id: sucursal.sucursalId,
      numero: 4,
      nombre: 'Mesa 4',
    })
    .execute();
  return { negocio, mesaId, ambito: ambitoDe(negocio, sucursal.sucursalId, null) };
}

/** Una solicitud ya resuelta y de hace dos días: de las que la limpieza se lleva. */
async function sembrarSolicitudVieja(caso: Caso): Promise<void> {
  await obtenerDb()
    .insertInto('solicitudes_qr')
    .values({
      organizacion_id: caso.negocio.organizacionId,
      mesa_id: caso.mesaId,
      tipo: 'ayuda',
      estado: 'resuelta',
      created_at: new Date(Date.now() - 48 * 3_600_000),
    })
    .execute();
}

async function cuantas(sentencia: RawBuilder<{ n: string }>): Promise<number> {
  const filas = await sentencia.execute(obtenerDb());
  return Number(filas.rows[0]?.n ?? 0);
}

const solicitudesDe = (caso: Caso): Promise<number> =>
  cuantas(sql<{ n: string }>`
    select count(*)::text as n from solicitudes_qr
     where organizacion_id = ${caso.negocio.organizacionId}`);

const auditoriasDe = (caso: Caso, resultado = 'ok'): Promise<number> =>
  cuantas(sql<{ n: string }>`
    select count(*)::text as n from auditoria
     where organizacion_id = ${caso.negocio.organizacionId}
       and accion = ${ACCION} and payload ->> 'resultado' = ${resultado}`);

const clavesDe = (caso: Caso): Promise<number> =>
  cuantas(sql<{ n: string }>`
    select count(*)::text as n from comandos_ejecutados
     where organizacion_id = ${caso.negocio.organizacionId} and comando = ${ACCION}`);

async function limpiar(caso: Caso, automatica: boolean | undefined) {
  return exigirOk(
    await comando(limpiarSolicitudes, {
      entrada: automatica === undefined ? {} : { automatica },
      ambito: caso.ambito,
      idempotencyKey: clave(),
    }),
    ACCION,
  );
}

/** Hace como si la última limpieza hubiera sido hace `minutos`. */
async function envejecerLaUltimaLimpieza(caso: Caso, minutos: number): Promise<void> {
  await conTransaccion(async (tx) => {
    await sql`
      update auditoria set created_at = created_at - make_interval(mins => ${minutos})
       where organizacion_id = ${caso.negocio.organizacionId} and accion = ${ACCION}`.execute(tx);
  });
}

let caso: Caso;

beforeAll(async () => {
  caso = await sembrarCaso('Fonda de la limpieza');
});

describe('la limpieza automática, a lo mucho una vez por hora', () => {
  it('la primera vez limpia y deja su línea de auditoría', async () => {
    await sembrarSolicitudVieja(caso);

    const r = await limpiar(caso, true);

    expect(r).toEqual({ alcance: 'antiguas', borradas: 1 });
    expect(await solicitudesDe(caso)).toBe(0);
    expect(await auditoriasDe(caso)).toBe(1);
    expect(await clavesDe(caso)).toBe(1);
  });

  it('la segunda, dentro de la hora, no escribe NADA: ni borra, ni audita, ni deja clave', async () => {
    await sembrarSolicitudVieja(caso);

    const r = await limpiar(caso, true);

    expect(r).toEqual({ alcance: 'antiguas', borradas: 0, omitida: true });
    // Lo viejo sigue ahí: de verdad no corrió.
    expect(await solicitudesDe(caso)).toBe(1);
    expect(await auditoriasDe(caso)).toBe(1);
    expect(await clavesDe(caso)).toBe(1);
  });

  it('el botón del dueño (sin `automatica`) limpia aunque haya corrido hace un minuto', async () => {
    const r = await limpiar(caso, undefined);

    expect(r).toEqual({ alcance: 'antiguas', borradas: 1 });
    expect(await solicitudesDe(caso)).toBe(0);
    expect(await auditoriasDe(caso)).toBe(2);
  });

  it('`automatica: false` tampoco espera', async () => {
    await sembrarSolicitudVieja(caso);

    const r = await limpiar(caso, false);

    expect(r.borradas).toBe(1);
    expect(await auditoriasDe(caso)).toBe(3);
  });

  it('a los 59 minutos todavía no; pasada la hora, sí', async () => {
    await sembrarSolicitudVieja(caso);
    await envejecerLaUltimaLimpieza(caso, 59);

    const antes = await limpiar(caso, true);
    expect(antes.omitida).toBe(true);
    expect(await solicitudesDe(caso)).toBe(1);

    await envejecerLaUltimaLimpieza(caso, 2);

    const despues = await limpiar(caso, true);
    expect(despues).toEqual({ alcance: 'antiguas', borradas: 1 });
    expect(await solicitudesDe(caso)).toBe(0);
    expect(await auditoriasDe(caso)).toBe(4);
  });
});

describe('la última vez es la MÁS RECIENTE', () => {
  it('una limpieza vieja y otra de hace un minuto: manda la de hace un minuto', async () => {
    const otro = await sembrarCaso('Fonda de las dos limpiezas');
    await limpiar(otro, undefined);
    await limpiar(otro, undefined);
    // La primera de las dos pasa a ser de hace dos horas; la segunda sigue siendo de ahora.
    await conTransaccion(async (tx) => {
      await sql`
        update auditoria set created_at = created_at - interval '2 hours'
         where id = (select min(id) from auditoria
                      where organizacion_id = ${otro.negocio.organizacionId}
                        and accion = ${ACCION})`.execute(tx);
    });
    await sembrarSolicitudVieja(otro);

    const r = await limpiar(otro, true);

    expect(r.omitida).toBe(true);
    expect(await solicitudesDe(otro)).toBe(1);
  });
});

describe('por negocio, y sólo cuenta lo que salió bien', () => {
  it('lo que limpió un negocio no aplaza al de al lado', async () => {
    const otro = await sembrarCaso('Fonda de al lado');
    await sembrarSolicitudVieja(otro);

    const r = await limpiar(otro, true);

    expect(r).toEqual({ alcance: 'antiguas', borradas: 1 });
    expect(await auditoriasDe(otro)).toBe(1);
  });

  it('un intento DENEGADO no cuenta como limpieza: la siguiente automática sí corre', async () => {
    const otro = await sembrarCaso('Fonda con caja curiosa');
    const cajera = await sembrarCompanero(otro.negocio, { nombre: 'Carla', rol: 'cajero' });
    await sembrarSolicitudVieja(otro);

    const denegado = await comando(limpiarSolicitudes, {
      entrada: { automatica: true },
      ambito: { ...otro.ambito, rol: 'cajero', empleoId: cajera },
      idempotencyKey: clave(),
    });
    expect(denegado.ok).toBe(false);
    expect(await auditoriasDe(otro, 'denegado')).toBe(1);

    const r = await limpiar(otro, true);

    expect(r).toEqual({ alcance: 'antiguas', borradas: 1 });
    expect(await auditoriasDe(otro)).toBe(1);
  });

  it('el cerrojo por negocio HACE ESPERAR a la visita que llega con otra en curso', async () => {
    const otro = await sembrarCaso('Fonda del cerrojo');
    await sembrarSolicitudVieja(otro);
    let tomado: () => void = () => undefined;
    const yaTomado = new Promise<void>((resolver) => {
      tomado = resolver;
    });
    let soltarlo: () => void = () => undefined;
    const hastaSoltarlo = new Promise<void>((resolver) => {
      soltarlo = resolver;
    });
    // Otra visita que va a la mitad de su limpieza: tiene el cerrojo de ESTE negocio.
    const enCurso = conTransaccion(async (tx) => {
      await sql`
        select pg_advisory_xact_lock(
          hashtext(${CLASE_DE_CERROJO}::text),
          hashtext(${otro.negocio.organizacionId}::text)
        )`.execute(tx);
      tomado();
      await hastaSoltarlo;
    });
    await yaTomado;

    const automatica = limpiar(otro, true);

    // La automática se forma detrás del cerrojo (la base lo dice: un cerrojo consultivo sin
    // conceder); no corre ni escribe nada mientras la otra no termine.
    await expect
      .poll(() =>
        cuantas(sql<{ n: string }>`
          select count(*)::text as n from pg_locks
           where locktype = 'advisory' and not granted`),
      )
      .toBe(1);
    expect(await solicitudesDe(otro)).toBe(1);
    expect(await auditoriasDe(otro)).toBe(0);

    soltarlo();
    await enCurso;
    expect(await automatica).toEqual({ alcance: 'antiguas', borradas: 1 });
    expect(await auditoriasDe(otro)).toBe(1);
  });

  it('dos visitas a la vez: una limpia y la otra no (el cerrojo por negocio)', async () => {
    const otro = await sembrarCaso('Fonda de las prisas');
    await sembrarSolicitudVieja(otro);

    const [a, b] = await Promise.all([limpiar(otro, true), limpiar(otro, true)]);

    const omitidas = [a, b].filter((r) => r.omitida === true);
    expect(omitidas).toHaveLength(1);
    expect(a.borradas + b.borradas).toBe(1);
    expect(await auditoriasDe(otro)).toBe(1);
    expect(await clavesDe(otro)).toBe(1);
  });
});
