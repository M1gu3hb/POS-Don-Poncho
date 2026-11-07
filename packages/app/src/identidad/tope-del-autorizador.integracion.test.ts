import { obtenerDb } from '@morphiqpos/data';
import type { Rol } from '@morphiqpos/contracts';
import { describe, expect, it } from 'vitest';

import { comando } from '../produccion.ts';
import {
  ambitoDe,
  clave,
  exigirOk,
  sembrarNegocio,
  sembrarSucursal,
} from '../pruebas/negocio-real.ts';
import { topeDeDescuento } from '../venta/descuento-de-mostrador.ts';
import { topeDelAutorizador } from './tope-del-autorizador.ts';

/**
 * DP-14 ronda 2 (medio 5) · HASTA CUÁNTO LLEGA EL PIN, contra Postgres real.
 *
 * `/api/identidad/supervisor` devuelve el tope del puesto de quien autoriza para que la pantalla
 * diga «Autoriza hasta 30 %» y no deje aplicar más. Tiene que ser EXACTAMENTE el que el servidor
 * aplicará al descuento (`topeDe`, el que enseña `venta.tope_de_descuento`): fila del negocio para
 * ese puesto, y si no la hay, la del sistema, por puesto.
 */

async function elDelServidor(negocio: Awaited<ReturnType<typeof sembrarNegocio>>, rol: Rol) {
  const sucursal = await sembrarSucursal(negocio, { terminales: ['Caja 1'] });
  return exigirOk(
    await comando(topeDeDescuento, {
      entrada: {},
      ambito: { ...ambitoDe(negocio, sucursal.sucursalId, null), rol },
      idempotencyKey: clave(),
    }),
    'venta.tope_de_descuento',
  );
}

describe('el tope de quien autoriza', () => {
  it('sin topes escritos: los del sistema, iguales a los que aplica el servidor', async () => {
    const negocio = await sembrarNegocio({
      nombre: 'Fonda sin topes (autorizador)',
      rol: 'dueno',
      giro: 'restaurante',
      paquete: 'restaurante',
    });
    await obtenerDb()
      .deleteFrom('topes_descuento')
      .where('organizacion_id', '=', negocio.organizacionId)
      .execute();
    for (const rol of ['dueno', 'administrador', 'gerente'] as const) {
      const propio = await topeDelAutorizador(negocio.organizacionId, rol);
      const servidor = await elDelServidor(negocio, rol);
      expect(propio).toEqual({ topeCentavos: servidor.topeCentavos, topeBp: servidor.topeBp });
    }
    expect(await topeDelAutorizador(negocio.organizacionId, 'gerente')).toEqual({
      topeCentavos: '200000',
      topeBp: 3_000,
    });
  });

  it('con un tope escrito manda el del negocio; el puesto que no escribió usa el del sistema', async () => {
    const negocio = await sembrarNegocio({
      nombre: 'Fonda con su tope (autorizador)',
      rol: 'dueno',
      giro: 'restaurante',
      paquete: 'restaurante',
    });
    const db = obtenerDb();
    await db
      .deleteFrom('topes_descuento')
      .where('organizacion_id', '=', negocio.organizacionId)
      .execute();
    await db
      .insertInto('topes_descuento')
      .values({
        organizacion_id: negocio.organizacionId,
        rol: 'gerente',
        tope_centavos: 150_000n,
        tope_bp: 1_500,
      })
      .execute();
    const gerente = await topeDelAutorizador(negocio.organizacionId, 'gerente');
    expect(gerente).toEqual({ topeCentavos: '150000', topeBp: 1_500 });
    expect(gerente).toEqual(
      (({ topeCentavos, topeBp }) => ({ topeCentavos, topeBp }))(
        await elDelServidor(negocio, 'gerente'),
      ),
    );
    expect(await topeDelAutorizador(negocio.organizacionId, 'dueno')).toEqual({
      topeCentavos: '100000000',
      topeBp: 10_000,
    });
  });

  it('un puesto sin tope vale cero', async () => {
    const negocio = await sembrarNegocio({
      nombre: 'Fonda mesero (autorizador)',
      rol: 'dueno',
      giro: 'restaurante',
      paquete: 'restaurante',
    });
    expect(await topeDelAutorizador(negocio.organizacionId, 'mesero')).toEqual({
      topeCentavos: '0',
      topeBp: 0,
    });
  });
});
