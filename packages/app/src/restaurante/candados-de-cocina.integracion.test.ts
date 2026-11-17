import type { Resultado } from '@morphiqpos/contracts';
import { obtenerDb } from '@morphiqpos/data';
import { beforeAll, describe, expect, it } from 'vitest';

import { reintentosPorConcurrencia } from '../comando.ts';
import { comando } from '../produccion.ts';
import { clave } from '../pruebas/negocio-real.ts';
import { anularLineaComando } from './anulacion-linea.ts';
import { cancelarOrden } from './cancelacion.ts';
import { entregarPedidos, transicionarPedido } from './preparacion.ts';
import {
  abrirLasCajas,
  ambitoDeCaja,
  pedirMas,
  sembrarSalon,
  sentarYPedir,
  type Salon,
} from './pruebas/salon-real.ts';

/**
 * H2 (DP-22) · LOS CANDADOS DE LA COCINA, SIEMPRE EN EL MISMO ORDEN (Postgres real).
 *
 * A12 de la semana simulada fue un interbloqueo: «Preparar» tomaba comanda → platos → líneas y
 * anular un platillo tomaba cuenta → líneas → platos → comanda. Se parchó con un reintento. Aquí se
 * prueba la raíz: con las dos operaciones CRUZADAS en paralelo, 200 vueltas, ningún comando pierde
 * por interbloqueo (el contador de reintentos de `comando.ts` no se mueve), ninguno termina en
 * error interno y la cocina queda coherente en cada vuelta.
 *
 * Sin `sleep`: la concurrencia es `Promise.all` de dos comandos reales contra la misma cuenta.
 */

const BLOQUES = 10;
const VUELTAS_POR_BLOQUE = 20; // 10 × 20 = 200
const CUENTAS_A_CANCELAR = 20;
const POR_BLOQUE = 300_000;

let salon: Salon;

beforeAll(async () => {
  salon = await sembrarSalon({
    nombre: 'Fonda de los candados',
    mesas: BLOQUES + CUENTAS_A_CANCELAR,
    terminales: 2,
  });
  await abrirLasCajas(salon);
}, 120_000);

const db = () => obtenerDb();
const ambito = () => ambitoDeCaja(salon);

interface Plato {
  readonly itemId: string;
  readonly lineaId: string;
}
interface Pedido {
  readonly comandaId: string;
  readonly platos: readonly [Plato, Plato];
}

/** La última comanda de la cuenta: dos platillos, cada uno con su renglón y su línea de venta. */
async function ultimaComanda(ordenId: string): Promise<Pedido> {
  const comanda = await db()
    .selectFrom('comandas')
    .select('id')
    .where('orden_id', '=', ordenId)
    .orderBy('created_at', 'desc')
    .orderBy('id', 'desc')
    .executeTakeFirstOrThrow();
  const items = await db()
    .selectFrom('comanda_items')
    .select(['id', 'orden_linea_id'])
    .where('comanda_id', '=', comanda.id)
    .orderBy('id')
    .execute();
  const [a, b] = items;
  if (a?.orden_linea_id == null || b?.orden_linea_id == null || items.length !== 2) {
    throw new Error('La comanda de la prueba debía traer dos platos con su línea de venta.');
  }
  return {
    comandaId: comanda.id,
    platos: [
      { itemId: a.id, lineaId: a.orden_linea_id },
      { itemId: b.id, lineaId: b.orden_linea_id },
    ],
  };
}

const pasar = (comandaId: string, estado: 'en_preparacion' | 'listo', comandaItemId?: string) =>
  comando(transicionarPedido, {
    entrada: { comandaId, estado, ...(comandaItemId === undefined ? {} : { comandaItemId }) },
    ambito: ambito(),
    idempotencyKey: clave(),
  });

const quitar = (ordenId: string, lineaId: string) =>
  comando(anularLineaComando, {
    entrada: { ordenId, lineaId, motivo: 'cliente_cambio' },
    ambito: ambito(),
    idempotencyKey: clave(),
  });

const entregar = (ordenId: string) =>
  comando(entregarPedidos, {
    entrada: { ordenId },
    ambito: ambito(),
    idempotencyKey: clave(),
  });

