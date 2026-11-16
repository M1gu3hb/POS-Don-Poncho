import type { Ambito } from '@morphiqpos/contracts';
import { conTransaccion, obtenerDb } from '@morphiqpos/data';
import { sql } from 'kysely';
import { beforeAll, describe, expect, it } from 'vitest';

import { comando } from '../produccion.ts';
import { clave, exigirOk, sembrarCompanero } from '../pruebas/negocio-real.ts';
import {
  ambitoDeCaja,
  sembrarSalon,
  sentarYPedir,
  type Salon,
} from '../restaurante/pruebas/salon-real.ts';
import {
  purgarSeccionDelHistorico,
  purgarVentas,
  reiniciarPruebas,
  reiniciarTodo,
} from './comandos.ts';
import { reiniciarFolios } from './en-ceros.ts';
import {
  activarOperacion,
  exigirQueNoHayaOperacionReal,
  quitarBloqueoDeOperacion,
} from './operacion-real.ts';
import { dueñoDePlataforma } from './pruebas/dia-completo.ts';

/**
 * DP-21 · Bloque 6 · H1 · EL BLOQUEO DESPUÉS DEL ARRANQUE, contra Postgres.
 *
 * Mientras no hay `operacion_desde`, todo se borra como siempre. Activada la operación, UNA sola
 * cuenta creada después hace que nadie pueda purgar ventas ni cortes, reiniciar folios o las
 * pruebas, ni (con el guion) dejar en ceros; sólo el dueño, con el nombre del negocio, lo quita, y
 * la auditoría guarda la fecha que tenía.
 */

const POR_COMANDOS = 120_000;
const YA_OPERA = /ya opera desde el .*cuenta.*real.*Lo cobrado ya no se borra/;

let salon: Salon;
let plataforma: Ambito;
let dueno: Ambito;
let gerente: Ambito;
let nombre = '';
const org = () => salon.negocio.organizacionId;

beforeAll(async () => {
  salon = await sembrarSalon({ nombre: 'Fonda del Arranque', mesas: 4, terminales: 1 });
  plataforma = await dueñoDePlataforma(salon);
  const gerenteId = await sembrarCompanero(salon.negocio, { nombre: 'La Gerente', rol: 'gerente' });
  const duenoId = await sembrarCompanero(salon.negocio, { nombre: 'Don Poncho', rol: 'dueno' });
  gerente = { ...ambitoDeCaja(salon), rol: 'gerente', empleoId: gerenteId };
  dueno = { ...ambitoDeCaja(salon), rol: 'dueno', empleoId: duenoId };
  nombre = (
    await obtenerDb()
      .selectFrom('organizaciones')
      .select('nombre')
      .where('id', '=', org())
      .executeTakeFirstOrThrow()
  ).nombre;
}, POR_COMANDOS);

const cuentas = async () =>
  Number(
    (
      await obtenerDb()
        .selectFrom('ordenes')
        .select((eb) => eb.fn.countAll<string>().as('n'))
        .where('organizacion_id', '=', org())
        .executeTakeFirstOrThrow()
    ).n,
  );

const operacionDesde = async () =>
  (
    (
      await obtenerDb()
        .selectFrom('configuracion')
        .select('valores')
        .where('organizacion_id', '=', org())
        .executeTakeFirst()
    )?.valores as { operacion_desde?: unknown } | undefined
  )?.operacion_desde;

const destructivos = (n: string) => ({ confirmacionNombreNegocio: n });
const activar = (ambito: Ambito) =>
  comando(activarOperacion, { ambito, entrada: {}, idempotencyKey: clave() });

describe('activar la operación', () => {
  it('sólo el dueño de plataforma: el dueño del restaurante y la gerente no', async () => {
    for (const quien of [dueno, gerente]) {
      expect((await activar(quien)).ok).toBe(false);
    }
    expect(await operacionDesde()).toBeUndefined();
  });

  it('antes de activarla, todo se borra como siempre (aun con cuentas)', async () => {
    await sentarYPedir(salon, 0, [{ platillo: 'arrachera', cantidad: '1' }]);
    expect(await cuentas()).toBe(1);
    exigirOk(
      await comando(purgarVentas, {
        ambito: plataforma,
        entrada: { ...destructivos(nombre), revertirInventario: true },
        idempotencyKey: clave(),
      }),
      'purgar sin operación',
    );
    expect(await cuentas()).toBe(0);
  });

  it('guarda la hora del servidor, y activarla otra vez no la mueve', async () => {
    const antes = Date.now();
    const primera = exigirOk(await activar(plataforma), 'activar');
    expect(primera.yaEstaba).toBe(false);
    const guardada = await operacionDesde();
    expect(guardada).toBe(primera.desde);
    expect(Math.abs(new Date(String(guardada)).getTime() - antes)).toBeLessThan(60_000);

    const segunda = exigirOk(await activar(plataforma), 'activar otra vez');
    expect(segunda).toEqual({ desde: primera.desde, yaEstaba: true });
    expect(await operacionDesde()).toBe(primera.desde);
  });
});

