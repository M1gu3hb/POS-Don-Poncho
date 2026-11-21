import { obtenerDb } from '@morphiqpos/data';
import { sql } from 'kysely';
import { beforeAll, describe, expect, it } from 'vitest';

import { comando } from '../produccion.ts';
import { clave, exigirOk, sembrarCompanero } from '../pruebas/negocio-real.ts';
import { avisosDeListo } from './avisos-de-listo.ts';
import { moverPlatillos } from './mover-platillos.ts';
import { transicionarPedido, entregarPedidos } from './preparacion.ts';
import {
  abrirLasCajas,
  ambitoDeCaja,
  cobrarExacto,
  mesaDe,
  mesaPersistida,
  pedirMas,
  sembrarSalon,
  sentarYPedir,
  type Salon,
} from './pruebas/salon-real.ts';
import { unirMesasComando } from './union-de-mesas.ts';

/**
 * DP-24 · 4.1–4.3 · LA COCINA POR PLATILLO, CON DOS ESTACIONES (Postgres real).
 *
 * «Cocina general» (arrachera, guacamole) y «Cantina» (cerveza). Cada platillo se mueve solo; la
 * comanda y la mesa se DERIVAN de sus platillos; «entregar» sólo mueve lo listo y la misma
 * comanda vuelve a ofrecerlo cuando sale otro; el aviso de «listo» es sólo del mesero de la mesa.
 */

let salon: Salon;
let meseroA = '';
let meseroB = '';
let indice = 0;

const cocina = () => ({ ...ambitoDeCaja(salon), rol: 'cocina' as const });
const comoMesero = (empleoId: string) => ({
  ...ambitoDeCaja(salon),
  rol: 'mesero' as const,
  empleoId,
});

beforeAll(async () => {
  salon = await sembrarSalon({ nombre: 'Platillos por estación', mesas: 24 });
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
  meseroA = await sembrarCompanero(salon.negocio, { nombre: 'Ana', rol: 'mesero' });
  meseroB = await sembrarCompanero(salon.negocio, { nombre: 'Beto', rol: 'mesero' });
}, 120_000);

interface Platillo {
  readonly id: string;
  readonly nombre: string;
  readonly estado: string;
  readonly comandaId: string;
}

/** Una mesa nueva con 2 de la cocina y 2 de la cantina: cuatro platillos en dos comandas. */
async function mesaConCuatro(atiendeId: string | null = meseroA) {
  const posicion = indice;
  indice += 1;
  const { ordenId, mesaId } = await sentarYPedir(salon, posicion, [
    { platillo: 'arrachera', cantidad: '1' },
    { platillo: 'guacamole', cantidad: '1' },
    { platillo: 'cerveza', cantidad: '2' },
  ]);
  if (atiendeId !== null) {
    await obtenerDb()
      .updateTable('mesas')
      .set({ empleado_atiende_id: atiendeId })
      .where('id', '=', mesaId)
      .execute();
  }
  return { ordenId, mesaId };
}

async function platillosDe(ordenId: string): Promise<readonly Platillo[]> {
  const filas = await obtenerDb()
    .selectFrom('comanda_items as i')
    .innerJoin('comandas as c', 'c.id', 'i.comanda_id')
    .select(['i.id', 'i.producto_nombre as nombre', 'i.estado', 'c.id as comandaId'])
    .where('c.orden_id', '=', ordenId)
    .orderBy('i.orden_visual')
    .execute();
  return filas;
}

const de = (platillos: readonly Platillo[], nombre: string): Platillo => {
  const p = platillos.find((x) => x.nombre.startsWith(nombre));
  if (p === undefined) throw new Error(`no hay platillo ${nombre}`);
  return p;
};

const comandaDe = async (id: string) =>
  obtenerDb()
    .selectFrom('comandas')
    .select(['id', 'estado', 'estacion_nombre as estacion', 'lista_en', 'iniciada_en'])
    .where('id', '=', id)
    .executeTakeFirstOrThrow();

const mover = (
  platilloIds: string[],
  desde: 'nuevo' | 'en_preparacion',
  estado: 'en_preparacion' | 'listo',
) =>
  comando(moverPlatillos, {
    entrada: { platilloIds, desde, estado },
    ambito: cocina(),
    idempotencyKey: clave(),
  });

const marcar = (comandaId: string, comandaItemId: string, estado: 'en_preparacion' | 'listo') =>
  comando(transicionarPedido, {
    entrada: { comandaId, comandaItemId, estado },
    ambito: cocina(),
    idempotencyKey: clave(),
  });