const cancelar = (ordenId: string) =>
  comando(cancelarOrden, {
    entrada: { ordenId, motivo: 'El cliente se fue sin pedir nada más' },
    ambito: ambito(),
    idempotencyKey: clave(),
  });

/** Las cuatro formas de cruzarse con quitar un platillo, más la entrega. */
const CRUCES = [
  'preparar la comanda ‖ quitar el platillo 1',
  'listo el plato 1 ‖ quitar el platillo 2 (otra línea de la misma comanda)',
  'listo la comanda ‖ quitar el platillo 1',
  'listo el plato 2 ‖ quitar ese mismo platillo 2',
  'entregar lo listo ‖ quitar el platillo 1',
] as const;

type Salida = Resultado<unknown>;

async function lanzar(
  ordenId: string,
  pedido: Pedido,
  cruce: number,
): Promise<readonly [Salida, Salida]> {
  const [uno, dos] = pedido.platos;
  switch (cruce) {
    case 0:
      return Promise.all([pasar(pedido.comandaId, 'en_preparacion'), quitar(ordenId, uno.lineaId)]);
    case 1:
      return Promise.all([
        pasar(pedido.comandaId, 'listo', uno.itemId),
        quitar(ordenId, dos.lineaId),
      ]);
    case 2:
      return Promise.all([pasar(pedido.comandaId, 'listo'), quitar(ordenId, uno.lineaId)]);
    case 3:
      return Promise.all([
        pasar(pedido.comandaId, 'listo', dos.itemId),
        quitar(ordenId, dos.lineaId),
      ]);
    default: {
      // Primero la cocina deja todo listo (sin cruce); luego se cruzan la entrega y la anulación.
      const listo = await pasar(pedido.comandaId, 'listo');
      if (!listo.ok) throw new Error('No se pudo dejar listo el pedido antes del cruce.');
      return Promise.all([entregar(ordenId), quitar(ordenId, uno.lineaId)]);
    }
  }
}

const RANGO: Readonly<Record<string, number>> = {
  pendiente: 0,
  en_preparacion: 1,
  listo: 2,
  entregado: 3,
};
const ESTADO_DE_LINEA = ['pendiente', 'en_preparacion', 'listo', 'entregado'] as const;

/** Lo que tiene que cumplirse en la cocina de la cuenta pase lo que pase en el cruce. */
async function incoherencias(ordenId: string, etiqueta: string): Promise<string[]> {
  const problemas: string[] = [];
  const comandas = await db()
    .selectFrom('comandas')
    .select(['id', 'estado'])
    .where('orden_id', '=', ordenId)
    .execute();
  const items = await db()
    .selectFrom('comanda_items')
    .select(['id', 'comanda_id', 'orden_linea_id', 'estado'])
    .where(
      'comanda_id',
      'in',
      comandas.map((c) => c.id),
    )
    .execute();
  const lineas = await db()
    .selectFrom('orden_lineas')
    .select(['id', 'anulada_en', 'estado_preparacion'])
    .where('orden_id', '=', ordenId)
    .execute();

  for (const c of comandas) {
    const vivos = items.filter((i) => i.comanda_id === c.id && i.estado !== 'cancelado');
    if (vivos.length === 0 && c.estado !== 'cancelado') {
      problemas.push(`${etiqueta}: la comanda ${c.id} quedó «${c.estado}» sin ningún plato vivo`);
    }
    if (vivos.length > 0 && c.estado === 'cancelado') {
      problemas.push(`${etiqueta}: la comanda ${c.id} se canceló con platos vivos`);
    }
  }
  for (const l of lineas) {
    const susItems = items.filter((i) => i.orden_linea_id === l.id);
    if (l.anulada_en !== null) {
      const colgados = susItems.filter((i) =>
        ['pendiente', 'en_preparacion', 'listo'].includes(i.estado),
      );
      if (colgados.length > 0) {
        problemas.push(
          `${etiqueta}: la línea anulada ${l.id} dejó platos «${colgados[0]?.estado ?? ''}»`,
        );
      }
      continue;
    }
    const vivos = susItems.filter((i) => i.estado !== 'cancelado');
    if (vivos.length === 0) continue;
    const menor = Math.min(...vivos.map((i) => RANGO[i.estado] ?? 0));
    if (l.estado_preparacion !== ESTADO_DE_LINEA[menor]) {
      problemas.push(
        `${etiqueta}: la línea ${l.id} dice «${l.estado_preparacion}» y sus platos «${ESTADO_DE_LINEA[menor] ?? ''}»`,
      );
    }
  }
  return problemas;
}

