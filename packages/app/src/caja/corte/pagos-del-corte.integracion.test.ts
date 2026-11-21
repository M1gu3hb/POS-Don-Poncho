import { randomUUID } from 'node:crypto';

import { conTransaccion } from '@morphiqpos/data';
import { beforeAll, describe, expect, it } from 'vitest';

import { comando } from '../../produccion.ts';
import {
  abrirCajaReal,
  ambitoDe,
  clave,
  exigirOk,
  sembrarCompanero,
  sembrarNegocio,
  sembrarProducto,
  sembrarSucursal,
  type NegocioReal,
} from '../../pruebas/negocio-real.ts';
import { solicitarCuenta } from '../../restaurante/cuenta.ts';
import { abrirMesa } from '../../restaurante/mesas.ts';
import { enviarPedido } from '../../restaurante/pedido.ts';
import { cobrarOrden } from '../../venta/cobrar.ts';
import { detalleDeVentas } from './consultas.ts';

/**
 * DP-25 · EL CORTE TRAE CADA PAGO DE CADA VENTA, contra Postgres.
 *
 * Una venta de $564.00 con 10 % de propina, cobrada con dos tarjetas y el resto en efectivo
 * (recibido $500.00): la hoja del corte (`detalleDeVentas`) trae los tres pagos por separado, en el
 * orden del cobro, cada uno con su monto, su propina y —el efectivo— lo recibido y el cambio. La
 * suma de los pagos es el total de la venta más la propina.
 */

const LARGO = 300_000;
const PLATO = 56_400;

let negocio: NegocioReal;
let ambito: ReturnType<typeof ambitoDe>;
let sucursalId: string;
let plato: string;
let mesero: string;
let cajera: string;

beforeAll(async () => {
  negocio = await sembrarNegocio({
    nombre: 'Fonda que cobra con varias tarjetas',
    rol: 'dueno',
    giro: 'restaurante',
    paquete: 'restaurante',
  });
  const sucursal = await sembrarSucursal(negocio, { terminales: ['Caja'] });
  sucursalId = sucursal.sucursalId;
  ambito = ambitoDe(negocio, sucursalId, sucursal.terminales[0] ?? null);
  ({ productoId: plato } = await sembrarProducto(negocio, sucursal.almacenId, {
    nombre: 'Barbacoa para la familia',
    precioCentavos: BigInt(PLATO),
    existencia: '100000',
  }));
  await conTransaccion((tx) =>
    tx
      .insertInto('estaciones_preparacion')
      .values({ organizacion_id: negocio.organizacionId, nombre: 'Cocina', es_general: true })
      .execute(),
  );
  mesero = await sembrarCompanero(negocio, { nombre: 'Lupita', rol: 'mesero' });
  cajera = await sembrarCompanero(negocio, { nombre: 'Rosa', rol: 'cajero' });
}, LARGO);

describe('el corte trae cada pago, por separado', () => {
  it(
    'dos tarjetas y el efectivo: tres pagos en el orden del cobro, con lo recibido y el cambio',
    { timeout: LARGO },
    async () => {
      const sesionCajaId = await abrirCajaReal(ambito, 50_000);
      const mesaId = randomUUID();
      await conTransaccion((tx) =>
        tx
          .insertInto('mesas')
          .values({
            id: mesaId,
            organizacion_id: negocio.organizacionId,
            sucursal_id: sucursalId,
            numero: 31,
            nombre: 'Mesa 31',
          })
          .execute(),
      );
      const delMesero = { ...ambito, empleoId: mesero, rol: 'mesero' as const };
      const { ordenId } = exigirOk(
        await comando(abrirMesa, {
          entrada: { mesaId, personas: 4 },
          ambito: delMesero,
          idempotencyKey: clave(),
        }),
        'restaurante.abrir_mesa',
      );
      exigirOk(
        await comando(enviarPedido, {
          entrada: { ordenId, lineas: [{ productoId: plato, cantidad: '1' }] },
          ambito: delMesero,
          idempotencyKey: clave(),
        }),
        'restaurante.enviar_pedido',
      );
      exigirOk(
        await comando(solicitarCuenta, {
          entrada: { ordenId },
          ambito: delMesero,
          idempotencyKey: clave(),
        }),
        'restaurante.solicitar_cuenta',
      );
      // $564.00 + $56.40 de propina = $620.40: dos tarjetas de $200 y $200, y $220.40 en efectivo
      // (la propina sale del efectivo), recibidos $500.00.
      exigirOk(
        await comando(cobrarOrden, {
          entrada: {
            ordenId,
            pagos: [
              { metodo: 'tarjeta', montoCentavos: 20_000 },
              { metodo: 'tarjeta', montoCentavos: 20_000 },
              {
                metodo: 'efectivo',
                montoCentavos: 16_400,
                propinaCentavos: 5_640,
                recibidoCentavos: 50_000,
              },
            ],
            totalEsperadoCentavos: PLATO,
            propinaTipo: 'porcentaje',
            propinaPuntosBase: 1_000,
            propinaOrigen: 'caja',
          },
          ambito: { ...ambito, empleoId: cajera, rol: 'cajero' },
          idempotencyKey: clave(),
        }),
        'venta.cobrar',
      );

      const ventas = await conTransaccion((tx) =>
        detalleDeVentas(tx, negocio.organizacionId, sesionCajaId),
      );
      expect(ventas).toHaveLength(1);
      const pagos = ventas[0]?.pagos ?? [];
      expect(pagos.map((p) => p.metodo)).toEqual(['tarjeta', 'tarjeta', 'efectivo']);
      expect(pagos.map((p) => p.montoCentavos)).toEqual(['20000', '20000', '16400']);
      expect(pagos[2]).toMatchObject({
        propinaCentavos: '5640',
        recibidoCentavos: '50000',
        cambioCentavos: '27960',
      });
      const suma = pagos.reduce(
        (s, p) => s + BigInt(p.montoCentavos) + BigInt(p.propinaCentavos),
        0n,
      );
      expect(suma).toBe(BigInt(PLATO) + 5_640n);
    },
  );
});
