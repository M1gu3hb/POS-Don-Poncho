import { randomUUID } from 'node:crypto';

import type { Ambito } from '@morphiqpos/contracts';
import { conTransaccion, obtenerDb } from '@morphiqpos/data';
import { beforeAll, describe, expect, it } from 'vitest';

import { sembrarUnDia, type DiaSembrado } from '../mantenimiento/pruebas/dia-completo.ts';
import { renombrarAparatos } from '../mantenimiento/renombrar-aparatos.ts';
import { comando } from '../produccion.ts';
import { clave, exigirOk, sembrarCompanero } from '../pruebas/negocio-real.ts';
import { ambitoDeCaja, sembrarSalon, type Salon } from '../restaurante/pruebas/salon-real.ts';
import { porQueYaNoSeCobra } from '../venta/ya-cobrada.ts';
import { estadoDeCaja } from './consulta.ts';
import { nombrarCajas } from './lugares.ts';
import { abrirCaja, cerrarCaja } from './sesion.ts';
import { traerCaja } from './traer.ts';

/**
 * DP-21 · Bloque 5 · LAS CAJAS CON NOMBRE FIJO, contra Postgres (M1 y O9).
 *
 * «Las cajas se suman (Caja 28, Caja 32, Caja 37…). Deben ser 1 o 2 fijas, que se trasladen, y
 * mejor con nombre.» La caja es un lugar de la sucursal; el aparato sólo la tiene abierta.
 *
 *   · con cupo 1: abrir en el aparato A y entrar desde el B ofrece TRAERLA, no una segunda;
 *   · con cupo 2: el B abre la Caja 2; un tercer aparato sólo puede traer;
 *   · el nombre viaja con la caja al trasladarla, y no cambia por el aparato;
 *   · dos aparatos no abren el mismo lugar ni en el mismo instante;
 *   · los aparatos «Caja N» de antes pasan a «Aparato N» por un comando con su auditoría.
 */

const POR_COMANDOS = 180_000;

let salon: Salon;
let dueno: Ambito;
let cajera: Ambito;

const fijarCupo = (cupo: number) =>
  obtenerDb()
    .updateTable('sucursales')
    .set({ cajas_simultaneas: cupo })
    .where('organizacion_id', '=', salon.negocio.organizacionId)
    .execute();

const estado = async (aparato: number) =>
  exigirOk(
    await comando(estadoDeCaja, {
      entrada: {},
      ambito: ambitoDeCaja(salon, aparato),
      idempotencyKey: clave(),
    }),
    'caja.estado',
  );

const abrir = (aparato: number, lugar?: number) =>
  comando(abrirCaja, {
    entrada: { fondoInicialCentavos: 50_000, ...(lugar === undefined ? {} : { lugar }) },
    ambito: ambitoDeCaja(salon, aparato),
    idempotencyKey: clave(),
  });

const traer = async (aparato: number, sesionCajaId: string) =>
  exigirOk(
    await comando(traerCaja, {
      entrada: { sesionCajaId },
      ambito: ambitoDeCaja(salon, aparato),
      idempotencyKey: clave(),
    }),
    'caja.traer',
  );

const cerrarLaDe = async (aparato: number) =>
  exigirOk(
    await comando(cerrarCaja, {
      entrada: { efectivoContadoCentavos: 50_000 },
      ambito: ambitoDeCaja(salon, aparato),
      idempotencyKey: clave(),
    }),
    'caja.cerrar',
  );

/** Cierra, con el comando de verdad, las cajas abiertas del salón: cada caso empieza sin ninguna. */
async function cerrarTodas(): Promise<void> {
  const abiertas = await obtenerDb()
    .selectFrom('sesiones_caja')
    .select('terminal_id')
    .where('organizacion_id', '=', salon.negocio.organizacionId)
    .where('estado', '=', 'abierta')
    .execute();
  for (const sesion of abiertas) {
    await cerrarLaDe(salon.sucursal.terminales.indexOf(sesion.terminal_id));
  }
}