const entregar = (ordenId: string, comandaIds?: string[]) =>
  comando(entregarPedidos, {
    entrada: comandaIds === undefined ? { ordenId } : { ordenId, comandaIds },
    ambito: comoMesero(meseroA),
    idempotencyKey: clave(),
  });

describe('4.1 · un platillo a la vez, con dos estaciones', () => {
  it('a · una comanda tiene platillos en las tres columnas a la vez y la mesa no se mueve de más', async () => {
    const { ordenId, mesaId } = await mesaConCuatro();
    const p = await platillosDe(ordenId);
    const arrachera = de(p, 'Arrachera');
    const guacamole = de(p, 'Guacamole');

    exigirOk(await marcar(arrachera.comandaId, arrachera.id, 'en_preparacion'), 'marcar');
    exigirOk(await marcar(guacamole.comandaId, guacamole.id, 'en_preparacion'), 'marcar');
    exigirOk(await marcar(arrachera.comandaId, arrachera.id, 'listo'), 'marcar');

    const despues = await platillosDe(ordenId);
    expect(de(despues, 'Arrachera').estado).toBe('listo');
    expect(de(despues, 'Guacamole').estado).toBe('en_preparacion');
    expect(de(despues, 'Cerveza').estado).toBe('pendiente');
    // La comanda de la cocina se deriva del platillo menos avanzado: sigue en preparación.
    expect((await comandaDe(arrachera.comandaId)).estado).toBe('en_preparacion');
    // La cantina no ha empezado: su comanda sigue nueva, y la mesa se queda en preparación.
    expect((await comandaDe(de(despues, 'Cerveza').comandaId)).estado).toBe('nuevo');
    expect((await mesaPersistida(mesaId)).estado).toBe('en_preparacion');
  });

  it('b · un platillo que sale solo de una comanda con otros pendientes NO regresa la mesa', async () => {
    const { ordenId, mesaId } = await mesaConCuatro();
    const p = await platillosDe(ordenId);
    const guacamole = de(p, 'Guacamole');
    // La cantina arranca TODA su comanda: la mesa pasa a «en preparación».
    const cerveza = de(p, 'Cerveza');
    exigirOk(await mover([cerveza.id], 'nuevo', 'en_preparacion'), 'mover');
    expect((await mesaPersistida(mesaId)).estado).toBe('en_preparacion');
    // Un platillo suelto de la cocina que no cambia a su comanda no mueve la mesa de nuevo.
    exigirOk(await marcar(guacamole.comandaId, guacamole.id, 'en_preparacion'), 'marcar');
    expect((await mesaPersistida(mesaId)).estado).toBe('en_preparacion');
  });

  it('c · terminó primero una estación: sus platillos listos se ven antes de que termine la otra', async () => {
    const { ordenId, mesaId } = await mesaConCuatro();
    const p = await platillosDe(ordenId);
    const cerveza = de(p, 'Cerveza');
    exigirOk(await mover([cerveza.id], 'nuevo', 'listo'), 'mover');
    const despues = await platillosDe(ordenId);
    expect(de(despues, 'Cerveza').estado).toBe('listo');
    expect((await comandaDe(cerveza.comandaId)).estado).toBe('listo');
    // La cocina sigue pendiente: la mesa NO está lista todavía.
    expect((await mesaPersistida(mesaId)).estado).not.toBe('en_espera_entrega');
    const arrachera = de(p, 'Arrachera');
    const guacamole = de(p, 'Guacamole');
    exigirOk(await mover([arrachera.id, guacamole.id], 'nuevo', 'listo'), 'mover');
    expect((await mesaPersistida(mesaId)).estado).toBe('en_espera_entrega');
  });

  it('d · el bloque completo mueve sólo los platillos que siguen en esa columna', async () => {
    const { ordenId } = await mesaConCuatro();
    const p = await platillosDe(ordenId);
    const arrachera = de(p, 'Arrachera');
    const guacamole = de(p, 'Guacamole');
    // Otro cocinero ya dejó listo uno de los dos.
    exigirOk(await marcar(arrachera.comandaId, arrachera.id, 'listo'), 'marcar');

    const r = exigirOk(
      await mover([arrachera.id, guacamole.id], 'nuevo', 'en_preparacion'),
      'mover_platillos',
    );
    expect(r.movidos).toBe(1);
    expect(r.omitidos).toBe(1);
    const despues = await platillosDe(ordenId);
    expect(de(despues, 'Arrachera').estado).toBe('listo');
    expect(de(despues, 'Guacamole').estado).toBe('en_preparacion');
  });

  it('e · dos cocineros tocando el mismo platillo a la vez: ni retrocede ni se duplica', async () => {
    const { ordenId } = await mesaConCuatro();
    const p = await platillosDe(ordenId);
    const arrachera = de(p, 'Arrachera');
    const resultados = await Promise.all([
      mover([arrachera.id], 'nuevo', 'en_preparacion'),
      mover([arrachera.id], 'nuevo', 'en_preparacion'),
      marcar(arrachera.comandaId, arrachera.id, 'en_preparacion'),
    ]);
    for (const r of resultados) expect(r.ok).toBe(true);
    const movidos = resultados
      .map((r) => (r.ok && 'movidos' in r.datos ? r.datos.movidos : null))
      .filter((m): m is number => m !== null);
    expect(movidos.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(1);
    expect(de(await platillosDe(ordenId), 'Arrachera').estado).toBe('en_preparacion');
    // Repetir «listo» sobre uno ya listo no cambia nada (idempotente).
    exigirOk(await marcar(arrachera.comandaId, arrachera.id, 'listo'), 'marcar');
    const otra = await marcar(arrachera.comandaId, arrachera.id, 'listo');
    expect(otra.ok).toBe(true);
    expect(de(await platillosDe(ordenId), 'Arrachera').estado).toBe('listo');
  });

  it('f · un platillo que otro dejó listo no se regresa a «en preparación» por un toque tardío', async () => {
    const { ordenId } = await mesaConCuatro();
    const arrachera = de(await platillosDe(ordenId), 'Arrachera');
    exigirOk(await mover([arrachera.id], 'nuevo', 'listo'), 'mover');
    const tarde = await mover([arrachera.id], 'nuevo', 'en_preparacion');
    expect(tarde.ok && tarde.datos.movidos).toBe(0);
    expect(de(await platillosDe(ordenId), 'Arrachera').estado).toBe('listo');
  });
});

describe('4.1 · el toque tardío sobre un platillo suelto', () => {
  it('p · pedir «en preparación» a un platillo que ya está listo no falla ni lo regresa', async () => {
    const { ordenId } = await mesaConCuatro();
    const arrachera = de(await platillosDe(ordenId), 'Arrachera');
    exigirOk(await marcar(arrachera.comandaId, arrachera.id, 'listo'), 'marcar');
    const tarde = await marcar(arrachera.comandaId, arrachera.id, 'en_preparacion');
    expect(tarde.ok).toBe(true);
    expect(de(await platillosDe(ordenId), 'Arrachera').estado).toBe('listo');
  });
});

describe('4.2 · entregar sólo lo listo, en la misma tarjeta', () => {
  it('g · «entregar» mueve lo listo de la estación; si sale otro platillo, la MISMA comanda lo ofrece', async () => {
    const { ordenId } = await mesaConCuatro();
    const p = await platillosDe(ordenId);
    const arrachera = de(p, 'Arrachera');
    const guacamole = de(p, 'Guacamole');
    exigirOk(await mover([arrachera.id], 'nuevo', 'listo'), 'mover');

    const primera = exigirOk(await entregar(ordenId, [arrachera.comandaId]), 'entregar');
    expect(primera.platillos).toBe(1);
    expect(primera.entregadas).toEqual([arrachera.comandaId]);
    let ahora = await platillosDe(ordenId);
    expect(de(ahora, 'Arrachera').estado).toBe('entregado');
    expect(de(ahora, 'Guacamole').estado).toBe('pendiente');
    expect(de(ahora, 'Cerveza').estado).toBe('pendiente');
    expect((await comandaDe(arrachera.comandaId)).estado).not.toBe('entregado');

    // Sin nada listo, entregar no hace nada (no es un fallo).
    const nada = exigirOk(await entregar(ordenId, [arrachera.comandaId]), 'entregar');
    expect(nada.platillos).toBe(0);

    // Sale otro platillo de la MISMA comanda: vuelve a haber algo que entregar en ella.
    exigirOk(await mover([guacamole.id], 'nuevo', 'listo'), 'mover');
    const segunda = exigirOk(await entregar(ordenId, [arrachera.comandaId]), 'entregar');
    expect(segunda.platillos).toBe(1);
    expect(segunda.entregadas).toEqual([arrachera.comandaId]);
    ahora = await platillosDe(ordenId);
    expect(de(ahora, 'Guacamole').estado).toBe('entregado');
    expect((await comandaDe(arrachera.comandaId)).estado).toBe('entregado');
    // La cantina no se tocó.
    expect(de(ahora, 'Cerveza').estado).toBe('pendiente');
  });

  it('h · sin filtro entrega lo listo de todas las estaciones, y la mesa vuelve a ocupada al final', async () => {
    const { ordenId, mesaId } = await mesaConCuatro();
    const p = await platillosDe(ordenId);
    exigirOk(
      await mover(
        p.map((x) => x.id),
        'nuevo',
        'listo',
      ),
      'mover',
    );
    expect((await mesaPersistida(mesaId)).estado).toBe('en_espera_entrega');
    const r = exigirOk(await entregar(ordenId), 'entregar');
    expect(r.platillos).toBe(3);
    expect(r.estaciones.toSorted()).toEqual(['Cantina', 'Cocina general']);
    expect(r.estadoMesa).toBe('ocupada');
    expect((await mesaPersistida(mesaId)).estado).toBe('ocupada');
  });

  it('i · entregar un pedido que sólo tiene parte lista no mueve la mesa', async () => {
    const { ordenId, mesaId } = await mesaConCuatro();
    const cerveza = de(await platillosDe(ordenId), 'Cerveza');
    exigirOk(await mover([cerveza.id], 'nuevo', 'listo'), 'mover');
    const r = exigirOk(await entregar(ordenId), 'entregar');
    expect(r.estadoMesa).toBeNull();
    expect((await mesaPersistida(mesaId)).estado).not.toBe('ocupada');
  });

  it('j · la cuenta que se cobra con platillos sin terminar: lo listo se da por entregado, lo demás sigue', async () => {
    const { ordenId } = await mesaConCuatro();
    const p = await platillosDe(ordenId);
    const arrachera = de(p, 'Arrachera');
    const guacamole = de(p, 'Guacamole');
    exigirOk(await mover([arrachera.id], 'nuevo', 'listo'), 'mover');
    const orden = await obtenerDb()
      .selectFrom('ordenes')
      .select('total_centavos')
      .where('id', '=', ordenId)
      .executeTakeFirstOrThrow();
    exigirOk(
      await cobrarExacto(ambitoDeCaja(salon), ordenId, Number(orden.total_centavos)),
      'cobrar',
    );
    let ahora = await platillosDe(ordenId);
    expect(de(ahora, 'Arrachera').estado).toBe('entregado');
    expect(de(ahora, 'Guacamole').estado).toBe('pendiente');
    // Lo que termina DESPUÉS de cobrada no espera a ningún mesero.
    exigirOk(await mover([guacamole.id], 'nuevo', 'listo'), 'mover');
    ahora = await platillosDe(ordenId);
    expect(de(ahora, 'Guacamole').estado).toBe('entregado');
  });

  it('j2 · cobrada ANTES de cocinar: un platillo que sale con la comanda a medias se da por entregado', async () => {
    const { ordenId } = await mesaConCuatro();
    const orden = await obtenerDb()
      .selectFrom('ordenes')
      .select('total_centavos')
      .where('id', '=', ordenId)
      .executeTakeFirstOrThrow();
    exigirOk(
      await cobrarExacto(ambitoDeCaja(salon), ordenId, Number(orden.total_centavos)),
      'cobrar',
    );
    const p = await platillosDe(ordenId);
    const arrachera = de(p, 'Arrachera');
    // La comanda sigue «nueva» (falta el guacamole), pero el platillo que salió no espera a nadie.
    exigirOk(await mover([arrachera.id], 'nuevo', 'listo'), 'mover');
    const ahora = await platillosDe(ordenId);
    expect(de(ahora, 'Arrachera').estado).toBe('entregado');
    expect(de(ahora, 'Guacamole').estado).toBe('pendiente');
    expect((await comandaDe(arrachera.comandaId)).estado).toBe('nuevo');
  });
});

describe('4.3 · el aviso de «listo» es del mesero de la mesa', () => {
  it('k · lo ve el que atiende la mesa, agrupado por estación, y nadie más', async () => {
    const { ordenId, mesaId } = await mesaConCuatro(meseroA);
    const cerveza = de(await platillosDe(ordenId), 'Cerveza');
    exigirOk(await mover([cerveza.id], 'nuevo', 'listo'), 'mover');
    const mesa = await mesaPersistida(mesaId);

    const mios = exigirOk(
      await comando(avisosDeListo, {
        entrada: {},
        ambito: comoMesero(meseroA),
        idempotencyKey: clave(),
      }),
      'avisos',
    ).avisos.filter((a) => a.ordenId === ordenId);
    expect(mios).toHaveLength(1);
    expect(mios[0]?.mesaNumero).toBe(mesa.numero);
    expect(mios[0]?.estacionNombre).toBe('Cantina');
    expect(mios[0]?.platillos).toHaveLength(1);
    expect(mios[0]?.platillos[0]?.nombre).toMatch(/^Cerveza/);

    const deBeto = exigirOk(
      await comando(avisosDeListo, {
        entrada: {},
        ambito: comoMesero(meseroB),
        idempotencyKey: clave(),
      }),
      'avisos',
    ).avisos.filter((a) => a.ordenId === ordenId);
    expect(deBeto).toHaveLength(0);
  });

  it('l · el administrador, el gerente y la caja NO pueden pedir los avisos', async () => {
    for (const rol of ['dueno', 'administrador', 'gerente', 'cajero', 'cocina'] as const) {
      const r = await comando(avisosDeListo, {
        entrada: {},
        ambito: { ...ambitoDeCaja(salon), rol },
        idempotencyKey: clave(),
      });
      expect(r.ok, rol).toBe(false);
    }
  });

  it('m · con mesero ASIGNADO, el aviso es del asignado aunque otro la haya atendido', async () => {
    const { ordenId, mesaId } = await mesaConCuatro(meseroA);
    await obtenerDb()
      .updateTable('mesas')
      .set({ empleado_asignado_id: meseroB })
      .where('id', '=', mesaId)
      .execute();
    const cerveza = de(await platillosDe(ordenId), 'Cerveza');
    exigirOk(await mover([cerveza.id], 'nuevo', 'listo'), 'mover');
    const leer = async (id: string) =>
      exigirOk(
        await comando(avisosDeListo, {
          entrada: {},
          ambito: comoMesero(id),
          idempotencyKey: clave(),
        }),
        'avisos',
      ).avisos.filter((a) => a.ordenId === ordenId);
    expect(await leer(meseroB)).toHaveLength(1);
    expect(await leer(meseroA)).toHaveLength(0);
  });

  it('n · lo entregado deja de ser aviso, y un platillo que sale después lo reabre en la misma comanda', async () => {
    const { ordenId } = await mesaConCuatro(meseroA);
    const cerveza = de(await platillosDe(ordenId), 'Cerveza');
    exigirOk(await mover([cerveza.id], 'nuevo', 'listo'), 'mover');
    exigirOk(await entregar(ordenId, [cerveza.comandaId]), 'entregar');
    const leer = async () =>
      exigirOk(
        await comando(avisosDeListo, {
          entrada: {},
          ambito: comoMesero(meseroA),
          idempotencyKey: clave(),
        }),
        'avisos',
      ).avisos.filter((a) => a.ordenId === ordenId);
    expect(await leer()).toHaveLength(0);
    // Otra ronda de bebidas sale después.
    await pedirMas(salon, ordenId, [{ platillo: 'cerveza', cantidad: '1' }]);
    const nuevas = (await platillosDe(ordenId)).filter(
      (x) => x.nombre.startsWith('Cerveza') && x.estado === 'pendiente',
    );
    expect(nuevas.length).toBeGreaterThan(0);
    exigirOk(
      await mover(
        nuevas.map((x) => x.id),
        'nuevo',
        'listo',
      ),
      'mover',
    );
    expect(await leer()).toHaveLength(1);
  });

  it('o · en una unión de mesas el aviso dice la mesa PRINCIPAL', async () => {
    const posicion = indice;
    indice += 2;
    const principal = await sentarYPedir(salon, posicion, [
      { platillo: 'guacamole', cantidad: '1' },
    ]);
    const otra = await sentarYPedir(salon, posicion + 1, [{ platillo: 'cerveza', cantidad: '1' }]);
    await obtenerDb()
      .updateTable('mesas')
      .set({ empleado_atiende_id: meseroA })
      .where('id', 'in', [principal.mesaId, otra.mesaId])
      .execute();
    exigirOk(
      await comando(unirMesasComando, {
        entrada: { mesaPrincipalId: principal.mesaId, mesaIds: [otra.mesaId] },
        ambito: ambitoDeCaja(salon),
        idempotencyKey: clave(),
      }),
      'unir',
    );
    const todos = await platillosDe(principal.ordenId);
    const cerveza = de(todos, 'Cerveza');
    exigirOk(await mover([cerveza.id], 'nuevo', 'listo'), 'mover');
    const mesaPrincipal = await mesaPersistida(principal.mesaId);
    const avisos = exigirOk(
      await comando(avisosDeListo, {
        entrada: {},
        ambito: comoMesero(meseroA),
        idempotencyKey: clave(),
      }),
      'avisos',
    ).avisos.filter((a) => a.ordenId === principal.ordenId);
    expect(avisos).toHaveLength(1);
    expect(avisos[0]?.mesaNumero).toBe(mesaPrincipal.numero);
    expect(mesaDe(salon, posicion)).toBe(principal.mesaId);
  });
});
