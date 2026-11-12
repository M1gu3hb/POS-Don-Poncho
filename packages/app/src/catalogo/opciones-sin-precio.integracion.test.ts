import { obtenerDb } from '@morphiqpos/data';
import { beforeAll, describe, expect, it } from 'vitest';

import { comando } from '../produccion.ts';
import {
  ambitoDe,
  clave,
  exigirOk,
  sembrarNegocio,
  type NegocioReal,
} from '../pruebas/negocio-real.ts';
import { armarParaLlevar } from '../restaurante/para-llevar.ts';
import {
  abrirLasCajas,
  ambitoDeCaja,
  sembrarSalon,
  type Salon,
} from '../restaurante/pruebas/salon-real.ts';
import { asignarGruposAlProducto, guardarGrupoDeOpciones } from './grupos-de-opciones.ts';

/**
 * DP-18 · M6 (auditoría del 10-11) · UNA OPCIÓN QUE RESTA NO DEJA EL PLATILLO EN $0 O MENOS.
 *
 * Antes el servidor dejaba el renglón en $0 sin decir nada (DP-D104): «Sin carne −$30» en un taco de
 * $25 lo regalaba. Ahora se rechaza al guardar el grupo, al asignarlo y, si el precio bajó después,
 * al vender.
 */

let dueno: NegocioReal;
let tacoId = '';
let salon: Salon;

async function platillo(organizacionId: string, nombre: string, precio: bigint): Promise<string> {
  return (
    await obtenerDb()
      .insertInto('productos')
      .values({
        organizacion_id: organizacionId,
        nombre,
        precio_venta_centavos: precio,
        costo_unitario_centavos: 0n,
        estrategia_consumo: 'ninguno',
        area_preparacion: 'cocina',
      })
      .returning('id')
      .executeTakeFirstOrThrow()
  ).id;
}

const catalogo = () => ambitoDe(dueno, null, null);
const guardar = (opciones: { nombre: string; precio: string }[], grupoId?: string) =>
  comando(guardarGrupoDeOpciones, {
    entrada: {
      ...(grupoId === undefined ? {} : { grupoId }),
      nombre: 'Proteína',
      tipo: 'unica',
      obligatorio: true,
      minimo: null,
      maximo: null,
      activo: true,
      opciones: opciones.map((o) => ({ ...o, activa: true })),
    },
    ambito: catalogo(),
    idempotencyKey: clave(),
  });

beforeAll(async () => {
  dueno = await sembrarNegocio({ nombre: 'Opciones sin precio', rol: 'dueno' });
  tacoId = await platillo(dueno.organizacionId, 'Taco', 2_500n);
  salon = await sembrarSalon({ nombre: 'Opciones al vender', mesas: 1, terminales: 1 });
  await abrirLasCajas(salon, 50_000);
});

describe('DP-18 · M6 · el piso de las opciones', () => {
  it('asignar un grupo cuya opción deja el platillo en $0: se rechaza y no queda asignado', async () => {
    const { grupoId } = exigirOk(
      await guardar([
        { nombre: 'Res', precio: '0' },
        { nombre: 'Sin carne', precio: '-25' },
      ]),
      'catalogo.guardar_grupo_de_opciones',
    );
    const r = await comando(asignarGruposAlProducto, {
      entrada: { productoId: tacoId, grupoIds: [grupoId] },
      ambito: catalogo(),
      idempotencyKey: clave(),
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.datos?.['regla']).toBe('OPCION_DEJA_SIN_PRECIO');
      expect(r.error.mensaje).toMatch(/«Taco» podría quedar en \$0\.00/);
    }
    const asignados = await obtenerDb()
      .selectFrom('producto_modificadores')
      .select('modificador_id')
      .where('producto_id', '=', tacoId)
      .execute();
    expect(asignados).toHaveLength(0);
  });

  it('cambiar el grupo de un platillo que ya lo usa a una opción que lo deja en $0: se rechaza', async () => {
    const { grupoId } = exigirOk(
      await guardar([
        { nombre: 'Res', precio: '0' },
        { nombre: 'Sin cebolla', precio: '-5' },
      ]),
      'catalogo.guardar_grupo_de_opciones',
    );
    exigirOk(
      await comando(asignarGruposAlProducto, {
        entrada: { productoId: tacoId, grupoIds: [grupoId] },
        ambito: catalogo(),
        idempotencyKey: clave(),
      }),
      'catalogo.asignar_grupos_de_opciones',
    );
    const r = await guardar(
      [
        { nombre: 'Res', precio: '0' },
        { nombre: 'Sin cebolla', precio: '-30' },
      ],
      grupoId,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.datos?.['regla']).toBe('OPCION_DEJA_SIN_PRECIO');
    const sigue = await obtenerDb()
      .selectFrom('modificador_opciones')
      .select('delta_precio_centavos')
      .where('modificador_id', '=', grupoId)
      .where('nombre', '=', 'Sin cebolla')
      .executeTakeFirstOrThrow();
    expect(sigue.delta_precio_centavos).toBe(-500n);
  });

  it('al vender: si el precio del platillo bajó y la opción ya lo deja en $0, no entra a la cuenta', async () => {
    const org = salon.negocio.organizacionId;
    const agua = await platillo(org, 'Agua fresca', 3_000n);
    const db = obtenerDb();
    const g = await db
      .insertInto('modificadores')
      .values({ organizacion_id: org, nombre: 'Tamaño', obligatorio: true, tipo: 'unica' })
      .returning('id')
      .executeTakeFirstOrThrow();
    const chica = await db
      .insertInto('modificador_opciones')
      .values({ modificador_id: g.id, nombre: 'Chica', orden: 1, delta_precio_centavos: -1_500n })
      .returning('id')
      .executeTakeFirstOrThrow();
    await db
      .insertInto('producto_modificadores')
      .values({ organizacion_id: org, producto_id: agua, modificador_id: g.id })
      .execute();
    // El precio bajó después (sin pasar por el editor de opciones).
    await db
      .updateTable('productos')
      .set({ precio_venta_centavos: 1_500n })
      .where('id', '=', agua)
      .execute();
    const r = await comando(armarParaLlevar, {
      entrada: {
        lineas: [
          { productoId: agua, cantidad: '1', opciones: [{ grupoId: g.id, opcionIds: [chica.id] }] },
        ],
      },
      ambito: ambitoDeCaja(salon, 0),
      idempotencyKey: clave(),
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.datos?.['regla']).toBe('OPCION_DEJA_SIN_PRECIO');
      expect(r.error.mensaje).toMatch(/«Agua fresca» quedaría en \$0 o menos/);
    }
  });
});
