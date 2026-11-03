import { randomUUID } from 'node:crypto';

import type { Ambito } from '@morphiqpos/contracts';
import { conTransaccion, obtenerDb } from '@morphiqpos/data';
import { sql } from 'kysely';
import { describe, expect, it } from 'vitest';

import { guardarEmpleado } from '../identidad/empleados.ts';
import { comando } from '../produccion.ts';
import { clave, exigirOk } from '../pruebas/negocio-real.ts';
import { purgarVentas } from './comandos.ts';
import { claveDePlataforma } from './clave-de-plataforma.ts';
import { MAXIMO_DE_PLATAFORMA, leerEsDePlataforma, marcarPlataforma } from './plataforma.ts';
import { quitarPlataforma } from './plataforma-cambios.ts';
import { marcaGuardada, negocioConDuenos } from './pruebas/duenos.ts';

/**
 * DP-13.3b · QUITAR, REEMPLAZAR Y PERDER LA MARCA DE PLATAFORMA, contra Postgres real.
 *
 * Hasta ahora la marca sólo se ponía: quien dejaba Morphiq, o cuyo empleo se desactivaba, seguía
 * en la lista para siempre, y con él los botones que borran el negocio entero.
 */

const NOMBRE = 'Fonda de las marcas';
const confirmada = { confirmacionNombreNegocio: NOMBRE };

const marcar = async (ambito: Ambito) =>
  exigirOk(
    await comando(marcarPlataforma, { ambito, entrada: {}, idempotencyKey: clave() }),
    'mantenimiento.marcar_plataforma',
  );

async function sinPermiso(promesa: ReturnType<typeof comando>): Promise<void> {
  const r = await promesa;
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.error.codigo).toBe('SIN_PERMISO');
}

const puedePurgar = (ambito: Ambito) =>
  comando(purgarVentas, { ambito, entrada: confirmada, idempotencyKey: clave() });

describe('quitar y reemplazar la marca', () => {
  it('quien es de plataforma se la quita a sí mismo, y pierde los botones', async () => {
    const { negocio, duenos } = await negocioConDuenos(NOMBRE, 1);
    const [yo] = duenos;
    if (yo === undefined) throw new Error('Faltó el dueño.');
    await marcar(yo);

    const r = exigirOk(
      await comando(quitarPlataforma, {
        ambito: yo,
        entrada: { empleado: yo.empleoId },
        idempotencyKey: clave(),
      }),
      'mantenimiento.quitar_plataforma',
    );
    expect(r).toMatchObject({ quitada: true, reemplazadoPor: null, empleos: 0 });
    expect(await leerEsDePlataforma(negocio.organizacionId, yo.empleoId)).toBe(false);
    await sinPermiso(puedePurgar(yo));
  });

  it('reemplazar pasa la marca al otro dueño en la misma transacción', async () => {
    const { negocio, duenos } = await negocioConDuenos(NOMBRE, 2);
    const [viejo, nuevo] = duenos;
    if (viejo === undefined || nuevo === undefined) throw new Error('Faltaron los dueños.');
    await marcar(viejo);

    const r = exigirOk(
      await comando(quitarPlataforma, {
        ambito: viejo,
        entrada: { empleado: viejo.empleoId, reemplazarPor: nuevo.empleoId },
        idempotencyKey: clave(),
      }),
      'mantenimiento.quitar_plataforma',
    );
    expect(r).toMatchObject({ quitada: true, reemplazadoPor: nuevo.empleoId, empleos: 1 });
    expect((await marcaGuardada(negocio.organizacionId)).empleos).toEqual([nuevo.empleoId]);
    await sinPermiso(puedePurgar(viejo));
    exigirOk(await puedePurgar(nuevo), 'purgar como el reemplazo');
  });

  it('un dueño sin la marca no la quita ni se la pasa a sí mismo', async () => {
    const { negocio, duenos } = await negocioConDuenos(NOMBRE, 2);
    const [conMarca, sinMarca] = duenos;
    if (conMarca === undefined || sinMarca === undefined) throw new Error('Faltaron los dueños.');
    await marcar(conMarca);

    // Ni quitarle la marca a otro, ni —aprovechando el reemplazo— ponérsela a sí mismo.
    await sinPermiso(
      comando(quitarPlataforma, {
        ambito: sinMarca,
        entrada: { empleado: conMarca.empleoId },
        idempotencyKey: clave(),
      }),
    );
    await sinPermiso(
      comando(quitarPlataforma, {
        ambito: sinMarca,
        entrada: { empleado: conMarca.empleoId, reemplazarPor: sinMarca.empleoId },
        idempotencyKey: clave(),
      }),
    );
    expect((await marcaGuardada(negocio.organizacionId)).empleos).toEqual([conMarca.empleoId]);
  });

  it('el reemplazo tiene que ser un dueño activo de ESTE negocio; si no, nada cambia', async () => {
    const { negocio, duenos } = await negocioConDuenos(NOMBRE, 2);
    const ajeno = await negocioConDuenos('Fonda ajena', 1);
    const [yo, otro] = duenos;
    const delAjeno = ajeno.duenos[0];
    if (yo === undefined || otro === undefined || delAjeno === undefined) {
      throw new Error('Faltaron los dueños.');
    }
    await marcar(yo);
    await obtenerDb()
      .updateTable('empleos')
      .set({ activo: false })
      .where('id', '=', otro.empleoId)
      .execute();

    for (const reemplazarPor of [otro.empleoId, delAjeno.empleoId]) {
      const r = await comando(quitarPlataforma, {
        ambito: yo,
        entrada: { empleado: yo.empleoId, reemplazarPor },
        idempotencyKey: clave(),
      });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.datos?.['regla']).toBe('ACCESO_NO_ENCONTRADO');
    }
    expect((await marcaGuardada(negocio.organizacionId)).empleos).toEqual([yo.empleoId]);
  });
});

