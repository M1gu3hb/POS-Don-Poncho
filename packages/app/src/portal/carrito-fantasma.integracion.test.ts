import { conTransaccion, obtenerDb } from '@morphiqpos/data';
import { sql } from 'kysely';
import { describe, expect, it } from 'vitest';

import { comando } from '../produccion.ts';
import { clave, exigirOk } from '../pruebas/negocio-real.ts';
import { pasarMesaCobradaALimpieza } from '../restaurante/mesas-escrituras.ts';
import { abrirMesa, liberarMesa } from '../restaurante/mesas.ts';
import { HORAS_SIN_ACTIVIDAD } from './carrito.ts';
import { mesaConPortal, TELEFONO_A, TELEFONO_B } from './pruebas/mesa-con-portal.ts';

/**
 * DP-13.2 · EL CARRITO FANTASMA, contra Postgres real.
 *
 * Después de cobrar, la mesa pasa a limpieza y su carrito se olvida; pero el teléfono de la familia
 * que se fue sigue abierto, y lo que agregaba entonces se quedaba colgado de la MESA y le aparecía a
 * la siguiente familia. Ahora liberar la mesa también lo olvida; y el carrito de una mesa sin
 * cuenta caduca solo a las tres horas sin que nadie agregue nada.
 */

async function telefonosDeLaMesa(mesaId: string): Promise<number> {
  const filas = await obtenerDb()
    .selectFrom('dispositivos_mesa')
    .select('dispositivo_huella')
    .where('mesa_id', '=', mesaId)
    .execute();
  return filas.length;
}

async function lineasEnElCarrito(mesaId: string): Promise<number> {
  const fila = await obtenerDb()
    .selectFrom('carrito_mesa_lineas')
    .select((eb) => eb.fn.countAll<string>().as('n'))
    .where('mesa_id', '=', mesaId)
    .executeTakeFirst();
  return Number(fila?.n ?? 0);
}

