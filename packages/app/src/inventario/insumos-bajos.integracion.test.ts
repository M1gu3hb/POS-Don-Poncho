import { randomUUID } from 'node:crypto';

import type { Ambito, Rol } from '@morphiqpos/contracts';
import { obtenerDb } from '@morphiqpos/data';
import { sql } from 'kysely';
import { beforeAll, describe, expect, it } from 'vitest';

import { comando } from '../produccion.ts';
import {
  ambitoDe,
  clave,
  exigirOk,
  sembrarCompanero,
  sembrarNegocio,
  sembrarSucursal,
  type NegocioReal,
  type SucursalReal,
} from '../pruebas/negocio-real.ts';
import { insumosBajos } from './insumos-bajos.ts';

/**
 * DP-22 · EL AVISO DE INSUMO BAJO (DP-D159), contra Postgres: la cuenta sale del servidor, sobre TODOS
 * los insumos activos (no sobre una lista que pueda venir cortada), con la existencia sumada de todos
 * los almacenes, y los primeros nombres salen del más urgente al menos.
 *
 * Regla (la misma del semáforo de Inventario): un piso en cero es «no lo vigiles»; con piso, cuenta
 * lo que está en su mínimo o por debajo, y lo agotado o en negativo cuenta siempre que tenga piso.
 */

const POR_COMANDOS = 300_000;

let negocio: NegocioReal;
let sucursal: SucursalReal;
let segundoAlmacen = '';
const ambitos = new Map<Rol, Ambito>();

const ambitoDelRol = (rol: Rol): Ambito => {
  const a = ambitos.get(rol);
  if (a === undefined) throw new Error(`Falta el puesto ${rol}.`);
  return a;
};
const avisar = (rol: Rol = 'dueno', ambito: Ambito = ambitoDelRol(rol)) =>
  comando(insumosBajos, { entrada: {}, ambito, idempotencyKey: clave() });

interface Insumo {
  readonly nombre: string;
  readonly minimo?: string;
  readonly critico?: string;
  /** Existencia por almacén; sin ella, el insumo no tiene fila de existencias. */
  readonly existencias?: readonly {
    readonly almacen: 'principal' | 'segundo';
    readonly cantidad: string;
  }[];
  readonly activo?: boolean;
}

async function sembrarInsumo(
  n: NegocioReal,
  almacenes: { principal: string; segundo: string },
  i: Insumo,
): Promise<void> {
  const db = obtenerDb();
  const id = randomUUID();
  await db
    .insertInto('insumos')
    .values({
      id,
      organizacion_id: n.organizacionId,
      nombre: i.nombre,
      unidad_base: 'g',
      costo_unitario_centavos: 10n,
      stock_minimo: i.minimo ?? '0',
      stock_critico: i.critico ?? '0',
      activo: i.activo ?? true,
    })
    .execute();
  for (const e of i.existencias ?? []) {
    await db
      .insertInto('existencias')
      .values({
        organizacion_id: n.organizacionId,
        almacen_id: e.almacen === 'principal' ? almacenes.principal : almacenes.segundo,
        insumo_id: id,
        cantidad: e.cantidad,
      })
      .execute();
  }
}

beforeAll(async () => {
  negocio = await sembrarNegocio({
    nombre: 'Fonda de los insumos bajos',
    rol: 'dueno',
    giro: 'restaurante',
    paquete: 'restaurante',
  });
  sucursal = await sembrarSucursal(negocio, { terminales: ['Caja 1'] });
  segundoAlmacen = randomUUID();
  await obtenerDb()
    .insertInto('almacenes')
    .values({
      id: segundoAlmacen,
      organizacion_id: negocio.organizacionId,
      sucursal_id: sucursal.sucursalId,
      nombre: 'Bodega',
      principal: false,
    })
    .execute();
  for (const rol of [
    'dueno',
    'administrador',
    'gerente',
    'cajero',
    'mesero',
    'cocina',
    'almacen',
  ] as const) {
    ambitos.set(rol, {
      ...ambitoDe(negocio, sucursal.sucursalId, null),
      rol,
      empleoId: await sembrarCompanero(negocio, { nombre: `Alguien ${rol}`, rol }),
    });
  }
  const almacenes = { principal: sucursal.almacenId, segundo: segundoAlmacen };
  const p = (cantidad: string) => [{ almacen: 'principal' as const, cantidad }];
  const insumos: readonly Insumo[] = [
    // Crítico: 100 g con piso de 500 y crítico de 200.
    { nombre: 'Carne', minimo: '500', critico: '200', existencias: p('100') },
    // Bajo: 10 con piso de 50.
    { nombre: 'Tortilla', minimo: '50', existencias: p('10') },
    // Agotado con piso: cuenta.
    { nombre: 'Pan', minimo: '20', existencias: p('0') },
    // En negativo (D116: lo que pasó por cocina se cobró): cuenta.
    { nombre: 'Crema', minimo: '100', existencias: p('-50') },
    // Justo en su piso: cuenta (el semáforo dice «bajo» con existencia <= mínimo).
    { nombre: 'Pulque', minimo: '500', existencias: p('500') },
    // Sin fila de existencias: existencia cero con piso: cuenta.
    { nombre: 'Sal', minimo: '10' },
    // Suficiente.
    { nombre: 'Leche', minimo: '500', existencias: p('800') },
    // Sin piso: «no lo vigiles», aunque esté en cero.
    { nombre: 'Azúcar', existencias: p('0') },
    // La existencia se suma entre almacenes: 30 + 30 = 60 > 50, no cuenta.
    {
      nombre: 'Aceite',
      minimo: '50',
      existencias: [
        { almacen: 'principal', cantidad: '30' },
        { almacen: 'segundo', cantidad: '30' },
      ],
    },
    // Repartida y baja: 10 + 10 = 20 <= 50, cuenta una sola vez.
    {
      nombre: 'Frijol',
      minimo: '50',
      existencias: [
        { almacen: 'principal', cantidad: '10' },
        { almacen: 'segundo', cantidad: '10' },
      ],
    },
    // Desactivado: no cuenta.
    { nombre: 'Vinagre', minimo: '50', existencias: p('0'), activo: false },
  ];
  for (const i of insumos) await sembrarInsumo(negocio, almacenes, i);

  // Otro negocio con un insumo agotado: no entra en la cuenta del primero.
  const otro = await sembrarNegocio({
    nombre: 'Otra Fonda',
    rol: 'dueno',
    giro: 'restaurante',
    paquete: 'restaurante',
  });
  const otraSucursal = await sembrarSucursal(otro, { terminales: ['Caja 1'] });
  await sembrarInsumo(
    otro,
    { principal: otraSucursal.almacenId, segundo: otraSucursal.almacenId },
    {
      nombre: 'Insumo ajeno',
      minimo: '10',
      existencias: [{ almacen: 'principal', cantidad: '0' }],
    },
  );
}, POR_COMANDOS);

