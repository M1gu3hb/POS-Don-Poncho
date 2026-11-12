import { obtenerDb } from '@morphiqpos/data';
import { beforeAll, describe, expect, it } from 'vitest';

import { comando } from '../produccion.ts';
import { clave, exigirOk } from '../pruebas/negocio-real.ts';
import { ambitoDeCaja, sembrarSalon, type Salon } from '../restaurante/pruebas/salon-real.ts';
import { estadoDeCaja } from './consulta.ts';
import { abrirCaja } from './sesion.ts';

/**
 * DP-18 · `caja.estado` DICE SIEMPRE QUÉ CAJAS ESTÁN ABIERTAS EN OTROS APARATOS (DP-D111).
 *
 * El 11-11 la Caja de la PC decía «No hay caja abierta en este aparato» y callaba la de la tableta:
 * con lugar para otra, `caja.estado` no la mandaba (DP-D74), y con caja propia nunca mandaba las
 * demás. Ahora trae `otrasCajas` (todas, de la más vieja a la más nueva) con o sin caja aquí, y
 * cuántas hay abiertas en la sucursal.
 */

let salon: Salon;
const estado = async (terminal: number) =>
  exigirOk(
    await comando(estadoDeCaja, {
      entrada: {},
      ambito: ambitoDeCaja(salon, terminal),
      idempotencyKey: clave(),
    }),
    'caja.estado',
  );
const abrir = async (terminal: number) =>
  exigirOk(
    await comando(abrirCaja, {
      entrada: { fondoInicialCentavos: 50_000 },
      ambito: ambitoDeCaja(salon, terminal),
      idempotencyKey: clave(),
    }),
    'caja.abrir',
  );

beforeAll(async () => {
  salon = await sembrarSalon({ nombre: 'Otras cajas', mesas: 1, terminales: 3 });
  await obtenerDb()
    .updateTable('sucursales')
    .set({ cajas_simultaneas: 2 })
    .where('organizacion_id', '=', salon.negocio.organizacionId)
    .execute();
});

describe('DP-18 · las cajas de los otros aparatos en `caja.estado`', () => {
  it('sin caja aquí y con lugar para otra: la de la tableta viene, con quién y desde cuándo', async () => {
    await abrir(0);
    const pc = await estado(1);
    expect(pc.abierta).toBe(false);
    expect(pc.puedoAbrir).toBe(true);
    expect(pc.cupoDeCajas).toBe(2);
    expect(pc.abiertasEnLaSucursal).toBe(1);
    expect(pc.otrasCajas).toHaveLength(1);
    expect(pc.otrasCajas?.[0]).toMatchObject({ puedoTraerla: true });
    expect(pc.otrasCajas?.[0]?.abiertaEn).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    // La de antes, para una pantalla vieja abierta.
    expect(pc.enOtraTerminal?.sesionCajaId).toBe(pc.otrasCajas?.[0]?.sesionCajaId);
  });

  it('con caja aquí, las de los demás también vienen (y la propia no)', async () => {
    const tableta = await estado(0);
    expect(tableta.abierta).toBe(true);
    expect(tableta.otrasCajas).toEqual([]);
    await abrir(1);
    const otra = await estado(0);
    expect(otra.otrasCajas).toHaveLength(1);
    expect(otra.otrasCajas?.[0]?.sesionCajaId).not.toBe(otra.sesionCajaId);
    expect(otra.abiertasEnLaSucursal).toBe(2);
  });

  it('el tercer aparato, sin lugar: ve las dos, de la más vieja a la más nueva', async () => {
    const tercero = await estado(2);
    expect(tercero.puedoAbrir).toBe(false);
    expect(tercero.otrasCajas).toHaveLength(2);
    const [primera, segunda] = tercero.otrasCajas ?? [];
    expect(Date.parse(primera?.abiertaEn ?? '')).toBeLessThanOrEqual(
      Date.parse(segunda?.abiertaEn ?? ''),
    );
  });
});
