import { obtenerDb } from '@morphiqpos/data';
import { beforeAll, describe, expect, it } from 'vitest';

import { gruposDeOpciones } from '../catalogo/grupos-de-opciones-lectura.ts';
import { asignarGruposAlProducto, guardarGrupoDeOpciones } from '../catalogo/grupos-de-opciones.ts';
import { opcionesDelMenu } from '../portal/opciones-publicas.ts';
import { comando } from '../produccion.ts';
import { clave, exigirOk } from '../pruebas/negocio-real.ts';
import { ticketDeOrden } from '../venta/consultas.ts';
import { abrirMesa } from './mesas.ts';
import { opcionesDeLosPlatillos } from './opciones-de-los-platillos.ts';
import { enviarPedido } from './pedido.ts';
import {
  abrirLasCajas,
  ambitoDeCaja,
  mesaDe,
  PRECIO_CERVEZA,
  PRECIO_GUACAMOLE,
  sembrarSalon,
  type Salon,
} from './pruebas/salon-real.ts';

/**
 * DP-24 · 3.5 · LAS OPCIONES DE LA HOJA, DE PUNTA A PUNTA, contra Postgres.
 *
 * «Prepárala» (Michelado +$15, Cubano +$20, Con clamato +$30, Con clamato cubano +$35: opcional, una
 * sola elección) en una cerveza, cargado con los mismos comandos que usa Productos → Opciones. Se
 * prueba que se VE donde se ve un grupo de opciones: la biblioteca de Productos, lo que leen el mesero
 * y la Caja, el portal, lo que guarda la línea (que es lo que lee la cocina) y el ticket.
 */

const PREPARALA = [
  { nombre: 'Michelado', precio: '15' },
  { nombre: 'Cubano', precio: '20' },
  { nombre: 'Con clamato', precio: '30' },
  { nombre: 'Con clamato cubano', precio: '35' },
] as const;

let salon: Salon;
let grupoId = '';
let cerveza = '';
const caja = () => ambitoDeCaja(salon);

async function pedir(indice: number, opcionIds: readonly string[]) {
  const { ordenId } = exigirOk(
    await comando(abrirMesa, {
      entrada: { mesaId: mesaDe(salon, indice), personas: 2 },
      ambito: caja(),
      idempotencyKey: clave(),
    }),
    'restaurante.abrir_mesa',
  );
  const r = await comando(enviarPedido, {
    entrada: {
      ordenId,
      lineas: [
        {
          productoId: cerveza,
          cantidad: '1',
          opciones: opcionIds.length === 0 ? [] : [{ grupoId, opcionIds: [...opcionIds] }],
        },
      ],
    },
    ambito: caja(),
    idempotencyKey: clave(),
  });
  return { ordenId, r };
}

const opcionPorNombre = async (nombre: string): Promise<string> =>
  (
    await obtenerDb()
      .selectFrom('modificador_opciones')
      .select('id')
      .where('modificador_id', '=', grupoId)
      .where('nombre', '=', nombre)
      .executeTakeFirstOrThrow()
  ).id;

beforeAll(async () => {
  salon = await sembrarSalon({ nombre: 'Opciones de la hoja', mesas: 6, terminales: 1 });
  await abrirLasCajas(salon, 50_000);
  cerveza = salon.platillos.cerveza;
  const guardado = exigirOk(
    await comando(guardarGrupoDeOpciones, {
      entrada: { nombre: 'Prepárala', tipo: 'unica', obligatorio: false, opciones: [...PREPARALA] },
      ambito: { ...caja(), rol: 'dueno' },
      idempotencyKey: clave(),
    }),
    'catalogo.guardar_grupo_de_opciones',
  );
  grupoId = guardado.grupoId;
  exigirOk(
    await comando(asignarGruposAlProducto, {
      entrada: { productoId: cerveza, grupoIds: [grupoId] },
      ambito: { ...caja(), rol: 'dueno' },
      idempotencyKey: clave(),
    }),
    'catalogo.asignar_grupos_de_opciones',
  );
});

