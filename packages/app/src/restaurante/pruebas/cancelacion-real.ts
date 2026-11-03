import 'server-only';

import type { Ambito, Rol } from '@morphiqpos/contracts';
import { obtenerDb } from '@morphiqpos/data';

import {
  cancelacionesDelCorteComando,
  cancelacionesRegistradasComando,
} from '../../caja/corte/lectura-de-cancelaciones.ts';
import { cerrarCaja } from '../../caja/sesion.ts';
import { comando } from '../../produccion.ts';
import {
  abrirCajaReal,
  ambitoDe,
  clave,
  cobrarEnEfectivo,
  exigirOk,
  sembrarCompanero,
  sembrarNegocio,
  sembrarSucursal,
  type NegocioReal,
  type SucursalReal,
} from '../../pruebas/negocio-real.ts';
import { anularLineaComando } from '../anulacion-linea.ts';
import { cancelarOrden } from '../cancelacion.ts';
import { abrirMesa } from '../mesas.ts';
import { enviarPedido } from '../pedido.ts';
import { entregarPedidos, transicionarPedido } from '../preparacion.ts';

/**
 * EL SALÓN QUE CANCELA (DP-12.4), sembrado contra Postgres para las pruebas de cancelación.
 *
 * Rosa es la mesera (la persona del negocio sembrado); Beatriz, la cajera, abre la caja 1, y
 * Carmen, la otra cajera, la 2 cuando una prueba la abre (DP-13.2). Cocina y almacén son otros
 * dos empleos. Catorce mesas, una arrachera y una sopa. Lo siembra
 * `sembrarElSalonQueCancela` en el `beforeAll` de cada archivo; las variables exportadas se
 * leen ya sembradas (los enlaces de un módulo se ven al día).
 */

export let negocio: NegocioReal;
export let sucursal: SucursalReal;
export let arrachera = '';
export let sopa = '';
export let mesas: readonly string[] = [];
export let cajera = '';
export let segundaCajera = '';
export let cocinero = '';
export let almacenista = '';
export let sesionCajaId = '';

export const como = (empleoId: string, rol: Rol, enTerminal = false): Ambito => ({
  ...ambitoDe(negocio, sucursal.sucursalId, enTerminal ? (sucursal.terminales[0] ?? null) : null),
  empleoId,
  rol,
});
export const mesero = () => como(negocio.empleoId, 'mesero');
export const deLaCajera = () => como(cajera, 'cajero', true);
/** Carmen, en la caja 2. */
export const deLaSegundaCajera = (): Ambito => ({
  ...ambitoDe(negocio, sucursal.sucursalId, sucursal.terminales[1] ?? null),
  empleoId: segundaCajera,
  rol: 'cajero',
});

export async function sembrarElSalonQueCancela(): Promise<void> {
  negocio = await sembrarNegocio({
    nombre: 'Restaurante que cancela',
    rol: 'mesero',
    giro: 'restaurante',
    paquete: 'restaurante',
  });
  sucursal = await sembrarSucursal(negocio, {
    terminales: ['Caja 1', 'Caja 2'],
    cajasSimultaneas: 2,
  });
  cajera = await sembrarCompanero(negocio, { nombre: 'Beatriz', rol: 'cajero' });
  segundaCajera = await sembrarCompanero(negocio, { nombre: 'Carmen', rol: 'cajero' });
  cocinero = await sembrarCompanero(negocio, { nombre: 'Cosme', rol: 'cocina' });
  almacenista = await sembrarCompanero(negocio, { nombre: 'Alma', rol: 'almacen' });
  const db = obtenerDb();
  await db
    .insertInto('estaciones_preparacion')
    .values({ organizacion_id: negocio.organizacionId, nombre: 'Cocina general', es_general: true })
    .execute();
  arrachera = (
    await db
      .insertInto('productos')
      .values({
        organizacion_id: negocio.organizacionId,
        nombre: 'Arrachera al carbón',
        precio_venta_centavos: 32_900n,
        costo_unitario_centavos: 16_450n,
        estrategia_consumo: 'ninguno',
        area_preparacion: 'cocina',
      })
      .returning('id')
      .executeTakeFirstOrThrow()
  ).id;
  sopa = (
    await db
      .insertInto('productos')
      .values({
        organizacion_id: negocio.organizacionId,
        nombre: 'Sopa de tortilla',
        precio_venta_centavos: 11_500n,
        costo_unitario_centavos: 5_750n,
        estrategia_consumo: 'ninguno',
        area_preparacion: 'cocina',
      })
      .returning('id')
      .executeTakeFirstOrThrow()
  ).id;
  mesas = (
    await db
      .insertInto('mesas')
      .values(
        [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].map((numero) => ({
          organizacion_id: negocio.organizacionId,
          sucursal_id: sucursal.sucursalId,
          numero,
        })),
      )
      .returning('id')
      .execute()
  ).map((m) => m.id);
  sesionCajaId = await abrirCajaReal(deLaCajera());
}