describe('un empleo desactivado pierde la marca', () => {
  it('al desactivarlo se quita de la lista en la misma transacción, y reactivarlo no la devuelve', async () => {
    const { negocio, duenos } = await negocioConDuenos(NOMBRE, 2);
    const [yo, otro] = duenos;
    if (yo === undefined || otro === undefined) throw new Error('Faltaron los dueños.');
    await marcar(yo);
    await marcar(otro);
    expect((await marcaGuardada(negocio.organizacionId)).empleos).toHaveLength(2);

    const edicion = (activo: boolean) =>
      comando(guardarEmpleado, {
        ambito: yo,
        entrada: { empleado: otro.empleoId, nombre: 'Dueño 2', puesto: 'dueno', activo },
        idempotencyKey: clave(),
      });
    exigirOk(await edicion(false), 'identidad.guardar_empleado (desactivar)');
    expect((await marcaGuardada(negocio.organizacionId)).empleos).toEqual([yo.empleoId]);

    exigirOk(await edicion(true), 'identidad.guardar_empleado (reactivar)');
    expect(await leerEsDePlataforma(negocio.organizacionId, otro.empleoId)).toBe(false);
    expect((await marcaGuardada(negocio.organizacionId)).empleos).toEqual([yo.empleoId]);
  });

  it('aunque la marca siga escrita, un empleo inactivo ya no es de plataforma (falla cerrado)', async () => {
    const { negocio, duenos } = await negocioConDuenos(NOMBRE, 1);
    const [yo] = duenos;
    if (yo === undefined) throw new Error('Faltó el dueño.');
    await marcar(yo);
    // Por fuera del comando (SQL suelto, una importación, un reseteo): la marca queda en el
    // documento. Ni la sesión ni los cinco comandos le creen.
    await obtenerDb()
      .updateTable('empleos')
      .set({ activo: false })
      .where('id', '=', yo.empleoId)
      .execute();

    expect((await marcaGuardada(negocio.organizacionId)).empleos).toEqual([yo.empleoId]);
    expect(await leerEsDePlataforma(negocio.organizacionId, yo.empleoId)).toBe(false);
    await sinPermiso(puedePurgar(yo));
  });
});

describe('el tope de la lista', () => {
  it('no deja marcar al empleo 21: la marca entera dejaría de leerse y TODOS la perderían', async () => {
    const { negocio, duenos } = await negocioConDuenos(NOMBRE, 1);
    const [yo] = duenos;
    if (yo === undefined) throw new Error('Faltó el dueño.');
    const org = negocio.organizacionId;
    const llena = Array.from({ length: MAXIMO_DE_PLATAFORMA }, () => randomUUID());
    await conTransaccion(async (tx) => {
      await sql`
        insert into configuracion (organizacion_id, valores)
        values (${org}, ${JSON.stringify({ plataforma: { empleos: llena } })}::jsonb)
        on conflict (organizacion_id) do update set valores = configuracion.valores || excluded.valores
      `.execute(tx);
    });

    const r = await comando(marcarPlataforma, {
      ambito: yo,
      entrada: {},
      idempotencyKey: clave(),
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.datos?.['regla']).toBe('CONFIGURACION_INVALIDA');
    expect((await marcaGuardada(org)).empleos).toEqual(llena);
  });
});

describe('la clave de idempotencia del guion', () => {
  it('marcar, quitar y volver a marcar marca de verdad la tercera vez', async () => {
    const { negocio, duenos } = await negocioConDuenos(NOMBRE, 1);
    const [yo] = duenos;
    if (yo === undefined) throw new Error('Faltó el dueño.');
    const org = negocio.organizacionId;

    // Lo que hace el guion: leer lista y versión, calcular la clave, ejecutar con ella.
    const marcarComoElGuion = async () => {
      const { empleos, version } = await marcaGuardada(org);
      const idempotencyKey = claveDePlataforma({
        accion: 'marcar',
        organizacionId: org,
        empleoId: yo.empleoId,
        antes: empleos,
        version,
      });
      return exigirOk(
        await comando(marcarPlataforma, { ambito: yo, entrada: {}, idempotencyKey }),
        'mantenimiento.marcar_plataforma',
      );
    };

    expect(await marcarComoElGuion()).toMatchObject({ yaLoEra: false });
    exigirOk(
      await comando(quitarPlataforma, {
        ambito: yo,
        entrada: { empleado: yo.empleoId },
        idempotencyKey: clave(),
      }),
      'mantenimiento.quitar_plataforma',
    );
    expect(await leerEsDePlataforma(org, yo.empleoId)).toBe(false);

    // La tercera: con la clave de antes (sólo org y empleo) habría devuelto la respuesta guardada
    // de la primera sin marcar nada.
    expect(await marcarComoElGuion()).toMatchObject({ yaLoEra: false });
    expect(await leerEsDePlataforma(org, yo.empleoId)).toBe(true);
  });
});