describe('inventario.insumos_bajos · la cuenta y los primeros nombres', () => {
  it(
    'cuenta los insumos activos en su piso o por debajo, con la existencia sumada de todos los almacenes',
    { timeout: POR_COMANDOS },
    async () => {
      const salida = exigirOk(await avisar(), 'inventario.insumos_bajos');
      // Carne, Tortilla, Pan, Crema, Pulque, Sal y Frijol = 7. Sin Leche, Azúcar (sin piso), Aceite ni Vinagre.
      expect(salida.total).toBe(7);
    },
  );

  it(
    'los primeros nombres van del más urgente al menos: crítico, luego lo más agotado respecto de su piso',
    { timeout: POR_COMANDOS },
    async () => {
      const salida = exigirOk(await avisar(), 'inventario.insumos_bajos');
      // Carne (crítico) primero; después, por cobertura (existencia ÷ piso): Crema −0.5, Pan 0, Sal 0 …
      expect(salida.primeros.map((p) => p.nombre)).toEqual(['Carne', 'Crema', 'Pan']);
      expect(salida.primeros[0]).toMatchObject({
        nombre: 'Carne',
        nivel: 'critico',
        existencia: '100',
        minimo: '500',
        unidad: 'g',
      });
      expect(salida.primeros[1]).toMatchObject({
        nombre: 'Crema',
        existencia: '-50',
        agotado: true,
      });
      expect(salida.primeros[2]).toMatchObject({ nombre: 'Pan', existencia: '0', agotado: true });
      expect(salida.primeros).toHaveLength(3);
    },
  );

  it(
    'sin insumos bajos la cuenta es cero y no hay nombres',
    { timeout: POR_COMANDOS },
    async () => {
      const limpio = await sembrarNegocio({
        nombre: 'Fonda llena',
        rol: 'dueno',
        giro: 'restaurante',
        paquete: 'restaurante',
      });
      const s = await sembrarSucursal(limpio, { terminales: ['Caja 1'] });
      await sembrarInsumo(
        limpio,
        { principal: s.almacenId, segundo: s.almacenId },
        {
          nombre: 'Harina',
          minimo: '10',
          existencias: [{ almacen: 'principal', cantidad: '900' }],
        },
      );
      const salida = exigirOk(
        await avisar('dueno', ambitoDe(limpio, s.sucursalId, null)),
        'inventario.insumos_bajos',
      );
      expect(salida).toEqual({ total: 0, primeros: [] });
    },
  );

  it(
    'cuenta TODOS, no una lista cortada: más de mil insumos bajos',
    { timeout: POR_COMANDOS },
    async () => {
      const grande = await sembrarNegocio({
        nombre: 'Fonda enorme',
        rol: 'dueno',
        giro: 'restaurante',
        paquete: 'restaurante',
      });
      const s = await sembrarSucursal(grande, { terminales: ['Caja 1'] });
      const db = obtenerDb();
      await sql`
      insert into insumos (organizacion_id, nombre, unidad_base, costo_unitario_centavos, stock_minimo)
      select ${grande.organizacionId}::uuid, 'Insumo ' || g, 'g', 10, 100 from generate_series(1, 1300) g
    `.execute(db);
      await sql`
      insert into existencias (organizacion_id, almacen_id, insumo_id, cantidad)
      select i.organizacion_id, ${s.almacenId}::uuid, i.id, 5 from insumos i where i.organizacion_id = ${grande.organizacionId}::uuid
    `.execute(db);
      const salida = exigirOk(
        await avisar('dueno', ambitoDe(grande, s.sucursalId, null)),
        'inventario.insumos_bajos',
      );
      expect(salida.total).toBe(1300);
      expect(salida.primeros).toHaveLength(3);
    },
  );
});

describe('inventario.insumos_bajos · permisos', () => {
  it.each(['dueno', 'administrador', 'gerente', 'almacen'] as const)(
    'el %s lo lee',
    { timeout: POR_COMANDOS },
    async (rol) => {
      exigirOk(await avisar(rol), 'inventario.insumos_bajos');
    },
  );

  it.each(['cajero', 'mesero', 'cocina'] as const)(
    'el %s no: SIN_PERMISO',
    { timeout: POR_COMANDOS },
    async (rol) => {
      const salida = await avisar(rol);
      expect(salida.ok).toBe(false);
      if (!salida.ok) expect(salida.error.codigo).toBe('SIN_PERMISO');
    },
  );
});
