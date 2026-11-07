import { conTransaccion, obtenerDb } from '@morphiqpos/data';
import { describe, expect, it } from 'vitest';

import { comando } from '../produccion.ts';
import { clave, exigirOk } from '../pruebas/negocio-real.ts';
import {
  mesaConPortal,
  PIMIENTA,
  TELEFONO_A,
  TELEFONO_B,
} from '../portal/pruebas/mesa-con-portal.ts';
import { huellaDelTelefono } from '../portal/telefono.ts';
import { pasarMesaCobradaALimpieza } from './mesas-escrituras.ts';
import { abrirMesa, liberarMesa } from './mesas.ts';

/**
 * DP-14.1-3 · «MESA LIMPIA» NO BORRA A LA FAMILIA QUE YA SE SENTÓ, contra Postgres real.
 *
 * Con la mesa en limpieza los comensales ya arman su carrito desde el QR (DP-D45: ellos arman, el
 * mesero confirma). Marcar «mesa limpia» borraba todo: el carrito de la familia NUEVA, sus
 * teléfonos y su aviso «Pedido listo». Ahora borra sólo lo anterior al momento en que la mesa
 * pasó a limpieza (el sello del ledger de la mesa); sin ese momento —una mesa liberada sin cuenta—
 * conserva el comportamiento de siempre.
 */

const HACE_UNA_HORA = new Date(Date.now() - 3_600_000);

async function lineas(mesaId: string) {
  return obtenerDb()
    .selectFrom('carrito_mesa_lineas')
    .select(['producto_id', 'dispositivo_huella'])
    .where('mesa_id', '=', mesaId)
    .execute();
}

async function huellas(mesaId: string): Promise<string[]> {
  const filas = await obtenerDb()
    .selectFrom('dispositivos_mesa')
    .select('dispositivo_huella')
    .where('mesa_id', '=', mesaId)
    .execute();
  return filas.map((f) => f.dispositivo_huella);
}

async function avisosDe(mesaId: string) {
  return obtenerDb()
    .selectFrom('solicitudes_qr')
    .select(['id', 'tipo', 'estado', 'notas'])
    .where('mesa_id', '=', mesaId)
    .orderBy('created_at')
    .execute();
}

/** Con «sólo el mesero envía» el comensal no abre la mesa: la abre el mesero. */
async function abrirComoMesero(caso: Awaited<ReturnType<typeof mesaConPortal>>): Promise<string> {
  await obtenerDb()
    .insertInto('estaciones_preparacion')
    .values({
      organizacion_id: caso.negocio.organizacionId,
      nombre: 'Cocina general',
      es_general: true,
    })
    .onConflict((oc) => oc.doNothing())
    .execute();
  return exigirOk(
    await comando(abrirMesa, {
      ambito: caso.ambito,
      entrada: { mesaId: caso.mesaId, personas: 2 },
      idempotencyKey: clave(),
    }),
    'restaurante.abrir_mesa',
  ).ordenId;
}

