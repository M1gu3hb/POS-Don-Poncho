import { obtenerDb } from '@morphiqpos/data';
import { describe, expect, it } from 'vitest';

import { exigirOk } from '../pruebas/negocio-real.ts';
import { enviarElCarrito } from './carrito-comandos.ts';
import { comandasDe, mesaConPortal, TELEFONO_A, TELEFONO_B } from './pruebas/mesa-con-portal.ts';
import type { CasoDeLaMesa } from './pruebas/personal-de-la-mesa.ts';

/**
 * DP-13.3 (punto 13) · «ABRIR LA MESA Y ENVIAR» ES UNA SOLA TRANSACCIÓN, contra Postgres real.
 *
 * Antes la pantalla abría la mesa con una llamada y, aparte, el comensal enviaba con otra: si el
 * envío fallaba, la mesa se quedaba abierta sin pedido. Ahora el envío trae los datos de la apertura
 * (las personas que el comensal confirmó, el nombre, las alergias…) y abre y manda en el mismo
 * comando. Y las personas ya no salen de cuántos teléfonos están conectados.
 */

const APERTURA = {
  personas: 3,
  clienteNombre: 'Familia Soto',
  notas: '',
  notasAlergias: 'sin chile',
  celebracionEspecial: false,
  tipoCelebracion: '',
};

const regla = (r: {
  readonly ok: boolean;
  readonly error?: { readonly datos?: Readonly<Record<string, unknown>> };
}) => (r.ok ? null : r.error?.datos?.['regla']);

async function armar(caso: CasoDeLaMesa) {
  exigirOk(await caso.agregar(TELEFONO_A, caso.taco, '2'), 'agregar A');
  exigirOk(await caso.agregar(TELEFONO_B, caso.agua), 'agregar B');
}

async function estadoDeLaMesa(caso: CasoDeLaMesa) {
  const db = obtenerDb();
  const mesa = await db
    .selectFrom('mesas')
    .select(['estado', 'orden_activa_id', 'personas_actuales'])
    .where('id', '=', caso.mesaId)
    .executeTakeFirstOrThrow();
  const ordenes = await db
    .selectFrom('ordenes')
    .select((eb) => eb.fn.countAll<string>().as('n'))
    .where('mesa_id', '=', caso.mesaId)
    .executeTakeFirstOrThrow();
  const carrito = await db
    .selectFrom('carrito_mesa_lineas')
    .select((eb) => eb.fn.countAll<string>().as('n'))
    .where('mesa_id', '=', caso.mesaId)
    .executeTakeFirstOrThrow();
  return { mesa, ordenes: Number(ordenes.n), enElCarrito: Number(carrito.n) };
}

describe('abrir la mesa y enviar, en un solo comando', () => {
  it('abre con las personas que el comensal confirmó y manda el pedido', async () => {
    const caso = await mesaConPortal({ envian: 'comensales', abrenMesa: true });
    await armar(caso);
    const r = exigirOk(
      await caso.publico(enviarElCarrito, {
        dispositivo: TELEFONO_A,
        confirmado: true,
        apertura: APERTURA,
      }),
      'abrir y enviar',
    );
    expect(r).toMatchObject({ enviado: true, ronda: 1 });
    const vista = await estadoDeLaMesa(caso);
    expect(vista.mesa.orden_activa_id).not.toBeNull();
    expect(vista.mesa.personas_actuales).toBe(3);
    expect(vista.enElCarrito).toBe(0);
    expect(await comandasDe(caso.mesaId)).toBe(2);
    const orden = await obtenerDb()
      .selectFrom('ordenes')
      .select(['personas', 'cliente_nombre', 'notas_alergias'])
      .where('mesa_id', '=', caso.mesaId)
      .executeTakeFirstOrThrow();
    expect(orden).toEqual({
      personas: 3,
      cliente_nombre: 'Familia Soto',
      notas_alergias: 'sin chile',
    });
  });

  it('si el envío falla, la mesa no queda abierta y el pedido sigue armado', async () => {
    const caso = await mesaConPortal({ envian: 'comensales', abrenMesa: true });
    await armar(caso);
    const roto = await caso.publico(
      enviarElCarrito,
      { dispositivo: TELEFONO_A, confirmado: true, apertura: APERTURA },
      'enviar_a_cocina',
    );
    expect(roto.ok ? null : roto.error.codigo).toBe('ERROR_INTERNO');
    const vista = await estadoDeLaMesa(caso);
    expect(vista.mesa).toEqual({ estado: 'libre', orden_activa_id: null, personas_actuales: 0 });
    expect(vista.ordenes).toBe(0);
    expect(vista.enElCarrito).toBe(2);
    expect(await comandasDe(caso.mesaId)).toBe(0);

    // Y reintentar con lo mismo sí sale: no quedó nada a medias.
    exigirOk(
      await caso.publico(enviarElCarrito, {
        dispositivo: TELEFONO_A,
        confirmado: true,
        apertura: APERTURA,
      }),
      'reintento',
    );
    expect((await estadoDeLaMesa(caso)).mesa.personas_actuales).toBe(3);
  });

  it('sin los datos de la apertura abre para UNA persona, no para los teléfonos conectados', async () => {
    const caso = await mesaConPortal({ envian: 'comensales', abrenMesa: true });
    await armar(caso);
    await caso.mirar(TELEFONO_A);
    await caso.mirar(TELEFONO_B);
    expect((await caso.mirar(TELEFONO_A))?.conectados).toBe(2);
    exigirOk(await caso.enviar(TELEFONO_A, true), 'enviar sin apertura');
    expect((await estadoDeLaMesa(caso)).mesa.personas_actuales).toBe(1);
  });

  it('con varios teléfonos pide confirmar antes de abrir: nada se abre sin el «¿Ya pidieron todos?»', async () => {
    const caso = await mesaConPortal({ envian: 'comensales', abrenMesa: true });
    await armar(caso);
    const sin = await caso.publico(enviarElCarrito, {
      dispositivo: TELEFONO_A,
      confirmado: false,
      apertura: APERTURA,
    });
    expect(regla(sin)).toBe('QR_CARRITO_SIN_CONFIRMAR');
    const vista = await estadoDeLaMesa(caso);
    expect(vista.mesa.orden_activa_id).toBeNull();
    expect(vista.ordenes).toBe(0);
  });

  it('si la mesa ya estaba abierta, la apertura no la cambia', async () => {
    const caso = await mesaConPortal({ envian: 'comensales', abrenMesa: true });
    await caso.abrir(2);
    await armar(caso);
    exigirOk(
      await caso.publico(enviarElCarrito, {
        dispositivo: TELEFONO_A,
        confirmado: true,
        apertura: { ...APERTURA, personas: 9 },
      }),
      'enviar',
    );
    const vista = await estadoDeLaMesa(caso);
    expect(vista.mesa.personas_actuales).toBe(2);
    expect(vista.ordenes).toBe(1);
  });

  it('si el negocio no deja que los comensales abran, no abre aunque traiga la apertura', async () => {
    const caso = await mesaConPortal({ envian: 'comensales', abrenMesa: false });
    await armar(caso);
    const r = await caso.publico(enviarElCarrito, {
      dispositivo: TELEFONO_A,
      confirmado: true,
      apertura: APERTURA,
    });
    expect(regla(r)).toBe('QR_PIDE_QUE_TE_ATIENDAN');
    expect((await estadoDeLaMesa(caso)).ordenes).toBe(0);
  });
});
