import { obtenerDb } from '@morphiqpos/data';
import { beforeAll, describe, expect, it } from 'vitest';

import {
  abrirCajaReal,
  ambitoDe,
  armarVenta,
  clave,
  cobrarEnEfectivo,
  exigirOk,
  sembrarNegocio,
  sembrarProducto,
  sembrarSucursal,
} from '../pruebas/negocio-real.ts';
import { comando } from '../produccion.ts';
import { cerrarCaja } from './sesion.ts';

/**
 * A6 · EL CIERRE DEL RESTAURANTE NO PIDE «NO RECOGIDO», contra Postgres.
 *
 * La regla de cerrar con pedidos cobrados sin entregar no cambia (la caja no cierra). Lo que cambia
 * es lo que dice: en el restaurante no existe «marcar como no recogido», así que no lo pide. En la
 * cafetería —donde sí existe en la fila de la barra— sigue diciéndolo.
 */

interface Caso {
  readonly ambito: ReturnType<typeof ambitoDe>;
  readonly ordenId: string;
  readonly sucursalId: string;
  readonly esperado: number;
}

async function sembrarCaso(paquete: 'restaurante' | 'cafeteria'): Promise<Caso> {
  const negocio = await sembrarNegocio({
    nombre: `Negocio ${paquete}`,
    rol: 'cajero',
    giro: paquete,
    paquete,
  });
  const sucursal = await sembrarSucursal(negocio, { terminales: ['Caja'] });
  const ambito = ambitoDe(negocio, sucursal.sucursalId, sucursal.terminales[0] ?? null);
  const { productoId } = await sembrarProducto(negocio, sucursal.almacenId, {
    nombre: 'Taco',
    precioCentavos: 6_500n,
    existencia: '20',
  });
  await abrirCajaReal(ambito, 50_000);
  const venta = await armarVenta(ambito, [{ productoId, cantidad: '1' }]);
  exigirOk(await cobrarEnEfectivo(ambito, venta.ordenId, venta.totalCentavos), 'venta.cobrar');
  return {
    ambito,
    ordenId: venta.ordenId,
    sucursalId: sucursal.sucursalId,
    esperado: 50_000 + venta.totalCentavos,
  };
}

async function dejarUnPedidoSinEntregar(caso: Caso): Promise<void> {
  await obtenerDb()
    .insertInto('comandas')
    .values({
      organizacion_id: caso.ambito.organizacionId,
      orden_id: caso.ordenId,
      sucursal_id: caso.sucursalId,
      estado: 'listo',
      cobrado_en: new Date(),
    })
    .execute();
}

const cerrar = (caso: Caso) =>
  comando(cerrarCaja, {
    entrada: { efectivoContadoCentavos: caso.esperado },
    ambito: caso.ambito,
    idempotencyKey: clave(),
  });

let restaurante: Caso;
let cafeteria: Caso;

beforeAll(async () => {
  restaurante = await sembrarCaso('restaurante');
  cafeteria = await sembrarCaso('cafeteria');
  await dejarUnPedidoSinEntregar(restaurante);
  await dejarUnPedidoSinEntregar(cafeteria);
}, 120_000);

describe('el cierre con un pedido cobrado sin entregar', () => {
  it('restaurante: no cierra, y lo dice sin pedir «no recogido»', async () => {
    const fin = await cerrar(restaurante);
    expect(fin.ok).toBe(false);
    if (fin.ok) return;
    expect(fin.error.datos?.['regla']).toBe('TRANSICION_INVALIDA');
    expect(fin.error.mensaje).toContain('Hay 1 pedido(s) cobrado(s) sin entregar');
    expect(fin.error.mensaje).toContain('entrégalos o devuélvelos antes de cerrar');
    expect(fin.error.mensaje.toLowerCase()).not.toContain('recogido');
  });

  it('cafetería: la misma regla, con su tercera salida', async () => {
    const fin = await cerrar(cafeteria);
    expect(fin.ok).toBe(false);
    if (fin.ok) return;
    expect(fin.error.datos?.['regla']).toBe('TRANSICION_INVALIDA');
    expect(fin.error.mensaje).toContain('márcalos como no recogidos');
  });
});
