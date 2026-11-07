import { conTransaccion } from '@morphiqpos/data';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { comando } from '../../produccion.ts';
import { autorizacionDeDescuento } from '../../pruebas/autorizacion-de-prueba.ts';
import { clave, exigirOk } from '../../pruebas/negocio-real.ts';
import { descontarCuenta } from '../../restaurante/descuento-de-cuenta.ts';
import {
  abrirLasCajas,
  ambitoDeCaja,
  cobrarExacto,
  dividirEn,
  ordenPersistida,
  pedirLaCuenta,
  sembrarSalon,
  sentarYPedir,
  type Salon,
} from '../../restaurante/pruebas/salon-real.ts';
import { descuentosDelCorte } from './descuentos-del-corte.ts';

// Todo descuento pide la clave: se firma con este secreto (`pruebas/autorizacion-de-prueba.ts`).
vi.mock('@morphiqpos/contracts', async (original) => ({
  ...(await original<typeof import('@morphiqpos/contracts')>()),
  validarEntorno: () => ({ SESSION_SECRET: 'secreto_de_integracion_de_las_autorizaciones_2026' }),
}));

/**
 * DP-14 ronda 2 · LOS MENORES DE LOS DESCUENTOS DEL CORTE.
 *
 *   · Una PARTE de una cuenta dividida nace sin mesa: la mesa es la de su madre.
 *   · El folio lleva su serie («T-12»), como en las cancelaciones.
 *   · El total y la cuenta salen de SQL sobre TODOS: la lista puede cortarse, la suma no.
 */

const POR_COMANDOS = 120_000;
let salon: Salon;
let parteCobrada = '';

async function descontar(ordenId: string, montoCentavos: number): Promise<void> {
  exigirOk(
    await comando(descontarCuenta, {
      entrada: {
        ordenId,
        descuentoCentavos: montoCentavos,
        motivo: 'Cortesía de la casa',
        autorizacion: autorizacionDeDescuento({
          organizacionId: salon.negocio.organizacionId,
          supervisor: salon.negocio.empleoId,
          rol: 'dueno',
          solicita: salon.negocio.empleoId,
          ordenId,
          montoCentavos,
        }),
      },
      ambito: ambitoDeCaja(salon, 0),
      idempotencyKey: clave(),
    }),
    'restaurante.descontar_cuenta',
  );
}

async function cobrarTodo(ordenId: string): Promise<void> {
  const total = Number((await ordenPersistida(ordenId)).total_centavos);
  exigirOk(await cobrarExacto(ambitoDeCaja(salon, 0), ordenId, total), 'venta.cobrar');
}

const alcance = () => ({
  sesionId: '00000000-0000-4000-8000-000000000000',
  sucursalId: salon.sucursal.sucursalId,
  abreId: '00000000-0000-4000-8000-000000000000',
  cierraElDia: true,
  desde: new Date(Date.now() - 3_600_000),
  hasta: new Date(Date.now() + 60_000),
});

beforeAll(async () => {
  salon = await sembrarSalon({ nombre: 'Restaurante de los menores', mesas: 3, terminales: 1 });
  await abrirLasCajas(salon);
  // Mesa 1: una cuenta entera con $20 de descuento.
  const entera = await sentarYPedir(salon, 0, [{ platillo: 'arrachera', cantidad: '2' }]);
  await pedirLaCuenta(salon, entera.ordenId);
  await descontar(entera.ordenId, 2_000);
  await cobrarTodo(entera.ordenId);
  // Mesa 2: una cuenta con $30 de descuento, dividida; cobra sólo una parte.
  const dividida = await sentarYPedir(salon, 1, [
    { platillo: 'arrachera', cantidad: '2' },
    { platillo: 'cerveza', cantidad: '2' },
  ]);
  await pedirLaCuenta(salon, dividida.ordenId);
  await descontar(dividida.ordenId, 3_000);
  const division = await dividirEn(salon, dividida.ordenId, [
    [{ platillo: 'arrachera', cantidad: 1 }],
    [
      { platillo: 'arrachera', cantidad: 1 },
      { platillo: 'cerveza', cantidad: 2 },
    ],
  ]);
  const primera = division.hijas[0];
  if (primera === undefined) throw new Error('Debían salir dos partes.');
  parteCobrada = primera.ordenId;
  await cobrarTodo(parteCobrada);
}, POR_COMANDOS);

const leer = (tope?: number) =>
  conTransaccion((tx) => descuentosDelCorte(tx, salon.negocio.organizacionId, alcance(), tope));

describe('los menores de los descuentos del corte', () => {
  it('la parte de una cuenta dividida sale con la mesa de su madre', async () => {
    const parte = (await leer()).descuentos.find((d) => d.ordenId === parteCobrada);
    expect(parte?.mesa).toBe(2);
  });

  it('el folio lleva su serie, como en las cancelaciones', async () => {
    const { descuentos } = await leer();
    expect(descuentos.length).toBeGreaterThan(0);
    for (const d of descuentos) expect(d.folio).toMatch(/^[A-Za-z0-9]+-\d+$/);
  });

  it('con un tope de 1, la lista trae 1 y el total cuenta y suma las 2', async () => {
    const todas = await leer();
    expect(todas.cuantos).toBe(2);
    const corta = await leer(1);
    expect(corta.descuentos).toHaveLength(1);
    expect(corta.cuantos).toBe(2);
    expect(corta.totalCentavos).toBe(todas.totalCentavos);
    const suma = todas.descuentos.reduce((s, d) => s + BigInt(d.montoCentavos), 0n);
    expect(corta.totalCentavos).toBe(suma.toString());
  });
});
