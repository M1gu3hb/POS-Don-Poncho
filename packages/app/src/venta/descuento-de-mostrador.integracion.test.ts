import { conTransaccion, obtenerDb } from '@morphiqpos/data';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { firmarAutorizacion } from '../identidad/supervisor.ts';
import {
  ambitoDe,
  armarVenta,
  clave,
  exigirOk,
  sembrarCompanero,
  sembrarNegocio,
  sembrarProducto,
  sembrarSucursal,
  type NegocioReal,
} from '../pruebas/negocio-real.ts';
import { comando } from '../produccion.ts';
import { aplicarDescuento } from './descuento-de-mostrador.ts';

/**
 * F-205 · EL DESCUENTO QUE PASA EL TOPE SÓLO POR PORCENTAJE, contra Postgres (180).
 *
 * El tope de un puesto tiene dos ramas —un importe Y un porcentaje— y un descuento lo pasa
 * si pasa cualquiera. `autorizaciones_descuento` sólo conocía la del importe
 * (`descuento_centavos > tope_centavos`), así que $20 sobre una venta de $84 con tope de
 * cajera de $50 o el 10 % —24 %: pasa por porcentaje, no por importe— pedía el PIN del
 * supervisor, el supervisor lo tecleaba y Postgres rechazaba la fila con 23514. Ese
 * descuento no se podía autorizar NUNCA. La 180 guarda la base y el tope en puntos base y
 * el `check` acepta las dos ramas; esto comprueba que la fila entra de verdad.
 *
 * Desde DP-14.2 todo descuento pide la clave y el tope propio de quien pide se anota en cero:
 * la fila sigue entrando por el `check` de la 180, ahora con cualquier monto.
 *
 * El secreto con que se firma la autorización sale de `validarEntorno`, que en esta suite
 * no tiene el entorno entero del servidor: se sustituye sólo esa función, como en la
 * prueba unitaria. Todo lo demás —el comando, la transacción, la base— es el real.
 */

const SECRETO = 'secreto_de_integracion_para_firmar_autorizaciones_2026';
vi.mock('@morphiqpos/contracts', async (original) => ({
  ...(await original<typeof import('@morphiqpos/contracts')>()),
  validarEntorno: () => ({ SESSION_SECRET: SECRETO }),
}));

let negocio: NegocioReal;
let gerenteId: string;
let ambito: ReturnType<typeof ambitoDe>;
let productoId: string;

beforeAll(async () => {
  negocio = await sembrarNegocio({ nombre: 'Abarrotes del Descuento', rol: 'cajero' });
  gerenteId = await sembrarCompanero(negocio, { nombre: 'Don Chuy', rol: 'gerente' });
  const sucursal = await sembrarSucursal(negocio, { terminales: ['Caja 1'] });
  ambito = ambitoDe(negocio, sucursal.sucursalId, sucursal.terminales[0] ?? null);
  await conTransaccion((tx) =>
    tx
      .insertInto('topes_descuento')
      .values([
        {
          organizacion_id: negocio.organizacionId,
          rol: 'cajero',
          tope_centavos: 5_000n,
          tope_bp: 1_000,
        },
        {
          organizacion_id: negocio.organizacionId,
          rol: 'gerente',
          tope_centavos: 200_000n,
          tope_bp: 3_000,
        },
      ])
      .execute(),
  );
  ({ productoId } = await sembrarProducto(negocio, sucursal.almacenId, {
    nombre: 'Despensa surtida',
    precioCentavos: 8_400n,
    existencia: '10',
  }));
});

/** Lo que firma `/api/identidad/supervisor` cuando el gerente teclea su PIN en esta caja. */
function autorizacionDelGerente(ordenId: string): string {
  return firmarAutorizacion(
    {
      org: negocio.organizacionId,
      supervisor: gerenteId,
      rol: 'gerente',
      solicita: negocio.empleoId,
      exp: Math.floor(Date.now() / 1000) + 120,
      // Un nonce por firma: desde DP-14.2 la autorización se gasta al usarla.
      n: clave(),
      // DP-13.2 (D-5): para ESTA cuenta y para un descuento.
      cuenta: ordenId,
      para: 'descuento',
      // DP-14.2: y por ESTE monto.
      monto: '2000',
    },
    SECRETO,
  );
}

describe('F-205 · el descuento autorizado por porcentaje entra en la base', () => {
  it('$20 sobre $84 con tope de $50 o el 10 %: el gerente lo autoriza y queda su renglón con base y tope', async () => {
    const { ordenId } = await armarVenta(ambito, [{ productoId, cantidad: '1' }]);

    const salida = exigirOk(
      await comando(aplicarDescuento, {
        entrada: {
          ordenId,
          descuentoCentavos: 2_000,
          motivo: 'Cliente frecuente',
          autorizacion: autorizacionDelGerente(ordenId),
        },
        ambito,
        idempotencyKey: clave(),
      }),
      'venta.aplicar_descuento',
    );
    expect(salida).toEqual({
      descuentoCentavos: '2000',
      totalCentavos: '6400',
      autorizadoPor: gerenteId,
    });

    const renglon = await obtenerDb()
      .selectFrom('autorizaciones_descuento')
      .select([
        'solicita_empleo_id',
        'autoriza_empleo_id',
        'autoriza_rol',
        'descuento_centavos',
        'tope_centavos',
        'base_centavos',
        'tope_bp',
      ])
      .where('orden_id', '=', ordenId)
      .execute();
    expect(renglon).toEqual([
      {
        solicita_empleo_id: negocio.empleoId,
        autoriza_empleo_id: gerenteId,
        autoriza_rol: 'gerente',
        descuento_centavos: 2_000n,
        // DP-14.2 · El tope propio de quien pide es cero (nadie descuenta solo): la fila cabe en
        // el `check` de la 180 por las dos ramas.
        tope_centavos: 0n,
        base_centavos: 8_400n,
        tope_bp: 0,
      },
    ]);

    const orden = await obtenerDb()
      .selectFrom('orden_lineas')
      .select(['descuento_centavos', 'total_centavos'])
      .where('orden_id', '=', ordenId)
      .execute();
    expect(orden).toEqual([{ descuento_centavos: 2_000n, total_centavos: 6_400n }]);
  });
});

describe('DP-14.2 · la autorización se gasta también en el mostrador', () => {
  it('dos usos a la vez de la misma autorización sobre el mismo carrito: entra uno solo', async () => {
    // El carrito del mostrador no se bloquea al leerlo (la cuenta de una mesa sí): aquí el que pone
    // en fila a los dos usos es el candado consultivo del nonce (`autorizacion-de-un-uso.ts`).
    const { ordenId } = await armarVenta(ambito, [{ productoId, cantidad: '1' }]);
    const token = autorizacionDelGerente(ordenId);
    const aplicar = () =>
      comando(aplicarDescuento, {
        entrada: {
          ordenId,
          descuentoCentavos: 2_000,
          motivo: 'Cliente frecuente',
          autorizacion: token,
        },
        ambito,
        idempotencyKey: clave(),
      });
    const resultados = await Promise.all([aplicar(), aplicar()]);
    const reglas = resultados.map((r) =>
      r.ok
        ? null
        : ((r.error.datos as { readonly regla?: string } | undefined)?.regla ?? r.error.codigo),
    );
    expect(reglas.sort()).toEqual(['AUTORIZACION_USADA', null].sort());
  });
});
