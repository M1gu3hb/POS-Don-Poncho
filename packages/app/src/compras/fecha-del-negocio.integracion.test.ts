import type { Ambito } from '@morphiqpos/contracts';
import { obtenerDb } from '@morphiqpos/data';
import { sql } from 'kysely';
import { beforeAll, describe, expect, it } from 'vitest';

import { comandoConReloj } from '../produccion.ts';
import { clave, exigirOk, sembrarCompanero } from '../pruebas/negocio-real.ts';
import { ambitoDeCaja, sembrarSalon, type Salon } from '../restaurante/pruebas/salon-real.ts';
import { registrarCompra, registrarGasto } from './index.ts';

/**
 * DP-22 · hallazgo 1 · UN GASTO O UNA COMPRA SIN FECHA ES DE HOY, EL DÍA DEL NEGOCIO.
 *
 * Sin fecha, la fila tomaba el valor por omisión de la columna (`current_date`), que es el día de
 * la base: UTC. Desde las 18:00 de México eso es mañana, así que el gasto de las 18:30 salía en el
 * tablero y en Registros del día siguiente. El reloj se fija a una tarde lejana (18:30 del 9 de
 * marzo de 2025 en México: en UTC ya es 10) para que la prueba diga lo mismo a cualquier hora.
 */

const POR_COMANDOS = 120_000;
/** 9-mar-2025, 18:30 en México = 10-mar-2025, 00:30 UTC. */
const A_LAS_18_30 = new Date('2025-03-10T00:30:00.000Z');
const HOY_DEL_NEGOCIO = '2025-03-09';

const comando = comandoConReloj(() => A_LAS_18_30);

let salon: Salon;
let dueno: Ambito;

beforeAll(async () => {
  salon = await sembrarSalon({ nombre: 'Fonda de las Seis y Media', mesas: 1, terminales: 1 });
  const duenoId = await sembrarCompanero(salon.negocio, { nombre: 'Doña Fecha', rol: 'dueno' });
  dueno = { ...ambitoDeCaja(salon, 0), rol: 'dueno', empleoId: duenoId };
}, POR_COMANDOS);

const diaDe = async (tabla: 'gastos' | 'compras', id: string): Promise<string | undefined> => {
  const { rows } = await sql<{ readonly dia: string }>`
    select to_char(fecha, 'YYYY-MM-DD') as dia from ${sql.table(tabla)} where id = ${id}
  `.execute(obtenerDb());
  return rows[0]?.dia;
};

describe('la fecha de un gasto o de una compra sin fecha', () => {
  it(
    'un gasto con tarjeta a las 18:30 queda fechado hoy, no mañana',
    { timeout: POR_COMANDOS },
    async () => {
      const gasto = exigirOk(
        await comando(registrarGasto, {
          entrada: {
            categoria: 'servicios',
            descripcion: 'Gas de la tarde',
            monto: '350.00',
            metodoPago: 'tarjeta',
          },
          ambito: dueno,
          idempotencyKey: clave(),
        }),
        'gastos.registrar',
      );
      expect(await diaDe('gastos', gasto.gastoId)).toBe(HOY_DEL_NEGOCIO);
    },
  );

  it(
    'una compra por transferencia a las 18:30 queda fechada hoy, no mañana',
    { timeout: POR_COMANDOS },
    async () => {
      const compra = exigirOk(
        await comando(registrarCompra, {
          entrada: {
            proveedorNombre: 'Don Beto',
            metodoPago: 'transferencia',
            lineas: [
              {
                nuevo: { nombre: 'Carbón', unidadBase: 'g' },
                cantidadCapturada: '10',
                unidadCapturada: 'kg',
                equivalencia: '1000',
                costoTotal: '400.00',
              },
            ],
          },
          ambito: dueno,
          idempotencyKey: clave(),
        }),
        'compras.registrar',
      );
      expect(await diaDe('compras', compra.compraId)).toBe(HOY_DEL_NEGOCIO);
    },
  );

  it('la fecha que sí se captura se respeta tal cual', { timeout: POR_COMANDOS }, async () => {
    const gasto = exigirOk(
      await comando(registrarGasto, {
        entrada: {
          fecha: '2025-03-01',
          categoria: 'servicios',
          descripcion: 'Luz del mes',
          monto: '900.00',
          metodoPago: 'transferencia',
        },
        ambito: dueno,
        idempotencyKey: clave(),
      }),
      'gastos.registrar',
    );
    expect(await diaDe('gastos', gasto.gastoId)).toBe('2025-03-01');
  });
});