beforeAll(async () => {
  // Cuatro aparatos; el salón los siembra como «Caja 1»…«Caja 4», que es como se llamaban.
  salon = await sembrarSalon({ nombre: 'Fonda de las cajas', mesas: 1, terminales: 4 });
  const duenoId = await sembrarCompanero(salon.negocio, { nombre: 'Don Poncho', rol: 'dueno' });
  const cajeraId = await sembrarCompanero(salon.negocio, { nombre: 'La Cajera', rol: 'cajero' });
  dueno = { ...ambitoDeCaja(salon), rol: 'dueno', empleoId: duenoId };
  cajera = { ...ambitoDeCaja(salon), rol: 'cajero', empleoId: cajeraId };
}, POR_COMANDOS);

describe('caja.nombrar_cajas', () => {
  it(
    'el dueño le pone nombre a cada lugar; la cajera no; dos no se llaman igual',
    { timeout: POR_COMANDOS },
    async () => {
      const nombrar = (ambito: Ambito, nombres: string[]) =>
        comando(nombrarCajas, { entrada: { nombres }, ambito, idempotencyKey: clave() });
      expect((await nombrar(cajera, ['Caja principal'])).ok).toBe(false);
      expect((await nombrar(dueno, ['Barra', 'barra'])).ok).toBe(false);
      expect(exigirOk(await nombrar(dueno, ['Caja principal', '']), 'nombrar cajas')).toEqual({
        nombres: ['Caja principal', null],
      });
    },
  );
});

describe('con una sola caja (cupo 1)', () => {
  it(
    'el aparato A la abre; el B no abre otra: se le ofrece traerla, y el nombre viaja con ella',
    { timeout: POR_COMANDOS },
    async () => {
      await cerrarTodas();
      await fijarCupo(1);
      const abierta = exigirOk(await abrir(0), 'caja.abrir en A');
      expect(abierta).toMatchObject({ lugar: 1, nombreDeLaCaja: 'Caja principal' });

      const desdeB = await estado(1);
      expect(desdeB.abierta).toBe(false);
      expect(desdeB.puedoAbrir).toBe(false);
      expect(desdeB.lugaresLibres).toEqual([]);
      expect(desdeB.otrasCajas).toHaveLength(1);
      expect(desdeB.otrasCajas?.[0]).toMatchObject({
        lugar: 1,
        nombreDeLaCaja: 'Caja principal',
        terminalNombre: 'Caja 1',
        puedoTraerla: true,
      });
      // Abrir de todos modos no crea una segunda (ni una tercera): se niega.
      expect((await abrir(1)).ok).toBe(false);

      await traer(1, abierta.sesionCajaId);
      const enB = await estado(1);
      expect(enB).toMatchObject({ abierta: true, lugar: 1, nombreDeLaCaja: 'Caja principal' });
      expect((await estado(0)).abierta).toBe(false);
    },
  );
});

