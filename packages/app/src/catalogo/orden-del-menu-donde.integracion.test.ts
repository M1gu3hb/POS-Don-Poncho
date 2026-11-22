import { randomUUID } from 'node:crypto';

import { obtenerDb } from '@morphiqpos/data';
import { beforeAll, describe, expect, it } from 'vitest';
import type { z } from 'zod';

import { comando } from '../produccion.ts';
import { clave, exigirOk } from '../pruebas/negocio-real.ts';
import { abrirCajaReal, armarVenta, cobrarEnEfectivo } from '../pruebas/negocio-real.ts';
import { payloadDelPortal } from '../portal/consulta.ts';
import { PIMIENTA, TELEFONO_A, mesaConPortal } from '../portal/pruebas/mesa-con-portal.ts';
import { entradaMostrarEnMenu, mostrarProductoEnElMenu } from './orden-del-menu.ts';

/**
 * DP-25 · Parte 8 · DP-D227 · «OCULTAR» DEL MENÚ ELIGIENDO DÓNDE, contra Postgres.
 *
 * Un platillo se oculta del portal QR (`visible_en_menu_digital`), del POS —mesero y Caja—
 * (`visible_en_pos`) o de todo. Cada lugar es independiente: oculto del POS sigue en el portal y
 * al revés. Lo oculto del POS que ya está en una cuenta se sigue cobrando.
 */

type Caso = Awaited<ReturnType<typeof mesaConPortal>>;
let caso: Caso;
let org = '';

const correr = (
  entrada: z.input<typeof entradaMostrarEnMenu>,
  rol: 'cajero' | 'mesero' | 'dueno' | 'gerente' = 'dueno',
) =>
  comando(mostrarProductoEnElMenu as never, {
    entrada,
    ambito: { ...caso.ambito, rol },
    idempotencyKey: clave(),
  }) as Promise<{ ok: boolean; datos?: unknown; error?: { codigo: string; datos?: unknown } }>;

const banderas = async (productoId: string) =>
  obtenerDb()
    .selectFrom('productos')
    .select(['visible_en_menu_digital as portal', 'visible_en_pos as pos'])
    .where('id', '=', productoId)
    .executeTakeFirstOrThrow();

const menuDelPortal = async (): Promise<readonly string[]> =>
  (await payloadDelPortal(org, caso.qrToken, PIMIENTA)).productos.map((p) => p.nombre);

const auditorias = async () =>
  obtenerDb()
    .selectFrom('auditoria')
    .select('payload')
    .where('organizacion_id', '=', org)
    .where('accion', '=', 'catalogo.mostrar_en_menu')
    .execute();

beforeAll(async () => {
  caso = await mesaConPortal();
  org = caso.negocio.organizacionId;
  // Cobrar manda lo preparado a su estación: sin una general activa el cobro se rechaza.
  await obtenerDb()
    .insertInto('estaciones_preparacion')
    .values({
      id: randomUUID(),
      organizacion_id: org,
      nombre: 'Cocina',
      es_general: true,
      orden: 1,
    })
    .execute();
});

describe('DP-D227 · ocultar un platillo eligiendo dónde', () => {
  it('«del POS» lo quita del POS y lo deja en el portal; volver a mostrarlo lo regresa', async () => {
    await caso.abrir(1);
    expect((await correr({ productoId: caso.taco, visibleEnPos: false })).ok).toBe(true);
    expect(await banderas(caso.taco)).toEqual({ portal: true, pos: false });
    expect(await menuDelPortal()).toContain('Taco de barbacoa');
    exigirOk(await caso.agregar(TELEFONO_A, caso.taco), 'el portal sí lo deja pedir');

    expect((await correr({ productoId: caso.taco, visibleEnPos: true })).ok).toBe(true);
    expect(await banderas(caso.taco)).toEqual({ portal: true, pos: true });
  });

  it('«del portal» lo quita del portal (y no deja pedirlo) y lo deja en el POS', async () => {
    const r = await correr({ productoId: caso.agua, visible: false });
    expect(r.ok).toBe(true);
    expect(await banderas(caso.agua)).toEqual({ portal: false, pos: true });
    expect(await menuDelPortal()).not.toContain('Agua de jamaica');
    expect((await caso.agregar(TELEFONO_A, caso.agua)).ok).toBe(false);
    await correr({ productoId: caso.agua, visible: true });
  });

  it('«de todo» apaga los dos en un solo movimiento, con UNA auditoría de los dos', async () => {
    const antes = (await auditorias()).length;
    const r = await correr({ productoId: caso.taco, visible: false, visibleEnPos: false });
    expect(r.ok).toBe(true);
    expect(await banderas(caso.taco)).toEqual({ portal: false, pos: false });
    const despues = await auditorias();
    expect(despues.length).toBe(antes + 1);
    // Sin orden garantizado: se busca la fila que apagó los dos.
    const deTodo = despues.filter((f) => {
      const p = f.payload as { portal?: { despues?: boolean }; pos?: { despues?: boolean } };
      return p.portal?.despues === false && p.pos?.despues === false;
    });
    expect(deTodo).toHaveLength(1);
    expect(deTodo[0]?.payload).toMatchObject({
      portal: { antes: true, despues: false },
      pos: { antes: true, despues: false },
    });
    await correr({ productoId: caso.taco, visible: true, visibleEnPos: true });
    expect(await banderas(caso.taco)).toEqual({ portal: true, pos: true });
  });

  it('sin cambio no deja auditoría; sin decir dónde se rechaza', async () => {
    const antes = (await auditorias()).length;
    expect((await correr({ productoId: caso.taco, visibleEnPos: true })).ok).toBe(true);
    expect((await auditorias()).length).toBe(antes);
    const vacio = await correr({ productoId: caso.taco });
    expect(vacio.ok).toBe(false);
  });

  it('la cajera y el mesero no cambian dónde se ve; el gerente sí', async () => {
    for (const rol of ['cajero', 'mesero'] as const) {
      const r = await correr({ productoId: caso.taco, visibleEnPos: false }, rol);
      expect(r.error?.codigo).toBe('SIN_PERMISO');
    }
    expect(await banderas(caso.taco)).toEqual({ portal: true, pos: true });
    expect((await correr({ productoId: caso.taco, visibleEnPos: false }, 'gerente')).ok).toBe(true);
    await correr({ productoId: caso.taco, visibleEnPos: true });
  });

  it('un platillo que no existe se rechaza', async () => {
    const r = await correr({ productoId: randomUUID(), visibleEnPos: false });
    expect(r.ok).toBe(false);
    expect(JSON.stringify(r)).toContain('PRODUCTO_NO_ENCONTRADO');
  });

  it('lo oculto del POS que ya está en una cuenta abierta se sigue cobrando', async () => {
    await abrirCajaReal(caso.ambito);
    const venta = await armarVenta(caso.ambito, [{ productoId: caso.agua, cantidad: '2' }]);
    expect((await correr({ productoId: caso.agua, visibleEnPos: false })).ok).toBe(true);
    const cobro = await cobrarEnEfectivo(caso.ambito, venta.ordenId, venta.totalCentavos);
    exigirOk(cobro, 'el cobro de lo oculto del POS');
    await correr({ productoId: caso.agua, visibleEnPos: true });
  });
});