describe('el carrito fantasma (DP-13.2)', () => {
  it('cobrar → un teléfono agrega con la mesa en limpieza → liberar: lo posterior al cierre se queda (DP-14.1-3)', async () => {
    const caso = await mesaConPortal();
    const { ventaId } = await caso.abrir(2);
    // El cobro: la cuenta queda pagada y la mesa pasa a limpieza (su carrito se olvida ahí).
    await obtenerDb()
      .updateTable('ordenes')
      .set({ estado: 'pagada', cerrada_en: new Date(), serie: 'T', folio: 1n })
      .where('id', '=', ventaId)
      .execute();
    await conTransaccion((tx) =>
      pasarMesaCobradaALimpieza(tx, caso.negocio.organizacionId, ventaId, {
        empleoId: caso.ambito.empleoId,
        ahora: new Date(Date.now() - 5_000),
      }),
    );
    // DP-14.1-3: con la mesa en limpieza los comensales ya arman su carrito, y no se puede saber si
    // el teléfono es el de la familia que se fue o el de la nueva: lo posterior al cierre de la
    // cuenta es de la familia nueva y «mesa limpia» NO lo borra (antes sí: DP-13.2).
    exigirOk(await caso.agregar(TELEFONO_A, caso.taco), 'agregar después de cobrar');
    await caso.mirar(TELEFONO_A);
    expect(await lineasEnElCarrito(caso.mesaId)).toBe(1);
    expect(await telefonosDeLaMesa(caso.mesaId)).toBeGreaterThan(0);

    exigirOk(
      await comando(liberarMesa, {
        ambito: caso.ambito,
        entrada: { mesaId: caso.mesaId },
        idempotencyKey: clave(),
      }),
      'liberar',
    );
    expect(await lineasEnElCarrito(caso.mesaId)).toBe(1);
    expect(await telefonosDeLaMesa(caso.mesaId)).toBe(1);

    await caso.abrir(3);
    expect((await caso.mirar(TELEFONO_B))?.lineas).toHaveLength(1);
  });

  it(`sin cuenta, a las ${String(HORAS_SIN_ACTIVIDAD)} h sin agregar nada caduca: no se ve y al agregar se borra`, async () => {
    const caso = await mesaConPortal();
    exigirOk(await caso.agregar(TELEFONO_A, caso.taco), 'agregar');
    const despues = new Date(Date.now() + (HORAS_SIN_ACTIVIDAD * 60 + 1) * 60_000);
    expect((await caso.mirar(TELEFONO_B, despues))?.lineas).toEqual([]);
    expect((await caso.mirar(TELEFONO_B))?.lineas).toHaveLength(1);

    // Lo viejo, de hace más de tres horas: al agregar algo nuevo se va.
    await sql`
      update carrito_mesa_lineas
         set created_at = now() - make_interval(hours => ${HORAS_SIN_ACTIVIDAD}, mins => 1)
       where mesa_id = ${caso.mesaId}
    `.execute(obtenerDb());
    exigirOk(await caso.agregar(TELEFONO_B, caso.agua), 'agregar lo nuevo');
    const visto = await caso.mirar(TELEFONO_B);
    expect(visto?.lineas.map((l) => l.nombre)).toEqual(['Agua de jamaica']);
    expect(await lineasEnElCarrito(caso.mesaId)).toBe(1);
  });

  it('con la cuenta abierta no caduca: es el pedido de una mesa servida', async () => {
    const caso = await mesaConPortal();
    await caso.abrir(2);
    exigirOk(await caso.agregar(TELEFONO_A, caso.taco), 'agregar');
    const despues = new Date(Date.now() + (HORAS_SIN_ACTIVIDAD * 60 + 1) * 60_000);
    expect((await caso.mirar(TELEFONO_B, despues))?.lineas).toHaveLength(1);
  });

  it('agregar a una mesa que ya caducó nunca supera el tope por lo viejo', async () => {
    const caso = await mesaConPortal();
    for (let i = 0; i < 3; i += 1) {
      exigirOk(await caso.agregar(TELEFONO_A, caso.taco, '1', `viejo ${String(i)}`), 'agregar');
    }
    await sql`
      update carrito_mesa_lineas
         set created_at = now() - make_interval(hours => ${HORAS_SIN_ACTIVIDAD + 1})
       where mesa_id = ${caso.mesaId}
    `.execute(obtenerDb());
    exigirOk(await caso.agregar(TELEFONO_B, caso.agua), 'agregar');
    expect(await lineasEnElCarrito(caso.mesaId)).toBe(1);
  });

  it('revisión DP-13 · un carrito viejo de una mesa sin cuenta no revive cuando, horas después, se abre la mesa', async () => {
    const caso = await mesaConPortal();
    exigirOk(await caso.agregar(TELEFONO_A, caso.taco), 'agregar');
    await sql`
      update carrito_mesa_lineas
         set created_at = now() - make_interval(hours => ${HORAS_SIN_ACTIVIDAD + 1})
       where mesa_id = ${caso.mesaId}
    `.execute(obtenerDb());
    await caso.abrir(2);
    // Abrir la mesa lo borra (antes de que nadie lo lea): no depende de la lectura.
    expect(await lineasEnElCarrito(caso.mesaId)).toBe(0);
    expect((await caso.mirar(TELEFONO_B))?.lineas).toEqual([]);
  });

  it('revisión DP-13 · también cuando la abre el mesero (no el comensal): abrir borra el carrito viejo', async () => {
    const caso = await mesaConPortal();
    exigirOk(await caso.agregar(TELEFONO_A, caso.taco), 'agregar');
    await sql`
      update carrito_mesa_lineas
         set created_at = now() - make_interval(hours => ${HORAS_SIN_ACTIVIDAD + 1})
       where mesa_id = ${caso.mesaId}
    `.execute(obtenerDb());
    exigirOk(
      await comando(abrirMesa, {
        ambito: caso.ambito,
        entrada: { mesaId: caso.mesaId, personas: 2 },
        idempotencyKey: clave(),
      }),
      'restaurante.abrir_mesa',
    );
    expect(await lineasEnElCarrito(caso.mesaId)).toBe(0);
  });

  it('revisión DP-13 · con la cuenta abierta, lo que se armó horas ANTES de abrir no se enseña', async () => {
    // Por si un carrito de antes llega a una mesa ya abierta por otro camino: la lectura mide
    // hasta la apertura, no hasta ahora, y no lo revive.
    const caso = await mesaConPortal();
    await caso.abrir(2);
    exigirOk(await caso.agregar(TELEFONO_A, caso.taco), 'agregar');
    await sql`
      update carrito_mesa_lineas
         set created_at = (select created_at from ordenes
                            where id = (select orden_activa_id from mesas where id = ${caso.mesaId}))
                          - make_interval(hours => ${HORAS_SIN_ACTIVIDAD + 1})
       where mesa_id = ${caso.mesaId}
    `.execute(obtenerDb());
    expect((await caso.mirar(TELEFONO_B))?.lineas).toEqual([]);
  });
});

describe('el carrito caducado se dice y resuelve su aviso (DP-14.6, medio 5)', () => {
  it('una lectura que lo encuentra caducado resuelve el aviso y avisa al comensal', async () => {
    const caso = await mesaConPortal({ envian: 'mesero' });
    exigirOk(await caso.agregar(TELEFONO_A, caso.taco), 'agregar');
    exigirOk(await caso.llamar(TELEFONO_A), 'llamar al mesero');
    const vivos = () =>
      obtenerDb()
        .selectFrom('solicitudes_qr')
        .select('estado')
        .where('mesa_id', '=', caso.mesaId)
        .where('tipo', '=', 'ordenar')
        .where('estado', 'in', ['pendiente', 'atendida'])
        .execute();
    expect(await vivos()).toHaveLength(1);
    expect((await caso.mirar(TELEFONO_A))?.caducado).toBe(false);

    const despues = new Date(Date.now() + (HORAS_SIN_ACTIVIDAD * 60 + 1) * 60_000);
    // Ronda 2: el aviso lo lee el teléfono que estaba en el carrito (A), no uno que llega después.
    const visto = await caso.mirar(TELEFONO_A, despues);
    expect(visto).toMatchObject({ caducado: true, lineas: [], meseroAvisado: false });
    expect(await vivos()).toHaveLength(0);
  });
});