describe('con dos cajas (cupo 2)', () => {
  it(
    'el B abre la Caja 2; un tercer aparato sólo puede traer; al cerrar la 1, ése es el lugar libre',
    { timeout: POR_COMANDOS },
    async () => {
      await cerrarTodas();
      await fijarCupo(2);
      const primera = exigirOk(await abrir(0), 'caja.abrir en A');
      expect(primera.lugar).toBe(1);

      const antesDeAbrir = await estado(1);
      expect(antesDeAbrir.lugaresLibres).toEqual([{ lugar: 2, nombre: 'Caja 2' }]);
      const segunda = exigirOk(await abrir(1), 'caja.abrir en B');
      expect(segunda).toMatchObject({ lugar: 2, nombreDeLaCaja: 'Caja 2' });

      const tercero = await estado(2);
      expect(tercero.puedoAbrir).toBe(false);
      expect(tercero.lugaresLibres).toEqual([]);
      expect(tercero.otrasCajas?.map((c) => c.nombreDeLaCaja).sort()).toEqual([
        'Caja 2',
        'Caja principal',
      ]);
      expect((await abrir(2)).ok).toBe(false);

      // La Caja 2 se va al tercer aparato: sigue siendo la Caja 2.
      await traer(2, segunda.sesionCajaId);
      expect(await estado(2)).toMatchObject({ abierta: true, lugar: 2, nombreDeLaCaja: 'Caja 2' });

      // Se cierra la principal: el lugar libre es el 1, y quien abre lo toma.
      await cerrarLaDe(0);
      expect((await estado(3)).lugaresLibres).toEqual([{ lugar: 1, nombre: 'Caja principal' }]);
      expect(exigirOk(await abrir(3), 'caja.abrir en el cuarto').lugar).toBe(1);
    },
  );

  it(
    'se puede pedir un lugar libre, y uno ocupado o inexistente se niega',
    { timeout: POR_COMANDOS },
    async () => {
      await cerrarTodas();
      await fijarCupo(2);
      expect(exigirOk(await abrir(0, 2), 'abrir pidiendo la 2').lugar).toBe(2);
      expect((await abrir(1, 2)).ok).toBe(false);
      expect((await abrir(1, 3)).ok).toBe(false);
      expect(exigirOk(await abrir(1, 1), 'abrir pidiendo la 1').lugar).toBe(1);
    },
  );

  it(
    'dos aparatos que abren en el mismo instante no se quedan con el mismo lugar',
    { timeout: POR_COMANDOS },
    async () => {
      for (let vuelta = 0; vuelta < 10; vuelta += 1) {
        await cerrarTodas();
        const [a, b] = await Promise.all([abrir(0), abrir(1)]);
        for (const resultado of [a, b]) {
          if (!resultado.ok) expect(resultado.error.codigo).not.toBe('ERROR_INTERNO');
        }
        const abiertas = await obtenerDb()
          .selectFrom('sesiones_caja')
          .select('lugar')
          .where('organizacion_id', '=', salon.negocio.organizacionId)
          .where('estado', '=', 'abierta')
          .execute();
        const lugares = abiertas.map((s) => s.lugar);
        expect(new Set(lugares).size).toBe(lugares.length);
        expect(lugares.every((lugar) => lugar === 1 || lugar === 2)).toBe(true);
      }
    },
  );
});

describe('el nombre es de la caja, no del aparato', () => {
  it(
    '20 aparatos nuevos entran y ninguna caja cambia de nombre',
    { timeout: POR_COMANDOS },
    async () => {
      await cerrarTodas();
      await fijarCupo(2);
      const abierta = exigirOk(await abrir(0), 'caja.abrir');
      const antes = await estado(0);
      // Veinte aparatos más en la sucursal, como los que crea cada navegador al entrar.
      await conTransaccion(async (tx) => {
        for (let n = 1; n <= 20; n += 1) {
          await tx
            .insertInto('terminales')
            .values({
              id: randomUUID(),
              organizacion_id: salon.negocio.organizacionId,
              sucursal_id: salon.sucursal.sucursalId,
              nombre: `Aparato ${String(100 + n)}`,
            })
            .execute();
        }
      });
      const despues = await estado(0);
      expect(despues.nombreDeLaCaja).toBe(antes.nombreDeLaCaja);
      expect(despues.nombreDeLaCaja).toBe('Caja principal');
      expect(despues.sesionCajaId).toBe(abierta.sesionCajaId);
      // Y desde otro aparato se sigue llamando igual.
      expect((await estado(3)).otrasCajas?.[0]?.nombreDeLaCaja).toBe('Caja principal');
    },
  );

  it('«Ya se cobró en Caja principal»: dice la caja, no el aparato', async () => {
    const sesion = await obtenerDb()
      .selectFrom('sesiones_caja')
      .select('id')
      .where('organizacion_id', '=', salon.negocio.organizacionId)
      .where('estado', '=', 'abierta')
      .executeTakeFirstOrThrow();
    const ordenId = randomUUID();
    await conTransaccion((tx) =>
      tx
        .insertInto('ordenes')
        .values({
          id: ordenId,
          organizacion_id: salon.negocio.organizacionId,
          sucursal_id: salon.sucursal.sucursalId,
          sesion_caja_id: sesion.id,
          estado: 'borrador',
        })
        .execute(),
    );
    const mensaje = await conTransaccion((tx) =>
      porQueYaNoSeCobra(tx, salon.negocio.organizacionId, ordenId, 'pagada'),
    );
    expect(mensaje).toBe('Ya se cobró en Caja principal.');
  });
});

