import { conTransaccion, obtenerDb } from '@morphiqpos/data';
import { sql } from 'kysely';
import { describe, expect, it } from 'vitest';

import { comando } from '../produccion.ts';
import { clave, exigirOk } from '../pruebas/negocio-real.ts';
import {
  cambiarEnElCarrito,
  enviarElCarritoDeLaMesa,
  quitarDelCarritoDeLaMesa,
} from '../restaurante/carrito-del-mesero.ts';
import { olvidarLosCarritosDeLaSucursal } from '../restaurante/carrito-del-salon.ts';
import { pasarMesaCobradaALimpieza } from '../restaurante/mesas-escrituras.ts';
import { abrirMesa } from '../restaurante/mesas.ts';
import { atenderSolicitud } from '../restaurante/solicitudes.ts';
import { HORAS_SIN_ACTIVIDAD } from './carrito.ts';
import { quitarDelCarrito } from './carrito-comandos.ts';
import { mesaConPortal, TELEFONO_A, TELEFONO_B } from './pruebas/mesa-con-portal.ts';

/**
 * DP-13.2 · EL AVISO «PEDIDO LISTO PARA CONFIRMAR», contra Postgres real.
 *
 * Se resolvía sólo al vaciar o enviar desde el mesero. Ahora se resuelve siempre que el carrito
 * queda vacío o se envía, por cualquier camino; «Atender» no lo consume (sigue vivo hasta que el
 * pedido sale o se borra); al resolver, sólo ese aviso y no los demás `ordenar` de la mesa;
 * «Volver a llamar» lo renueva (otro aviso, para que se anuncie y se diga otra vez); y llamar toma
 * el candado del carrito.
 */

async function avisos(mesaId: string) {
  return obtenerDb()
    .selectFrom('solicitudes_qr')
    .select(['id', 'estado', 'notas'])
    .where('mesa_id', '=', mesaId)
    .where('tipo', '=', 'ordenar')
    .orderBy('created_at')
    .execute();
}

/** Con «sólo el mesero envía» el comensal no abre la mesa: la abre el mesero. */
async function abrirComoMesero(caso: Awaited<ReturnType<typeof mesaConPortal>>) {
  // El envío del mesero exige estación (regla 10): la general.
  await obtenerDb()
    .insertInto('estaciones_preparacion')
    .values({
      organizacion_id: caso.negocio.organizacionId,
      nombre: 'Cocina general',
      es_general: true,
    })
    .onConflict((oc) => oc.doNothing())
    .execute();
  exigirOk(
    await comando(abrirMesa, {
      ambito: caso.ambito,
      entrada: { mesaId: caso.mesaId, personas: 2 },
      idempotencyKey: clave(),
    }),
    'abrir',
  );
}

const vivos = async (mesaId: string) =>
  (await avisos(mesaId)).filter((a) => a.estado === 'pendiente' || a.estado === 'atendida');

async function lineaDe(mesaId: string, cual = 0): Promise<string> {
  const filas = await obtenerDb()
    .selectFrom('carrito_mesa_lineas')
    .select('id')
    .where('mesa_id', '=', mesaId)
    .orderBy('created_at')
    .execute();
  return filas[cual]?.id ?? '';
}