describe('«mesa limpia» y la familia que ya se sentó (DP-14.1-3)', () => {
  it('cuenta cobrada → limpieza → teléfono nuevo arma 2 platillos con su aviso → mesa limpia: lo nuevo sigue, lo de antes se va', async () => {
    const caso = await mesaConPortal({ envian: 'mesero' });
    const ventaId = await abrirComoMesero(caso);
    const org = caso.negocio.organizacionId;
    await obtenerDb()
      .updateTable('ordenes')
      .set({ estado: 'pagada', cerrada_en: new Date(), serie: 'T', folio: 1n })
      .where('id', '=', ventaId)
      .execute();
    // El cierre de la cuenta: la mesa pasa a limpieza hace unos segundos.
    const cierre = new Date(Date.now() - 5_000);
    await conTransaccion((tx) =>
      pasarMesaCobradaALimpieza(tx, org, ventaId, {
        empleoId: caso.ambito.empleoId,
        ahora: cierre,
      }),
    );

    // Lo de ANTES del cierre que sobrevivió hasta aquí: una línea, un teléfono y dos avisos.
    const huellaVieja = huellaDelTelefono(PIMIENTA, TELEFONO_A);
    const db = obtenerDb();
    await db
      .insertInto('carrito_mesa_lineas')
      .values({
        organizacion_id: org,
        mesa_id: caso.mesaId,
        dispositivo_huella: huellaVieja,
        producto_id: caso.taco,
        cantidad: '1',
        created_at: HACE_UNA_HORA,
      })
      .execute();
    await db
      .insertInto('dispositivos_mesa')
      .values({
        organizacion_id: org,
        mesa_id: caso.mesaId,
        dispositivo_huella: huellaVieja,
        visto_en: HACE_UNA_HORA,
      })
      .execute();
    await db
      .insertInto('solicitudes_qr')
      .values([
        {
          organizacion_id: org,
          mesa_id: caso.mesaId,
          tipo: 'cuenta',
          estado: 'pendiente',
          created_at: HACE_UNA_HORA,
        },
        {
          organizacion_id: org,
          mesa_id: caso.mesaId,
          tipo: 'ayuda',
          estado: 'atendida',
          created_at: HACE_UNA_HORA,
        },
      ])
      .execute();

    // La familia NUEVA, ya sentada con la mesa en limpieza: 2 platillos y su aviso.
    exigirOk(await caso.agregar(TELEFONO_B, caso.taco), 'agregar el taco');
    exigirOk(await caso.agregar(TELEFONO_B, caso.agua), 'agregar el agua');
    await caso.mirar(TELEFONO_B);
    exigirOk(await caso.llamar(TELEFONO_B), 'llamar al mesero');
    const huellaNueva = huellaDelTelefono(PIMIENTA, TELEFONO_B);

    exigirOk(
      await comando(liberarMesa, {
        ambito: caso.ambito,
        entrada: { mesaId: caso.mesaId },
        idempotencyKey: clave(),
      }),
      'restaurante.liberar_mesa',
    );

    const quedan = await lineas(caso.mesaId);
    expect(
      quedan.map((l) => l.producto_id).sort(),
      'el carrito de la familia nueva se borró',
    ).toEqual([caso.taco, caso.agua].sort());
    expect(
      quedan.every((l) => l.dispositivo_huella === huellaNueva),
      'quedó una línea de la familia vieja',
    ).toBe(true);
    expect(await huellas(caso.mesaId), 'el teléfono nuevo se borró o el viejo se quedó').toEqual([
      huellaNueva,
    ]);

    const avisos = await avisosDe(caso.mesaId);
    const vivos = avisos.filter((a) => a.estado === 'pendiente' || a.estado === 'atendida');
    expect(
      vivos.map((a) => a.tipo),
      'sólo el aviso «Pedido listo» sigue vivo',
    ).toEqual(['ordenar']);
    expect(vivos[0]?.notas).toContain('Pedido listo para confirmar');
    expect(
      avisos
        .filter((a) => a.estado === 'resuelta')
        .map((a) => a.tipo)
        .sort(),
    ).toEqual(['ayuda', 'cuenta']);
  });

  it('una mesa liberada sin cuenta (sin momento de cierre) conserva el comportamiento de siempre: todo se va', async () => {
    const caso = await mesaConPortal({ envian: 'mesero' });
    await abrirComoMesero(caso);
    exigirOk(await caso.agregar(TELEFONO_B, caso.taco), 'agregar');
    await caso.mirar(TELEFONO_B);
    exigirOk(await caso.llamar(TELEFONO_B), 'llamar');
    expect(await lineas(caso.mesaId)).toHaveLength(1);

    exigirOk(
      await comando(liberarMesa, {
        ambito: caso.ambito,
        entrada: { mesaId: caso.mesaId },
        idempotencyKey: clave(),
      }),
      'restaurante.liberar_mesa',
    );
    expect(await lineas(caso.mesaId)).toHaveLength(0);
    expect(await huellas(caso.mesaId)).toEqual([]);
    const vivos = (await avisosDe(caso.mesaId)).filter(
      (a) => a.estado === 'pendiente' || a.estado === 'atendida',
    );
    expect(vivos).toEqual([]);
  });
});