describe('DP-24 · «Prepárala» en la cerveza se ve en todas partes', () => {
  it('Productos → Opciones: la biblioteca trae el grupo, con sus precios y la cerveza', async () => {
    const { grupos } = exigirOk(
      await comando(gruposDeOpciones, {
        entrada: {},
        ambito: { ...caja(), rol: 'dueno' },
        idempotencyKey: clave(),
      }),
      'catalogo.grupos_de_opciones',
    );
    const preparala = grupos.find((g) => g.nombre === 'Prepárala');
    expect(preparala?.tipo).toBe('unica');
    expect(preparala?.obligatorio).toBe(false);
    expect(preparala?.opciones.map((o) => [o.nombre, o.precioCentavos])).toEqual([
      ['Michelado', '1500'],
      ['Cubano', '2000'],
      ['Con clamato', '3000'],
      ['Con clamato cubano', '3500'],
    ]);
    expect(preparala?.productoIds).toEqual([cerveza]);
  });

  it('el mesero y la Caja: lo que leen para ofrecer opciones trae el grupo de la cerveza', async () => {
    const porPlatillo = await opcionesDeLosPlatillos(caja());
    const grupo = porPlatillo[cerveza]?.[0];
    expect(grupo?.nombre).toBe('Prepárala');
    expect(grupo?.obligatorio).toBe(false);
    expect(grupo?.opciones.map((o) => o.precioCentavos)).toEqual(['1500', '2000', '3000', '3500']);
  });

  it('el portal del comensal: el menú público ofrece el grupo (con precios si el negocio los enseña)', async () => {
    const conPrecios = await opcionesDelMenu(salon.negocio.organizacionId, [cerveza], true);
    const grupo = conPrecios.get(cerveza)?.[0];
    expect(grupo?.nombre).toBe('Prepárala');
    expect(grupo?.obligatorio).toBe(false);
    expect(grupo?.opciones.map((o) => o.precioCentavos)).toEqual(['1500', '2000', '3000', '3500']);
    const sinPrecios = await opcionesDelMenu(salon.negocio.organizacionId, [cerveza], false);
    expect(sinPrecios.get(cerveza)?.[0]?.opciones.map((o) => o.nombre)).toEqual(
      PREPARALA.map((o) => o.nombre),
    );
  });

  it('es opcional: la cerveza se pide sola, a su precio, sin opción', async () => {
    const { ordenId, r } = await pedir(0, []);
    expect(r.ok).toBe(true);
    const linea = await obtenerDb()
      .selectFrom('orden_lineas')
      .select(['subtotal_centavos'])
      .where('orden_id', '=', ordenId)
      .executeTakeFirstOrThrow();
    expect(linea.subtotal_centavos).toBe(PRECIO_CERVEZA);
  });

  it('con opción: suma su precio, la línea guarda lo elegido (lo que lee la cocina) y el ticket lo dice', async () => {
    const { ordenId, r } = await pedir(1, [await opcionPorNombre('Con clamato cubano')]);
    expect(r.ok).toBe(true);
    const linea = await obtenerDb()
      .selectFrom('orden_lineas')
      .select(['id', 'subtotal_centavos', 'opciones'])
      .where('orden_id', '=', ordenId)
      .executeTakeFirstOrThrow();
    expect(linea.subtotal_centavos).toBe(PRECIO_CERVEZA + 3_500n);
    // La instantánea que la pantalla de cocina enseña aparte de la nota.
    expect(JSON.stringify(linea.opciones)).toContain('Con clamato cubano');
    expect(JSON.stringify(linea.opciones)).toContain('Prepárala');
    const { lineas } = exigirOk(
      await comando(ticketDeOrden, {
        entrada: { ordenId },
        ambito: caja(),
        idempotencyKey: clave(),
      }),
      'venta.ticket',
    );
    expect(lineas[0]?.opciones).toBe('Prepárala: Con clamato cubano (+$35.00)');
  });

  it('una sola elección: dos opciones del mismo grupo se rechazan', async () => {
    const { r } = await pedir(2, [
      await opcionPorNombre('Michelado'),
      await opcionPorNombre('Cubano'),
    ]);
    expect(r.ok).toBe(false);
  });
});

describe('DP-24 · «Preparación» (varias, sin costo) en la barbacoa preparada', () => {
  it('se eligen varias sin cambiar el precio, y el ticket las dice sin cobrar nada', async () => {
    const guardado = exigirOk(
      await comando(guardarGrupoDeOpciones, {
        entrada: {
          nombre: 'Preparación',
          tipo: 'multiple',
          obligatorio: false,
          opciones: [
            { nombre: 'Sin chile cuaresmeño', precio: '0' },
            { nombre: 'Sin cilantro', precio: '0' },
            { nombre: 'Sin cebolla', precio: '0' },
          ],
        },
        ambito: { ...caja(), rol: 'dueno' },
        idempotencyKey: clave(),
      }),
      'catalogo.guardar_grupo_de_opciones',
    );
    const platillo = salon.platillos.guacamole;
    exigirOk(
      await comando(asignarGruposAlProducto, {
        entrada: { productoId: platillo, grupoIds: [guardado.grupoId] },
        ambito: { ...caja(), rol: 'dueno' },
        idempotencyKey: clave(),
      }),
      'catalogo.asignar_grupos_de_opciones',
    );
    const ids = await obtenerDb()
      .selectFrom('modificador_opciones')
      .select(['id', 'nombre'])
      .where('modificador_id', '=', guardado.grupoId)
      .execute();
    const elegir = (...nombres: string[]) =>
      ids.filter((o) => nombres.includes(o.nombre)).map((o) => o.id);
    const { ordenId } = exigirOk(
      await comando(abrirMesa, {
        entrada: { mesaId: mesaDe(salon, 3), personas: 2 },
        ambito: caja(),
        idempotencyKey: clave(),
      }),
      'restaurante.abrir_mesa',
    );
    exigirOk(
      await comando(enviarPedido, {
        entrada: {
          ordenId,
          lineas: [
            {
              productoId: platillo,
              cantidad: '1',
              opciones: [
                { grupoId: guardado.grupoId, opcionIds: elegir('Sin cilantro', 'Sin cebolla') },
              ],
            },
          ],
        },
        ambito: caja(),
        idempotencyKey: clave(),
      }),
      'restaurante.enviar_pedido',
    );
    const linea = await obtenerDb()
      .selectFrom('orden_lineas')
      .select('subtotal_centavos')
      .where('orden_id', '=', ordenId)
      .executeTakeFirstOrThrow();
    expect(linea.subtotal_centavos).toBe(PRECIO_GUACAMOLE);
    const { lineas } = exigirOk(
      await comando(ticketDeOrden, {
        entrada: { ordenId },
        ambito: caja(),
        idempotencyKey: clave(),
      }),
      'venta.ticket',
    );
    expect(lineas[0]?.opciones).toContain('Sin cilantro');
    expect(lineas[0]?.opciones).toContain('Sin cebolla');
    expect(lineas[0]?.opciones).not.toContain('+$');
  });
});