describe('mantenimiento.renombrar_aparatos', () => {
  let dia: DiaSembrado;
  let nombre = '';

  beforeAll(async () => {
    dia = await sembrarUnDia('Fonda de los aparatos');
    nombre = (
      await obtenerDb()
        .selectFrom('organizaciones')
        .select('nombre')
        .where('id', '=', dia.salon.negocio.organizacionId)
        .executeTakeFirstOrThrow()
    ).nombre;
  }, POR_COMANDOS);

  const nombresDeLosAparatos = async () =>
    (
      await obtenerDb()
        .selectFrom('terminales')
        .select('nombre')
        .where('organizacion_id', '=', dia.salon.negocio.organizacionId)
        .orderBy('nombre')
        .execute()
    ).map((t) => t.nombre);

  it(
    '«Caja N» pasa a «Aparato N»; uno con nombre propio no se toca; queda en la auditoría',
    { timeout: POR_COMANDOS },
    async () => {
      const org = dia.salon.negocio.organizacionId;
      const sucursal = dia.salon.sucursal.sucursalId;
      await conTransaccion(async (tx) => {
        for (const nombreDelAparato of ['Caja 33', 'iMin mostrador', 'Caja 90', 'Aparato 90']) {
          await tx
            .insertInto('terminales')
            .values({
              id: randomUUID(),
              organizacion_id: org,
              sucursal_id: sucursal,
              nombre: nombreDelAparato,
            })
            .execute();
        }
      });
      const antes = await nombresDeLosAparatos();
      const cuantasCajas = antes.filter((n) => /^Caja \d+$/.test(n)).length;

      // Sólo el dueño de plataforma, y con el nombre del negocio.
      const sinConfirmar = await comando(renombrarAparatos, {
        entrada: { confirmacionNombreNegocio: 'Otro negocio' },
        ambito: dia.plataforma,
        idempotencyKey: clave(),
      });
      expect(sinConfirmar.ok).toBe(false);
      expect(await nombresDeLosAparatos()).toEqual(antes);

      const hecho = exigirOk(
        await comando(renombrarAparatos, {
          entrada: { confirmacionNombreNegocio: nombre },
          ambito: dia.plataforma,
          idempotencyKey: clave(),
        }),
        'mantenimiento.renombrar_aparatos',
      );
      // «Caja 90» se queda: su «Aparato 90» ya existía en la sucursal.
      expect(hecho).toMatchObject({ renombrados: cuantasCajas - 1, omitidos: 1 });
      const despues = await nombresDeLosAparatos();
      expect(despues).toContain('Aparato 33');
      expect(despues).toContain('iMin mostrador');
      expect(despues).toContain('Caja 90');
      expect(despues.filter((n) => /^Caja \d+$/.test(n))).toEqual(['Caja 90']);
      expect(despues).toHaveLength(antes.length);

      const rastro = await obtenerDb()
        .selectFrom('auditoria')
        .select('payload')
        .where('organizacion_id', '=', org)
        .where('accion', '=', 'mantenimiento.renombrar_aparatos')
        .execute();
      expect(
        rastro.some(
          (f) => (f.payload as { renombrados?: number }).renombrados === cuantasCajas - 1,
        ),
      ).toBe(true);

      // Una segunda corrida no cambia nada.
      const otraVez = exigirOk(
        await comando(renombrarAparatos, {
          entrada: { confirmacionNombreNegocio: nombre },
          ambito: dia.plataforma,
          idempotencyKey: clave(),
        }),
        'segunda corrida',
      );
      expect(otraVez.renombrados).toBe(0);
    },
  );
});
