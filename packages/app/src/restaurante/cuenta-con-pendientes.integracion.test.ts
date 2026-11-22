import { obtenerDb } from '@morphiqpos/data';
import { sql } from 'kysely';
import { beforeAll, describe, expect, it } from 'vitest';

import { comando } from '../produccion.ts';
import { clave, exigirOk } from '../pruebas/negocio-real.ts';
import { solicitarCuenta } from './cuenta.ts';
import { abrirLasCajas, ambitoDeCaja, sentarYPedir, type Salon } from './pruebas/salon-real.ts';
import { sembrarSalon } from './pruebas/salon-real.ts';

/**
 * DP-25 · PARTE 2 · PEDIR LA CUENTA CON PLATILLOS PENDIENTES (Postgres real).
 *
 * Se puede pedir la cuenta, pero si a la mesa le faltan platillos por llegar el SERVIDOR lo dice
 * antes —en todas las pantallas— y sólo la pide con la confirmación explícita
 * (`aunConPendientes`). La lista sale por estación: lo que NO se ha preparado (nuevo o en
 * preparación) y lo que está listo pero NO se ha entregado. Lo entregado y lo cancelado no cuentan.
 */

let salon: Salon;
let indice = 0;

const como = (rol: 'mesero' | 'cajero' | 'gerente' | 'administrador' | 'dueno' | 'cocina') => ({
  ...ambitoDeCaja(salon),
  rol,
});

beforeAll(async () => {
  salon = await sembrarSalon({ nombre: 'Cuenta con pendientes', mesas: 24 });
  await abrirLasCajas(salon);
  const db = obtenerDb();
  const org = salon.negocio.organizacionId;
  const cantina = await db
    .insertInto('estaciones_preparacion')
    .values({ organizacion_id: org, nombre: 'Cantina', color: '#0891b2' })
    .returning('id')
    .executeTakeFirstOrThrow();
  const categoria = await db
    .insertInto('categorias')
    .values({ organizacion_id: org, nombre: 'Bebidas', estacion_preparacion_id: cantina.id })
    .returning('id')
    .executeTakeFirstOrThrow();
  await db
    .updateTable('productos')
    .set({ categoria_id: categoria.id })
    .where('id', '=', salon.platillos.cerveza)
    .execute();
  await sql`
    insert into configuracion (organizacion_id, valores)
    values (${org}, ${JSON.stringify({ estaciones_preparacion_activas: true })}::jsonb)
    on conflict (organizacion_id) do update set valores = configuracion.valores || excluded.valores
  `.execute(db);
}, 120_000);

type EstadoDePlatillo = 'pendiente' | 'en_preparacion' | 'listo' | 'entregado' | 'cancelado';

/** Una mesa con tres platillos de la cocina y dos de la cantina, uno por renglón. */
async function mesaConCinco() {
  const posicion = indice;
  indice += 1;
  const { ordenId } = await sentarYPedir(salon, posicion, [
    { platillo: 'arrachera', cantidad: '1' },
    { platillo: 'guacamole', cantidad: '1' },
    { platillo: 'arrachera', cantidad: '2' },
    { platillo: 'cerveza', cantidad: '1' },
    { platillo: 'cerveza', cantidad: '2' },
  ]);
  return ordenId;
}

/** Los estados van en el orden: Arrachera 1, Arrachera 2, Cerveza 1, Cerveza 2, Guacamole 1. */
async function ponerEstados(ordenId: string, estados: readonly EstadoDePlatillo[]): Promise<void> {
  const db = obtenerDb();
  const filas = await db
    .selectFrom('comanda_items as i')
    .innerJoin('comandas as c', 'c.id', 'i.comanda_id')
    .select(['i.id'])
    .where('c.orden_id', '=', ordenId)
    .orderBy('i.producto_nombre')
    .orderBy('i.cantidad')
    .execute();
  expect(filas).toHaveLength(estados.length);
  for (const [posicion, fila] of filas.entries()) {
    await db
      .updateTable('comanda_items')
      .set({ estado: estados[posicion] ?? 'pendiente' })
      .where('id', '=', fila.id)
      .execute();
  }
}

const pedir = (
  ordenId: string,
  rol: 'mesero' | 'cajero' | 'gerente' | 'administrador' | 'dueno' | 'cocina' = 'mesero',
  confirmada?: boolean,
) =>
  comando(solicitarCuenta, {
    entrada: confirmada === undefined ? { ordenId } : { ordenId, aunConPendientes: confirmada },
    ambito: como(rol),
    idempotencyKey: clave(),
  });

const estadoDeLaCuenta = async (ordenId: string) =>
  (
    await obtenerDb()
      .selectFrom('ordenes')
      .select('estado')
      .where('id', '=', ordenId)
      .executeTakeFirstOrThrow()
  ).estado;

