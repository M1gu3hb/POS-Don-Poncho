import { beforeAll, describe, expect, it } from 'vitest';

import { comando } from '../produccion.ts';
import { clave, exigirOk } from '../pruebas/negocio-real.ts';
import { anularLineaComando } from '../restaurante/anulacion-linea.ts';
import {
  abrirLasCajas,
  ambitoDeCaja,
  cobrarExacto,
  dividirEn,
  lineasDe,
  ordenPersistida,
  pedirLaCuenta,
  sembrarSalon,
  sentarYPedir,
  type Salon,
} from '../restaurante/pruebas/salon-real.ts';
import { consultar } from './consultar.ts';

/**
 * LO QUE EL MESERO QUITÓ NO SE VE COMO COBRADO, contra Postgres (DP-14.1, punto 1).
 *
 * Anular una línea no la borra: la deja con `anulada_en`, y una anulación parcial deja una fila
 * hermana con la porción quitada. El puente servía esas filas en `DetalleVenta`, y la Caja las
 * enseñaba en el cobro, las ofrecía al dividir y las imprimía en el ticket, mientras el total ya
 * no las contaba: un papel cuyos renglones no suman su total.
 *
 * Aquí se lee el puente como lo lee la Caja, después de quitar UN guacamole entero y UNA de dos
 * arracheras: `DetalleVenta` sólo trae lo que se sigue cobrando y suma el total de la cuenta; lo
 * quitado sale en `RenglonQuitado`, con su hora y su motivo y sin ningún importe. Igual después de
 * cobrar, y en cada parte de una cuenta dividida.
 */

let salon: Salon;

/** Siembra, anula, pide la cuenta y cobra por los comandos de producción: bajo carga, 30 s no alcanzan. */
const POR_COMANDOS = 120_000;

const gerente = () => ({ ...ambitoDeCaja(salon), rol: 'gerente' as const });

interface Renglon {
  readonly id: string;
  readonly producto_nombre: string;
  readonly cantidad: number;
  readonly total: number;
}

async function renglones(ventaId: string): Promise<readonly Renglon[]> {
  const filas = await consultar(gerente(), {
    entidad: 'DetalleVenta',
    operacion: 'filter',
    filtro: { venta_id: ventaId },
  });
  return filas as unknown as readonly Renglon[];
}

function quitados(ventaId: string): Promise<readonly Record<string, unknown>[]> {
  return consultar(gerente(), {
    entidad: 'RenglonQuitado',
    operacion: 'filter',
    filtro: { venta_id: ventaId },
  });
}

/** La suma de los renglones, en centavos: el puente los sirve en pesos. */
function centavos(filas: readonly Renglon[]): number {
  return filas.reduce((suma, fila) => suma + Math.round(fila.total * 100), 0);
}

async function quitar(ordenId: string, lineaId: string, cantidad?: string): Promise<void> {
  exigirOk(
    await comando(anularLineaComando, {
      entrada: {
        ordenId,
        lineaId,
        motivo: 'cliente_cambio',
        ...(cantidad === undefined ? {} : { cantidad }),
      },
      ambito: gerente(),
      idempotencyKey: clave(),
    }),
    'restaurante.anular_linea',
  );
}

/** Una cuenta con dos arracheras, un guacamole y una cerveza; se quita el guacamole y una arrachera. */
async function cuentaConQuitados(indiceDeMesa: number): Promise<string> {
  const { ordenId } = await sentarYPedir(salon, indiceDeMesa, [
    { platillo: 'arrachera', cantidad: '2' },
    { platillo: 'guacamole', cantidad: '1' },
    { platillo: 'cerveza', cantidad: '1' },
  ]);
  const lineas = await lineasDe(ordenId);
  const guacamole = lineas.get('Guacamole con totopos')?.[0];
  const arrachera = lineas.get('Arrachera al carbón')?.[0];
  if (guacamole === undefined || arrachera === undefined) throw new Error('Faltan líneas.');
  await quitar(ordenId, guacamole);
  await quitar(ordenId, arrachera, '1');
  return ordenId;
}

beforeAll(async () => {
  salon = await sembrarSalon({ nombre: 'Restaurante de lo quitado', mesas: 3 });
  await abrirLasCajas(salon);
}, POR_COMANDOS);

describe('DetalleVenta sólo sirve lo que se sigue cobrando', () => {
  it(
    'quitar un platillo y parte de otro: los renglones suman el total de la cuenta',
    { timeout: POR_COMANDOS },
    async () => {
      const ordenId = await cuentaConQuitados(0);
      const filas = await renglones(ordenId);
      expect(filas.map((f) => [f.producto_nombre, f.cantidad]).sort()).toEqual([
        ['Arrachera al carbón', 1],
        ['Cerveza clara', 1],
      ]);
      const orden = await ordenPersistida(ordenId);
      expect(centavos(filas)).toBe(Number(orden.total_centavos));

      // Pedir la cuenta y cobrarla en la caja no los resucita: el ticket se arma con esto.
      await pedirLaCuenta(salon, ordenId);
      exigirOk(
        await cobrarExacto(ambitoDeCaja(salon), ordenId, Number(orden.total_centavos)),
        'venta.cobrar',
      );
      const despues = await renglones(ordenId);
      expect(despues.map((f) => f.id).sort()).toEqual(filas.map((f) => f.id).sort());
      expect(centavos(despues)).toBe(Number((await ordenPersistida(ordenId)).total_centavos));
    },
  );

  it(
    'lo quitado sale aparte, con su hora y su motivo, y sin ningún importe',
    { timeout: POR_COMANDOS },
    async () => {
      const ordenId = await cuentaConQuitados(1);
      const filas = await quitados(ordenId);
      expect(filas.map((f) => [f['producto_nombre'], Number(f['cantidad'])]).sort()).toEqual([
        ['Arrachera al carbón', 1],
        ['Guacamole con totopos', 1],
      ]);
      for (const fila of filas) {
        expect(typeof fila['anulada_en']).toBe('string');
        expect(fila['motivo_anulacion']).toBe('cliente_cambio');
        for (const importe of ['total', 'subtotal', 'descuento', 'precio_unitario_snapshot']) {
          expect(fila, `«${importe}» no tiene que viajar con lo quitado`).not.toHaveProperty(
            importe,
          );
        }
      }
      // Y nada de lo que se sigue cobrando aparece entre lo quitado.
      const vivos = new Set((await renglones(ordenId)).map((f) => f.id));
      expect(filas.some((f) => vivos.has(String(f['id'])))).toBe(false);
    },
  );

  it(
    'al dividir, cada parte trae sólo lo suyo y suma lo que cobra',
    { timeout: POR_COMANDOS },
    async () => {
      const ordenId = await cuentaConQuitados(2);
      await pedirLaCuenta(salon, ordenId);
      const division = await dividirEn(salon, ordenId, [
        [{ platillo: 'arrachera', cantidad: 1 }],
        [{ platillo: 'cerveza', cantidad: 1 }],
      ]);
      expect(division.hijas).toHaveLength(2);
      for (const hija of division.hijas) {
        const filas = await renglones(hija.ordenId);
        expect(filas).toHaveLength(1);
        expect(centavos(filas)).toBe(Number(hija.totalCentavos));
        expect(await quitados(hija.ordenId)).toEqual([]);
      }
    },
  );
});