describe('el aviso del pedido (DP-13.2)', () => {
  it('el comensal quita lo último: el aviso se resuelve', async () => {
    const caso = await mesaConPortal({ envian: 'mesero' });
    exigirOk(await caso.agregar(TELEFONO_A, caso.taco), 'agregar');
    exigirOk(await caso.llamar(TELEFONO_A), 'llamar');
    expect(await vivos(caso.mesaId)).toHaveLength(1);
    exigirOk(
      await caso.publico(quitarDelCarrito, {
        dispositivo: TELEFONO_A,
        lineaId: await lineaDe(caso.mesaId),
      }),
      'quitar',
    );
    expect(await vivos(caso.mesaId)).toHaveLength(0);
  });

  it('el mesero cambia una cantidad y el aviso sigue; quita lo último y se resuelve', async () => {
    const caso = await mesaConPortal({ envian: 'mesero' });
    exigirOk(await caso.agregar(TELEFONO_A, caso.taco), 'agregar');
    exigirOk(await caso.llamar(TELEFONO_A), 'llamar');
    const lineaId = await lineaDe(caso.mesaId);
    exigirOk(
      await comando(cambiarEnElCarrito, {
        ambito: caso.ambito,
        entrada: { mesaId: caso.mesaId, lineaId, cantidad: '3' },
        idempotencyKey: clave(),
      }),
      'cambiar',
    );
    expect(await vivos(caso.mesaId)).toHaveLength(1);
    exigirOk(
      await comando(quitarDelCarritoDeLaMesa, {
        ambito: caso.ambito,
        entrada: { mesaId: caso.mesaId, lineaId },
        idempotencyKey: clave(),
      }),
      'quitar',
    );
    expect(await vivos(caso.mesaId)).toHaveLength(0);
  });

  it('el comensal envía (también los comensales): el aviso se resuelve', async () => {
    const caso = await mesaConPortal({ envian: 'mesero' });
    exigirOk(await caso.agregar(TELEFONO_A, caso.taco), 'agregar');
    exigirOk(await caso.llamar(TELEFONO_A), 'llamar');
    await abrirComoMesero(caso);
    // El negocio cambia a «también los comensales» con el aviso ya puesto.
    await obtenerDb()
      .updateTable('configuracion')
      .set((eb) => ({
        valores: eb('valores', '||', JSON.stringify({ portal_qr_envia_a_cocina: 'comensales' })),
      }))
      .where('organizacion_id', '=', caso.negocio.organizacionId)
      .execute();
    exigirOk(await caso.enviar(TELEFONO_A, true), 'enviar');
    expect(await vivos(caso.mesaId)).toHaveLength(0);
  });

  it('«Atender» no lo consume: sigue vivo hasta que el pedido sale', async () => {
    const caso = await mesaConPortal({ envian: 'mesero' });
    exigirOk(await caso.agregar(TELEFONO_A, caso.taco), 'agregar');
    const { solicitudId } = exigirOk(await caso.llamar(TELEFONO_A), 'llamar');
    exigirOk(
      await comando(atenderSolicitud, {
        ambito: caso.ambito,
        entrada: { solicitudId, estado: 'atendida' },
        idempotencyKey: clave(),
      }),
      'atender',
    );
    expect((await vivos(caso.mesaId)).map((a) => a.estado)).toEqual(['pendiente']);
    await abrirComoMesero(caso);
    exigirOk(
      await comando(enviarElCarritoDeLaMesa, {
        ambito: caso.ambito,
        entrada: { mesaId: caso.mesaId, notaGeneral: '' },
        idempotencyKey: clave(),
      }),
      'enviar',
    );
    expect(await vivos(caso.mesaId)).toHaveLength(0);
  });

  it('al resolver, sólo el aviso del pedido: otro «ordenar» de la mesa se queda', async () => {
    const caso = await mesaConPortal({ envian: 'mesero' });
    // Un «Quiero ordenar» que ya atendieron (no es el aviso del carrito).
    await obtenerDb()
      .insertInto('solicitudes_qr')
      .values({
        organizacion_id: caso.negocio.organizacionId,
        mesa_id: caso.mesaId,
        tipo: 'ordenar',
        estado: 'atendida',
        origen: 'portal_qr',
        ruteo_modo: 'general',
      })
      .execute();
    exigirOk(await caso.agregar(TELEFONO_A, caso.taco), 'agregar');
    exigirOk(await caso.llamar(TELEFONO_A), 'llamar');
    await abrirComoMesero(caso);
    exigirOk(
      await comando(enviarElCarritoDeLaMesa, {
        ambito: caso.ambito,
        entrada: { mesaId: caso.mesaId, notaGeneral: '' },
        idempotencyKey: clave(),
      }),
      'enviar',
    );
    const quedan = await vivos(caso.mesaId);
    expect(quedan.map((a) => [a.estado, a.notas])).toEqual([['atendida', null]]);
  });

  it('«Volver a llamar» renueva el aviso: el viejo se resuelve y llega uno nuevo', async () => {
    const caso = await mesaConPortal({ envian: 'mesero' });
    exigirOk(await caso.agregar(TELEFONO_A, caso.taco), 'agregar');
    const primero = exigirOk(await caso.llamar(TELEFONO_A), 'llamar');
    exigirOk(await caso.agregar(TELEFONO_B, caso.agua), 'agregar');
    const segundo = exigirOk(await caso.llamar(TELEFONO_B), 'volver a llamar');
    expect(segundo.yaAvisado).toBe(true);
    expect(segundo.solicitudId).not.toBe(primero.solicitudId);
    const vivosAhora = await vivos(caso.mesaId);
    expect(vivosAhora.map((a) => [a.id, a.notas])).toEqual([
      [segundo.solicitudId, 'Pedido listo para confirmar (2 platillos)'],
    ]);
  });

  it('llamar espera el candado del carrito (no se cruza con un envío)', async () => {
    const caso = await mesaConPortal({ envian: 'mesero' });
    exigirOk(await caso.agregar(TELEFONO_A, caso.taco), 'agregar');
    let llamado = false;
    await conTransaccion(async (tx) => {
      await tx
        .insertInto('carritos_mesa')
        .values({ organizacion_id: caso.negocio.organizacionId, mesa_id: caso.mesaId })
        .onConflict((oc) => oc.columns(['organizacion_id', 'mesa_id']).doNothing())
        .execute();
      await tx
        .selectFrom('carritos_mesa')
        .select('ronda')
        .where('mesa_id', '=', caso.mesaId)
        .forUpdate()
        .execute();
      const enCurso = caso.llamar(TELEFONO_A).then(() => {
        llamado = true;
      });
      await new Promise((listo) => setTimeout(listo, 600));
      expect(llamado, 'llamar no esperó el candado del carrito').toBe(false);
      void enCurso;
    });
    await expect.poll(() => llamado, { timeout: 10_000 }).toBe(true);
  });

  it('revisión DP-13 · si el carrito se borra en masa (cobro, cierre del día), su aviso se resuelve', async () => {
    const cobrada = await mesaConPortal({ envian: 'mesero' });
    await abrirComoMesero(cobrada);
    exigirOk(await cobrada.agregar(TELEFONO_A, cobrada.taco), 'agregar');
    exigirOk(await cobrada.llamar(TELEFONO_A), 'llamar');
    const { orden_activa_id } = await obtenerDb()
      .selectFrom('mesas')
      .select('orden_activa_id')
      .where('id', '=', cobrada.mesaId)
      .executeTakeFirstOrThrow();
    await obtenerDb()
      .updateTable('ordenes')
      .set({ estado: 'pagada', cerrada_en: new Date(), serie: 'T', folio: 1n })
      .where('id', '=', orden_activa_id ?? '')
      .execute();
    await conTransaccion((tx) =>
      pasarMesaCobradaALimpieza(tx, cobrada.negocio.organizacionId, orden_activa_id ?? '', {
        empleoId: cobrada.ambito.empleoId,
        ahora: new Date(),
      }),
    );
    expect(await vivos(cobrada.mesaId), 'el cobro dejó el aviso vivo').toHaveLength(0);

    const delDia = await mesaConPortal({ envian: 'mesero' });
    // Un «Quiero ordenar» atendido de la misma mesa: no es del carrito, el cierre no lo toca.
    const otro = await obtenerDb()
      .insertInto('solicitudes_qr')
      .values({
        organizacion_id: delDia.negocio.organizacionId,
        mesa_id: delDia.mesaId,
        tipo: 'ordenar',
        estado: 'atendida',
        origen: 'portal_qr',
        ruteo_modo: 'general',
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    exigirOk(await delDia.agregar(TELEFONO_A, delDia.taco), 'agregar');
    exigirOk(await delDia.llamar(TELEFONO_A), 'llamar');
    await conTransaccion((tx) =>
      olvidarLosCarritosDeLaSucursal(
        tx,
        delDia.negocio.organizacionId,
        delDia.sucursalId,
        new Date(),
      ),
    );
    expect(
      (await vivos(delDia.mesaId)).filter((a) => a.id !== otro.id),
      'cerrar el día dejó el aviso vivo',
    ).toHaveLength(0);
    const elOtro = (await avisos(delDia.mesaId)).find((a) => a.id === otro.id);
    expect(elOtro?.estado, 'cerrar el día resolvió un «ordenar» que no era del carrito').toBe(
      'atendida',
    );
  });

  it('revisión DP-13 · si lo que esperaba el aviso caduca, el aviso se resuelve', async () => {
    const caso = await mesaConPortal({ envian: 'mesero' });
    exigirOk(await caso.agregar(TELEFONO_A, caso.taco), 'agregar');
    exigirOk(await caso.llamar(TELEFONO_A), 'llamar');
    await sql`
      update carrito_mesa_lineas
         set created_at = now() - make_interval(hours => ${HORAS_SIN_ACTIVIDAD + 1})
       where mesa_id = ${caso.mesaId}
    `.execute(obtenerDb());
    exigirOk(await caso.agregar(TELEFONO_B, caso.agua), 'agregar lo nuevo');
    expect(await vivos(caso.mesaId)).toHaveLength(0);
  });

  it('revisión DP-13 · quitar y agregar esperan el candado del carrito (no se cruzan con llamar)', async () => {
    const caso = await mesaConPortal({ envian: 'mesero' });
    exigirOk(await caso.agregar(TELEFONO_A, caso.taco), 'agregar');
    const linea = await lineaDe(caso.mesaId);
    let quitado = false;
    let agregado = false;
    await conTransaccion(async (tx) => {
      await tx
        .insertInto('carritos_mesa')
        .values({ organizacion_id: caso.negocio.organizacionId, mesa_id: caso.mesaId })
        .onConflict((oc) => oc.columns(['organizacion_id', 'mesa_id']).doNothing())
        .execute();
      await tx
        .selectFrom('carritos_mesa')
        .select('ronda')
        .where('mesa_id', '=', caso.mesaId)
        .forUpdate()
        .execute();
      const quitando = caso
        .publico(quitarDelCarrito, { dispositivo: TELEFONO_A, lineaId: linea })
        .then(() => {
          quitado = true;
        });
      const agregando = caso.agregar(TELEFONO_B, caso.agua).then(() => {
        agregado = true;
      });
      await new Promise((listo) => setTimeout(listo, 600));
      expect(quitado, 'quitar no esperó el candado del carrito').toBe(false);
      expect(agregado, 'agregar no esperó el candado del carrito').toBe(false);
      void quitando;
      void agregando;
    });
    await expect.poll(() => quitado && agregado, { timeout: 10_000 }).toBe(true);
  });
});