interface GrupoLeido {
  readonly estacion: string | null;
  readonly platillos: readonly { readonly nombre: string; readonly cantidad: string }[];
}
interface PendientesLeidos {
  readonly sinPreparar: readonly GrupoLeido[];
  readonly listos: readonly GrupoLeido[];
}

function pendientesDe(salida: Awaited<ReturnType<typeof pedir>>): PendientesLeidos {
  expect(salida.ok, 'se esperaba el rechazo con la lista').toBe(false);
  if (salida.ok) throw new Error('no se rechazó');
  expect(salida.error.codigo).toBe('REGLA_DE_NEGOCIO');
  expect(salida.error.datos?.['regla']).toBe('CUENTA_CON_PENDIENTES');
  const crudo = salida.error.datos?.['pendientes'];
  expect(typeof crudo).toBe('string');
  return JSON.parse(String(crudo)) as PendientesLeidos;
}

const nombres = (g: readonly GrupoLeido[] | undefined, estacion: string): string[] =>
  (g?.find((x) => x.estacion === estacion)?.platillos ?? []).map(
    (p) => `${Number(p.cantidad)} ${p.nombre}`,
  );

describe('pedir la cuenta con platillos pendientes', () => {
  it('sin la confirmación se rechaza con la lista por estación y la cuenta no se mueve', async () => {
    const ordenId = await mesaConCinco();
    // Cocina: arrachera 1 en preparación, arrachera 2 entregada, guacamole nuevo.
    // Cantina: cerveza 1 lista, cerveza 2 cancelada.
    await ponerEstados(ordenId, ['en_preparacion', 'entregado', 'listo', 'cancelado', 'pendiente']);

    const salida = await pedir(ordenId);

    const lista = pendientesDe(salida);
    expect(lista.sinPreparar.map((g) => g.estacion)).toEqual(['Cocina general']);
    expect(nombres(lista.sinPreparar, 'Cocina general').sort()).toEqual([
      '1 Arrachera al carbón',
      '1 Guacamole con totopos',
    ]);
    expect(lista.listos.map((g) => g.estacion)).toEqual(['Cantina']);
    expect(nombres(lista.listos, 'Cantina')).toEqual(['1 Cerveza clara']);
    expect(await estadoDeLaCuenta(ordenId), 'la cuenta se movió con el rechazo').not.toBe(
      'cuenta_solicitada',
    );
  });

  it('con la confirmación la cuenta se pide aunque falten platillos', async () => {
    const ordenId = await mesaConCinco();
    await ponerEstados(ordenId, ['pendiente', 'pendiente', 'listo', 'listo', 'listo']);

    exigirOk(await pedir(ordenId, 'mesero', true), 'restaurante.solicitar_cuenta');

    expect(await estadoDeLaCuenta(ordenId)).toBe('cuenta_solicitada');
  });

  it('con todo entregado (o cancelado) se pide normal, sin confirmación', async () => {
    const ordenId = await mesaConCinco();
    await ponerEstados(ordenId, ['entregado', 'entregado', 'entregado', 'entregado', 'cancelado']);

    exigirOk(await pedir(ordenId), 'restaurante.solicitar_cuenta');

    expect(await estadoDeLaCuenta(ordenId)).toBe('cuenta_solicitada');
  });

  it('«aunConPendientes: false» se trata como sin confirmar', async () => {
    const ordenId = await mesaConCinco();
    await ponerEstados(ordenId, ['listo', 'entregado', 'entregado', 'entregado', 'entregado']);

    const lista = pendientesDe(await pedir(ordenId, 'mesero', false));

    expect(lista.sinPreparar).toEqual([]);
    expect(nombres(lista.listos, 'Cocina general')).toEqual(['1 Arrachera al carbón']);
    expect(await estadoDeLaCuenta(ordenId)).not.toBe('cuenta_solicitada');
  });

  it.each(['mesero', 'cajero', 'gerente', 'administrador', 'dueno'] as const)(
    'el rol %s sigue pudiendo pedirla (con la confirmación)',
    async (rol) => {
      const ordenId = await mesaConCinco();
      pendientesDe(await pedir(ordenId, rol));
      exigirOk(await pedir(ordenId, rol, true), 'restaurante.solicitar_cuenta');
      expect(await estadoDeLaCuenta(ordenId)).toBe('cuenta_solicitada');
    },
  );

  it('quien no podía pedirla sigue rechazado, con la confirmación o sin ella', async () => {
    const ordenId = await mesaConCinco();
    for (const confirmada of [undefined, true]) {
      const salida = await pedir(ordenId, 'cocina', confirmada);
      expect(salida.ok).toBe(false);
      if (!salida.ok) expect(salida.error.codigo).toBe('SIN_PERMISO');
    }
    expect(await estadoDeLaCuenta(ordenId)).not.toBe('cuenta_solicitada');
  });
});