/** Una cuenta con `cantidad` arracheras en la mesa `numero`, como la deja el mesero. */
export async function cuenta(numero: number, cantidades: readonly string[]) {
  const mesaId = mesas[numero - 1] ?? '';
  const { ordenId } = exigirOk(
    await comando(abrirMesa, {
      entrada: { mesaId, personas: 2 },
      ambito: mesero(),
      idempotencyKey: clave(),
    }),
    'restaurante.abrir_mesa',
  );
  for (const cantidad of cantidades) {
    exigirOk(
      await comando(enviarPedido, {
        entrada: { ordenId, lineas: [{ productoId: arrachera, cantidad }] },
        ambito: mesero(),
        idempotencyKey: clave(),
      }),
      'restaurante.enviar_pedido',
    );
  }
  const lineas = await obtenerDb()
    .selectFrom('orden_lineas')
    .select(['id', 'cantidad'])
    .where('orden_id', '=', ordenId)
    .orderBy('created_at')
    .execute();
  return { ordenId, lineaIds: lineas.map((l) => l.id), mesa: `Mesa ${String(numero)}` };
}

export const comandasDe = (ordenId: string) =>
  obtenerDb().selectFrom('comandas').select('id').where('orden_id', '=', ordenId).execute();

/** La cocina deja listo (y, si se pide, el mesero entrega) lo que la cuenta tiene en cocina. */
export async function dejarListo(ordenId: string, entregar = false): Promise<void> {
  for (const { id } of await comandasDe(ordenId)) {
    exigirOk(
      await comando(transicionarPedido, {
        entrada: { comandaId: id, estado: 'listo' },
        ambito: como(cocinero, 'cocina'),
        idempotencyKey: clave(),
      }),
      'restaurante.transicionar_pedido',
    );
  }
  if (!entregar) return;
  exigirOk(
    await comando(entregarPedidos, {
      entrada: { ordenId },
      ambito: mesero(),
      idempotencyKey: clave(),
    }),
    'restaurante.entregar_pedidos',
  );
}

/** Cocina deja listo UN platillo (el de esa línea); la comanda entera aún no. */
export async function dejarListoUnPlatillo(lineaId: string): Promise<void> {
  const item = await obtenerDb()
    .selectFrom('comanda_items')
    .select(['id', 'comanda_id'])
    .where('orden_linea_id', '=', lineaId)
    .executeTakeFirstOrThrow();
  exigirOk(
    await comando(transicionarPedido, {
      entrada: { comandaId: item.comanda_id, comandaItemId: item.id, estado: 'listo' },
      ambito: como(cocinero, 'cocina'),
      idempotencyKey: clave(),
    }),
    'restaurante.transicionar_pedido',
  );
}

export const cancelar = (ordenId: string, ambito: Ambito, motivo = 'Se fueron sin pagar') =>
  comando(cancelarOrden, { entrada: { ordenId, motivo }, ambito, idempotencyKey: clave() });

export const anular = (ordenId: string, lineaId: string, ambito: Ambito, cantidad?: string) =>
  comando(anularLineaComando, {
    entrada: {
      ordenId,
      lineaId,
      motivo: 'error_mesero',
      ...(cantidad === undefined ? {} : { cantidad }),
    },
    ambito,
    idempotencyKey: clave(),
  });

/**
 * Lo que el día dice de una mesa, en el orden en que pasó: la lectura de la sucursal (la de
 * Registros), que tiene TODAS las cancelaciones. El corte de UNA caja sólo trae las de sus
 * cuentas (DP-13.2): una cuenta que cancela la mesera no es de ninguna caja.
 */
export async function delCorte(mesa: string) {
  const salida = exigirOk(
    await comando(cancelacionesRegistradasComando, {
      entrada: { dias: 1 },
      ambito: como(negocio.empleoId, 'gerente'),
      idempotencyKey: clave(),
    }),
    'caja.cancelaciones_registradas',
  );
  return salida.cancelaciones.filter((c) => c.mesa === mesa).reverse();
}

/** Lo que dice el corte de UNA sesión de caja (el heredado de la Caja lee esto). */
export async function delCorteDe(sesionId: string) {
  return exigirOk(
    await comando(cancelacionesDelCorteComando, {
      entrada: { sesionCajaId: sesionId },
      ambito: deLaCajera(),
      idempotencyKey: clave(),
    }),
    'caja.cancelaciones_del_corte',
  );
}

/** Cobra la cuenta en efectivo, exacto, en la caja del ámbito. */
export async function cobrar(ordenId: string, ambito: Ambito): Promise<void> {
  const { total_centavos } = await obtenerDb()
    .selectFrom('ordenes')
    .select('total_centavos')
    .where('id', '=', ordenId)
    .executeTakeFirstOrThrow();
  exigirOk(await cobrarEnEfectivo(ambito, ordenId, Number(total_centavos)), 'venta.cobrar');
}

export const cerrarLaCaja = (ambito: Ambito) =>
  comando(cerrarCaja, {
    entrada: { efectivoContadoCentavos: 50_000 },
    ambito,
    idempotencyKey: clave(),
  });
