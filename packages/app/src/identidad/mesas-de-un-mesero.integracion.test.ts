import { randomUUID } from 'node:crypto';

import type { Rol } from '@morphiqpos/contracts';
import { conTransaccion, obtenerDb } from '@morphiqpos/data';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { comando } from '../produccion.ts';
import {
  ambitoDe,
  clave,
  exigirOk,
  sembrarCompanero,
  sembrarNegocio,
  sembrarSucursal,
  type NegocioReal,
} from '../pruebas/negocio-real.ts';
import { repartirMesas } from '../restaurante/repartir-mesas.ts';
import { guardarEmpleado } from './empleados.ts';

/**
 * LAS MESAS DE UN MESERO · contra Postgres (DP-14, ronda 2, medio 7).
 *
 * Desactivar a un mesero suelta sus mesas (si no, con la asignación activa nadie las veía) y
 * «Repartir mesas» asigna varias de una vez, entero o nada, con su auditoría. Va aparte de
 * `usuarios-del-negocio.integracion.test.ts` para que cada archivo quede corto.
 */

const PIMIENTA = 'pimienta_de_integracion_de_los_usuarios_2026';
vi.mock('@morphiqpos/contracts', async (original) => ({
  ...(await original<typeof import('@morphiqpos/contracts')>()),
  validarEntorno: () => ({ PIN_PEPPER: PIMIENTA }),
}));

let dueno: NegocioReal;
let sucursalId: string;

beforeAll(async () => {
  dueno = await sembrarNegocio({
    nombre: 'Fonda de los usuarios',
    rol: 'dueno',
    giro: 'restaurante',
    paquete: 'restaurante',
  });
  sucursalId = (await sembrarSucursal(dueno, { terminales: ['Caja 1'] })).sucursalId;
});

const como = (negocio: NegocioReal, rol: Rol, empleoId = negocio.empleoId): NegocioReal => ({
  ...negocio,
  rol,
  empleoId,
});

function guardar(quien: NegocioReal, entrada: Record<string, unknown>) {
  return comando(guardarEmpleado, {
    entrada: {
      nombre: 'Nombre',
      telefono: null,
      color: null,
      estacionPreparacionId: null,
      veTodasLasEstaciones: false,
      activo: true,
      ...entrada,
    },
    ambito: ambitoDe(quien, sucursalId, null),
    idempotencyKey: clave(),
  });
}

async function fila(empleoId: string) {
  return obtenerDb()
    .selectFrom('empleos')
    .innerJoin('personas', 'personas.id', 'empleos.persona_id')
    .select(['empleos.rol', 'empleos.activo', 'empleos.color', 'personas.nombre'])
    .where('empleos.id', '=', empleoId)
    .executeTakeFirstOrThrow();
}

/** Da de alta a alguien con PIN por el mismo comando que usa la pantalla. */
async function altaCon(puesto: string, nombre: string, pin: string, color: string | null = null) {
  const salida = exigirOk(await guardar(dueno, { nombre, puesto, pin, color }), `alta ${puesto}`);
  return salida.empleoId;
}

describe('las mesas de un mesero', () => {
  let numeroDeMesa = 0;
  async function sembrarMesas(cuantas: number, asignadasA: string | null) {
    const ids: string[] = [];
    await conTransaccion(async (tx) => {
      for (let i = 0; i < cuantas; i += 1) {
        const id = randomUUID();
        ids.push(id);
        await tx
          .insertInto('mesas')
          .values({
            id,
            organizacion_id: dueno.organizacionId,
            sucursal_id: sucursalId,
            numero: (numeroDeMesa += 1),
            empleado_asignado_id: asignadasA,
          })
          .execute();
      }
    });
    return ids;
  }
  /** A quién está asignada cada mesa, EN EL ORDEN en que se pidieron. */
  const asignadas = async (ids: string[]) => {
    const filas = await obtenerDb()
      .selectFrom('mesas')
      .select(['id', 'empleado_asignado_id'])
      .where('id', 'in', ids)
      .execute();
    return ids.map((id) => filas.find((f) => f.id === id)?.empleado_asignado_id);
  };
  const repartir = (quien: NegocioReal, mesero: string | null, mesaIds: string[]) =>
    comando(repartirMesas, {
      entrada: { mesero, mesaIds },
      ambito: ambitoDe(quien, sucursalId, null),
      idempotencyKey: clave(),
    });

  it('desactivar al mesero suelta sus mesas y deja las de los demás', async () => {
    const lalo = await altaCon('mesero', 'Lalo', '1212');
    const nena = await altaCon('mesero', 'Nena', '3434');
    const delLalo = await sembrarMesas(3, lalo);
    const deLaNena = await sembrarMesas(1, nena);

    exigirOk(
      await guardar(dueno, { empleado: lalo, nombre: 'Lalo', puesto: 'mesero', activo: false }),
      'desactivar',
    );

    expect(await asignadas(delLalo)).toEqual([null, null, null]);
    expect(await asignadas(deLaNena)).toEqual([nena]);
    expect((await fila(lalo)).activo).toBe(false);
  });

  it('repartir asigna varias mesas de una vez y deja su auditoría; la gerente también puede', async () => {
    const memo = await altaCon('mesero', 'Memo', '5656');
    const mesas = await sembrarMesas(4, null);

    const salida = exigirOk(await repartir(dueno, memo, mesas), 'repartir');
    expect(salida).toMatchObject({ mesero: memo, mesas: 4 });
    expect(await asignadas(mesas)).toEqual([memo, memo, memo, memo]);

    const auditoria = await obtenerDb()
      .selectFrom('auditoria')
      .select('payload')
      .where('accion', '=', 'restaurante.repartir_mesas')
      .where('identidad_id', '=', dueno.identidadId)
      .execute();
    expect(JSON.stringify(auditoria.at(-1)?.payload)).toContain(memo);

    const gerente = await sembrarCompanero(dueno, { nombre: 'Gerente reparte', rol: 'gerente' });
    const sueltas = exigirOk(
      await repartir(como(dueno, 'gerente', gerente), null, mesas.slice(0, 2)),
      'la gerente las suelta',
    );
    expect(sueltas.mesas).toBe(2);
    expect(await asignadas(mesas)).toEqual([null, null, memo, memo]);
  });

  it('es entero o nada: una mesa ajena o un no-mesero no cambia ninguna', async () => {
    const memo = await altaCon('mesero', 'Memo 2', '7878');
    const cajero = await altaCon('cajero', 'Cajero', '9090');
    const mesas = await sembrarMesas(2, null);

    const conAjena = await repartir(dueno, memo, [...mesas, randomUUID()]);
    expect(conAjena.ok).toBe(false);
    const aUnCajero = await repartir(dueno, cajero, mesas);
    expect(aUnCajero.ok).toBe(false);
    expect(await asignadas(mesas)).toEqual([null, null]);
  });

  it('el cajero y el mesero no reparten mesas', async () => {
    const mesas = await sembrarMesas(1, null);
    const cajero = await sembrarCompanero(dueno, { nombre: 'Cajero sin mando', rol: 'cajero' });
    const salida = await repartir(como(dueno, 'cajero', cajero), null, mesas);
    expect(salida.ok).toBe(false);
  });
});