describe('con la operación activa', () => {
  it('sin una sola cuenta posterior, nada estorba; una cuenta anterior no cuenta', async () => {
    await expect(
      conTransaccion((tx) => exigirQueNoHayaOperacionReal(tx, org(), new Date())),
    ).resolves.toBeUndefined();
  });

  it(
    'con UNA cuenta posterior, todo lo que borra ventas o cortes o reinicia folios se niega',
    { timeout: POR_COMANDOS },
    async () => {
      await sentarYPedir(salon, 1, [{ platillo: 'arrachera', cantidad: '1' }]);
      const n = destructivos(nombre);
      const intentos = [
        [
          'purgar_ventas',
          () =>
            comando(purgarVentas, {
              ambito: plataforma,
              entrada: { ...n, revertirInventario: false },
              idempotencyKey: clave(),
            }),
        ],
        [
          'purgar_seccion ventas',
          () =>
            comando(purgarSeccionDelHistorico, {
              ambito: plataforma,
              entrada: { ...n, seccion: 'ventas' },
              idempotencyKey: clave(),
            }),
        ],
        [
          'purgar_seccion cortes',
          () =>
            comando(purgarSeccionDelHistorico, {
              ambito: plataforma,
              entrada: { ...n, seccion: 'cortes' },
              idempotencyKey: clave(),
            }),
        ],
        [
          'reiniciar_pruebas',
          () =>
            comando(reiniciarPruebas, { ambito: plataforma, entrada: n, idempotencyKey: clave() }),
        ],
        [
          'reiniciar_todo',
          () => comando(reiniciarTodo, { ambito: plataforma, entrada: n, idempotencyKey: clave() }),
        ],
        [
          'reiniciar_folios',
          () =>
            comando(reiniciarFolios, { ambito: plataforma, entrada: n, idempotencyKey: clave() }),
        ],
      ] as const;
      for (const [que, intentar] of intentos) {
        const r = await intentar();
        expect(r.ok, que).toBe(false);
        if (!r.ok) expect(r.error.mensaje, que).toMatch(YA_OPERA);
      }
      expect(await cuentas()).toBe(1);
      // Lo que no borra lo cobrado sigue permitido: las compras no son ventas.
      exigirOk(
        await comando(purgarSeccionDelHistorico, {
          ambito: plataforma,
          entrada: { ...n, seccion: 'compras' },
          idempotencyKey: clave(),
        }),
        'purgar compras',
      );
    },
  );

  it('dice cuántas: con dos cuentas, «2 cuentas reales»', async () => {
    await sentarYPedir(salon, 2, [{ platillo: 'arrachera', cantidad: '1' }]);
    const r = await comando(reiniciarFolios, {
      ambito: plataforma,
      entrada: destructivos(nombre),
      idempotencyKey: clave(),
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.mensaje).toMatch(/hay 2 cuentas reales/);
  });

  it('una fecha dañada falla CERRADA: con cuentas, se niega', async () => {
    const buena = await operacionDesde();
    await conTransaccion((tx) =>
      sql`update configuracion
             set valores = jsonb_set(valores, '{operacion_desde}', '"ayer"')
           where organizacion_id = ${org()}`.execute(tx),
    );
    await expect(
      conTransaccion((tx) => exigirQueNoHayaOperacionReal(tx, org(), new Date())),
    ).rejects.toThrow(YA_OPERA);
    await conTransaccion((tx) =>
      sql`update configuracion
             set valores = jsonb_set(valores, '{operacion_desde}', to_jsonb(${String(buena)}::text))
           where organizacion_id = ${org()}`.execute(tx),
    );
  });
});

describe('quitar el bloqueo', () => {
  it('sólo el dueño, y escribiendo el nombre del negocio', async () => {
    const mal = await comando(quitarBloqueoDeOperacion, {
      ambito: dueno,
      entrada: destructivos('Otro negocio'),
      idempotencyKey: clave(),
    });
    expect(mal.ok).toBe(false);
    const gerenteNo = await comando(quitarBloqueoDeOperacion, {
      ambito: gerente,
      entrada: destructivos(nombre),
      idempotencyKey: clave(),
    });
    expect(gerenteNo.ok).toBe(false);
    expect(await operacionDesde()).toBeDefined();
  });

  it(
    'el dueño la quita, la auditoría guarda la fecha que tenía y entonces se puede purgar',
    { timeout: POR_COMANDOS },
    async () => {
      const tenia = await operacionDesde();
      const r = exigirOk(
        await comando(quitarBloqueoDeOperacion, {
          ambito: dueno,
          entrada: destructivos(nombre),
          idempotencyKey: clave(),
        }),
        'quitar',
      );
      expect(r.teniaDesde).toBe(tenia);
      expect(await operacionDesde()).toBeNull();

      const filas = await obtenerDb()
        .selectFrom('auditoria')
        .select('payload')
        .where('organizacion_id', '=', org())
        .where('accion', '=', 'mantenimiento.quitar_bloqueo_de_operacion')
        .execute();
      expect(filas.map((f) => (f.payload as { teniaDesde?: unknown }).teniaDesde)).toContain(tenia);

      exigirOk(
        await comando(purgarVentas, {
          ambito: plataforma,
          entrada: { ...destructivos(nombre), revertirInventario: true },
          idempotencyKey: clave(),
        }),
        'purgar sin el bloqueo',
      );
      expect(await cuentas()).toBe(0);
    },
  );
});
