import type { Ambito } from '@morphiqpos/contracts';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { comando } from '../../produccion.ts';
import { autorizacionDeDescuento } from '../../pruebas/autorizacion-de-prueba.ts';
import { clave, exigirOk, sembrarCompanero } from '../../pruebas/negocio-real.ts';
import { descontarCuenta } from '../../restaurante/descuento-de-cuenta.ts';
import {
  abrirLasCajas,
  ambitoDeCaja,
  cobrarExacto,
  ordenPersistida,
  pedirLaCuenta,
  sembrarSalon,
  sentarYPedir,
  type Salon,
} from '../../restaurante/pruebas/salon-real.ts';
import { cerrarCaja } from '../sesion.ts';
import { descuentosDelCorteComando } from './descuentos-del-corte.ts';

// DP-14.2 · Todo descuento pide la clave: se firma con este secreto (`pruebas/autorizacion-de-prueba.ts`).
vi.mock('@morphiqpos/contracts', async (original) => ({
  ...(await original<typeof import('@morphiqpos/contracts')>()),
  validarEntorno: () => ({ SESSION_SECRET: 'secreto_de_integracion_de_las_autorizaciones_2026' }),
}));

/**
 * EL CORTE Y EL CIERRE DEL DÍA DICEN CADA DESCUENTO, con quién lo autorizó y por qué (DP-14.2).
 *
 * Dos cajas: la 1 cobra una cuenta con un descuento que autorizó la gerente; la 2, otra con uno del
 * dueño. El corte de la caja 1 trae sólo el suyo; al cerrar las dos, el Cierre del día (el corte de
 * la última) trae los dos, cada uno una vez, y su total.
 */

const POR_COMANDOS = 120_000;

let salon: Salon;
let gerenteId = '';
let duenoId = '';
let sesiones: string[] = [];

async function cobradaConDescuento(
  mesa: number,
  caja: number,
  quien: { readonly empleoId: string; readonly rol: 'gerente' | 'dueno' },
  montoCentavos: number,
  motivo: string,
): Promise<string> {
  const { ordenId } = await sentarYPedir(salon, mesa, [{ platillo: 'arrachera', cantidad: '2' }]);
  await pedirLaCuenta(salon, ordenId);
  const ambito: Ambito = ambitoDeCaja(salon, caja);
  exigirOk(
    await comando(descontarCuenta, {
      entrada: {
        ordenId,
        descuentoCentavos: montoCentavos,
        motivo,
        autorizacion: autorizacionDeDescuento({
          organizacionId: salon.negocio.organizacionId,
          supervisor: quien.empleoId,
          rol: quien.rol,
          solicita: salon.negocio.empleoId,
          ordenId,
          montoCentavos,
        }),
      },
      ambito,
      idempotencyKey: clave(),
    }),
    'restaurante.descontar_cuenta',
  );
  const total = Number((await ordenPersistida(ordenId)).total_centavos);
  exigirOk(await cobrarExacto(ambito, ordenId, total), 'venta.cobrar');
  return ordenId;
}

const leer = async (sesionCajaId: string) =>
  exigirOk(
    await comando(descuentosDelCorteComando, {
      entrada: { sesionCajaId },
      ambito: ambitoDeCaja(salon),
      idempotencyKey: clave(),
    }),
    'caja.descuentos_del_corte',
  );

beforeAll(async () => {
  salon = await sembrarSalon({ nombre: 'Restaurante de los descuentos', mesas: 4, terminales: 2 });
  gerenteId = await sembrarCompanero(salon.negocio, { nombre: 'La Gerente', rol: 'gerente' });
  duenoId = await sembrarCompanero(salon.negocio, { nombre: 'Don Poncho', rol: 'dueno' });
  sesiones = await abrirLasCajas(salon);
}, POR_COMANDOS);

describe('cada descuento en el corte, con quién y por qué', () => {
  it(
    'el corte de una caja trae sólo los suyos; el Cierre del día, todos, una vez',
    { timeout: POR_COMANDOS },
    async () => {
      const enLaUno = await cobradaConDescuento(
        0,
        0,
        { empleoId: gerenteId, rol: 'gerente' },
        2_000,
        'Cliente frecuente',
      );
      const enLaDos = await cobradaConDescuento(
        1,
        1,
        { empleoId: duenoId, rol: 'dueno' },
        5_000,
        'Cumpleaños del abuelo',
      );
      const [uno, dos] = sesiones;
      if (uno === undefined || dos === undefined) throw new Error('Faltan las cajas.');

      const deLaUno = await leer(uno);
      expect(deLaUno.alcance).toBe('caja');
      expect(deLaUno.totalCentavos).toBe('2000');
      expect(deLaUno.descuentos).toEqual([
        expect.objectContaining({
          ordenId: enLaUno,
          montoCentavos: '2000',
          autorizo: 'La Gerente',
          motivo: 'Cliente frecuente',
          mesa: 1,
        }),
      ]);

      // Se cierra la 1 y luego la 2: el corte de la 2 es el Cierre del día.
      exigirOk(
        await comando(cerrarCaja, {
          entrada: { efectivoContadoCentavos: 50_000 },
          ambito: ambitoDeCaja(salon, 0),
          idempotencyKey: clave(),
        }),
        'caja.cerrar 1',
      );
      exigirOk(
        await comando(cerrarCaja, {
          entrada: { efectivoContadoCentavos: 50_000 },
          ambito: ambitoDeCaja(salon, 1),
          idempotencyKey: clave(),
        }),
        'caja.cerrar 2',
      );
      const delDia = await leer(dos);
      expect(delDia.alcance).toBe('dia');
      expect(delDia.totalCentavos).toBe('7000');
      expect(delDia.descuentos.map((d) => [d.ordenId, d.autorizo, d.motivo])).toEqual([
        [enLaUno, 'La Gerente', 'Cliente frecuente'],
        [enLaDos, 'Don Poncho', 'Cumpleaños del abuelo'],
      ]);
    },
  );
});