/** Un rechazo es válido sólo si es una regla de negocio de la cocina, jamás un error interno. */
function falloInesperado(salida: Salida): string | null {
  if (salida.ok) return null;
  const { codigo, mensaje } = salida.error;
  return codigo === 'REGLA_DE_NEGOCIO' ? null : `${codigo}: ${mensaje}`;
}

describe('H2 · Preparar/Listo/Entregado contra quitar un platillo, 200 vueltas cruzadas', () => {
  it.each(Array.from({ length: BLOQUES }, (_, i) => i))(
    'bloque %i: 20 vueltas, cero interbloqueos, cero errores internos, cocina coherente',
    async (bloque) => {
      const { ordenId } = await sentarYPedir(salon, bloque, [
        { platillo: 'cerveza', cantidad: '1' },
      ]);
      const problemas: string[] = [];
      const reintentosAntes = reintentosPorConcurrencia();

      for (let vuelta = 0; vuelta < VUELTAS_POR_BLOQUE; vuelta += 1) {
        const cruce = (bloque + vuelta) % CRUCES.length;
        const etiqueta = `bloque ${String(bloque)} vuelta ${String(vuelta)} (${CRUCES[cruce] ?? ''})`;
        await pedirMas(salon, ordenId, [
          { platillo: 'arrachera', cantidad: '1' },
          { platillo: 'guacamole', cantidad: '1' },
        ]);
        const pedido = await ultimaComanda(ordenId);
        const [cocina, anulacion] = await lanzar(ordenId, pedido, cruce);

        const roto = falloInesperado(cocina);
        if (roto !== null) problemas.push(`${etiqueta}: la cocina falló con ${roto}`);
        if (!anulacion.ok) {
          problemas.push(
            `${etiqueta}: quitar el platillo falló con ${anulacion.error.codigo}: ${anulacion.error.mensaje}`,
          );
        }
      }
      problemas.push(...(await incoherencias(ordenId, `bloque ${String(bloque)}`)));

      expect(problemas).toEqual([]);
      // La red de seguridad (el reintento) NO debe haber hecho falta: el cruce ya no existe.
      expect(reintentosPorConcurrencia() - reintentosAntes).toBe(0);
    },
    POR_BLOQUE,
  );
});

describe('H2 · Listo contra cancelar la cuenta entera, 20 vueltas, una mesa cada una', () => {
  it(
    'sin interbloqueos ni errores internos; la cuenta queda cancelada y sin platos vivos',
    async () => {
      const problemas: string[] = [];
      const reintentosAntes = reintentosPorConcurrencia();

      for (let i = 0; i < CUENTAS_A_CANCELAR; i += 1) {
        const { ordenId } = await sentarYPedir(salon, BLOQUES + i, [
          { platillo: 'arrachera', cantidad: '1' },
          { platillo: 'guacamole', cantidad: '1' },
        ]);
        const pedido = await ultimaComanda(ordenId);
        const etiqueta = `cuenta ${String(i)}`;
        const [cocina, cancelacion] = await Promise.all([
          pasar(pedido.comandaId, i % 2 === 0 ? 'listo' : 'en_preparacion'),
          cancelar(ordenId),
        ]);
        const roto = falloInesperado(cocina);
        if (roto !== null) problemas.push(`${etiqueta}: la cocina falló con ${roto}`);
        if (!cancelacion.ok) {
          problemas.push(`${etiqueta}: cancelar falló con ${cancelacion.error.codigo}`);
        }
        const orden = await db()
          .selectFrom('ordenes')
          .select('estado')
          .where('id', '=', ordenId)
          .executeTakeFirstOrThrow();
        if (orden.estado !== 'cancelada') problemas.push(`${etiqueta}: quedó «${orden.estado}»`);
        problemas.push(...(await incoherencias(ordenId, etiqueta)));
      }

      expect(problemas).toEqual([]);
      expect(reintentosPorConcurrencia() - reintentosAntes).toBe(0);
    },
    POR_BLOQUE,
  );
});
