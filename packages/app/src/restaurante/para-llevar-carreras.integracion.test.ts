import { obtenerDb } from '@morphiqpos/data';
import { sql } from 'kysely';
import { beforeAll, describe, expect, it } from 'vitest';

import { comando } from '../produccion.ts';
import { clave, exigirOk } from '../pruebas/negocio-real.ts';
import { armarParaLlevar } from './para-llevar.ts';
import { abrirLasCajas, ambitoDeCaja, sembrarSalon, type Salon } from './pruebas/salon-real.ts';

/**
 * DP-18 · M1 (auditoría del 10-11) · «ARMAR» Y «COBRAR» DEL MISMO BORRADOR, Y DOS «ARMAR» A LA VEZ.
 *
 * El pedido para llevar se escribe como el borrador de la terminal (`armar_para_llevar`) y se cobra
 * desde ahí (`venta.cobrar`). «Armar» leía el borrador SIN candado y borraba sus líneas sin mirar si
 * seguía siendo borrador: con un cobro del mismo borrador en vuelo (un segundo toque de «Cobrar»,
 * otra pestaña), le reescribía las líneas a una cuenta que en ese instante quedaba pagada. Y dos
 * «armar» a la vez en una terminal sin borrador creaban dos y el segundo moría con 23505.
 */

let salon: Salon;
let tacoId = '';
let aguaId = '';
const caja = (terminal = 0) => ambitoDeCaja(salon, terminal);

async function producto(nombre: string, precio: bigint): Promise<string> {
  const fila = await obtenerDb()
    .insertInto('productos')
    .values({
      organizacion_id: salon.negocio.organizacionId,
      nombre,
      precio_venta_centavos: precio,
      costo_unitario_centavos: 0n,
      estrategia_consumo: 'ninguno',
      area_preparacion: 'cocina',
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  return fila.id;
}

const armar = (productoId: string, cantidad: string, terminal = 0) =>
  comando(armarParaLlevar, {
    entrada: { lineas: [{ productoId, cantidad }] },
    ambito: caja(terminal),
    idempotencyKey: clave(),
  });

async function lineasDe(ordenId: string) {
  return obtenerDb()
    .selectFrom('orden_lineas')
    .select(['id', 'producto_id', 'cantidad'])
    .where('orden_id', '=', ordenId)
    .orderBy('id')
    .execute();
}

/** Espera a que alguna conexión de la base esté esperando un candado (nunca más de 10 s). */
async function hayAlguienEsperando(): Promise<boolean> {
  for (let i = 0; i < 100; i += 1) {
    const r = await sql<{ n: number }>`
      select count(*)::int as n from pg_stat_activity
       where datname = current_database() and wait_event_type = 'Lock'`.execute(obtenerDb());
    if ((r.rows[0]?.n ?? 0) > 0) return true;
    await new Promise((listo) => setTimeout(listo, 100));
  }
  return false;
}

beforeAll(async () => {
  salon = await sembrarSalon({ nombre: 'Carreras para llevar', mesas: 1, terminales: 2 });
  await abrirLasCajas(salon, 50_000);
  tacoId = await producto('Taco de prueba', 3_000n);
  aguaId = await producto('Agua de prueba', 2_000n);
});

describe('DP-18 · M1 · el borrador para llevar con dos manos encima', () => {
  it('«armar» espera al cobro del mismo borrador y no toca la cuenta que quedó pagada', async () => {
    const { ordenId } = exigirOk(await armar(tacoId, '2'), 'restaurante.armar_para_llevar');
    const antes = await lineasDe(ordenId);
    expect(antes).toHaveLength(1);

    // El cobro en vuelo: tiene el renglón de la orden con candado y está por dejarla pagada.
    // Mientras, otro «armar» del mismo aparato (un segundo toque, otra pestaña) llega.
    const enVuelo: Promise<Awaited<ReturnType<typeof armar>>>[] = [];
    await obtenerDb()
      .transaction()
      .execute(async (tx) => {
        await tx.selectFrom('ordenes').select('id').where('id', '=', ordenId).forUpdate().execute();
        enVuelo.push(armar(aguaId, '1'));
        // «armar» se topa con el candado (antes, ya había borrado los renglones al toparse).
        expect(await hayAlguienEsperando()).toBe(true);
        await tx
          .updateTable('ordenes')
          .set({ estado: 'pagada', cerrada_en: new Date(), serie: 'T', folio: 900_001n })
          .where('id', '=', ordenId)
          .execute();
      });
    // El cobro terminó (commit): «armar» sigue con lo que encuentre.
    const [pendiente] = enVuelo;
    if (pendiente === undefined) throw new Error('«armar» no salió');
    const resultado = exigirOk(await pendiente, 'restaurante.armar_para_llevar');

    // La cuenta cobrada conserva SUS renglones; «armar» empezó un borrador nuevo.
    expect(await lineasDe(ordenId)).toEqual(antes);
    expect(resultado.ordenId).not.toBe(ordenId);
    const nuevas = await lineasDe(resultado.ordenId);
    expect(nuevas.map((l) => l.producto_id)).toEqual([aguaId]);
  });

  it('dos «armar» a la vez en la misma terminal: los dos terminan y queda UN borrador, sin mezclar', async () => {
    // La otra terminal, sin borrador: los dos «armar» quieren crearlo a la vez.
    const [a, b] = await Promise.all([armar(tacoId, '3', 1), armar(aguaId, '4', 1)]);
    const ra = exigirOk(a, 'restaurante.armar_para_llevar');
    const rb = exigirOk(b, 'restaurante.armar_para_llevar');
    expect(ra.ordenId).toBe(rb.ordenId);

    const borradores = await obtenerDb()
      .selectFrom('ordenes')
      .select(['id', 'total_centavos'])
      .where('organizacion_id', '=', salon.negocio.organizacionId)
      .where('terminal_id', '=', salon.sucursal.terminales[1] ?? '')
      .where('estado', '=', 'borrador')
      .execute();
    expect(borradores).toHaveLength(1);
    const lineas = await lineasDe(ra.ordenId);
    // Gana el último en terminar, entero: o los 3 tacos o las 4 aguas, nunca las dos cosas.
    expect(lineas).toHaveLength(1);
    const total = lineas[0]?.producto_id === tacoId ? 9_000n : 8_000n;
    expect(BigInt(String(borradores[0]?.total_centavos))).toBe(total);
  });
});
