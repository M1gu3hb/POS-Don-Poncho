import { randomUUID } from 'node:crypto';

import { conTransaccion, obtenerDb } from '@morphiqpos/data';
import { describe, expect, it } from 'vitest';

import { comando } from '../produccion.ts';
import { clave, exigirOk } from '../pruebas/negocio-real.ts';
import { enviarElCarritoDeLaMesa } from '../restaurante/carrito-del-mesero.ts';
import { solicitarCuenta } from '../restaurante/cuenta.ts';
import { reabrirLaCuentaPedida } from '../restaurante/reabrir-la-cuenta.ts';
import { abrirMesa } from '../restaurante/mesas.ts';
import { comandasDe, mesaConPortal, TELEFONO_A, TELEFONO_B } from './pruebas/mesa-con-portal.ts';
import { ambitoDelPersonal, type CasoDeLaMesa } from './pruebas/personal-de-la-mesa.ts';

/**
 * DP-13.3 (punto 15) · CUENTA PEDIDA, contra Postgres real.
 *
 * Llega un pedido del portal a una mesa cuya cuenta ya se pidió. El comensal no ve un error: ve
 * «Tu cuenta ya se pidió: tu mesero lo revisa» y puede llamarlo. El mesero, desde «Pedido del
 * portal», puede reabrir la cuenta (si no se ha cobrado) y enviarlo; sin pedirlo expresamente no se
 * reabre nada.
 */

const regla = (r: {
  readonly ok: boolean;
  readonly error?: { readonly datos?: Readonly<Record<string, unknown>> };
}) => (r.ok ? null : r.error?.datos?.['regla']);

/** Abre la mesa como la abre cada negocio: el comensal si envían ellos; el mesero, si no. */
async function abrirLaMesa(caso: CasoDeLaMesa, envian: 'mesero' | 'comensales'): Promise<string> {
  if (envian === 'comensales') return (await caso.abrir(2)).ventaId;
  const abierta = exigirOk(
    await comando(abrirMesa, {
      ambito: caso.ambito,
      entrada: { mesaId: caso.mesaId, personas: 2 },
      idempotencyKey: clave(),
    }),
    'restaurante.abrir_mesa',
  );
  return abierta.ordenId;
}

/** El camino del mesero exige una estación (regla 10): la general del negocio, como en producción. */
async function sembrarLaEstacion(caso: CasoDeLaMesa): Promise<void> {
  await obtenerDb()
    .insertInto('estaciones_preparacion')
    .values({ organizacion_id: caso.negocio.organizacionId, nombre: 'Cocina', es_general: true })
    .execute();
}

/** Mesa abierta, ya con una ronda en cocina, UN platillo armado en el portal y la cuenta pedida. */
async function mesaConLaCuentaPedida(envian: 'mesero' | 'comensales' = 'comensales') {
  const caso = await mesaConPortal({ envian });
  await sembrarLaEstacion(caso);
  const ventaId = await abrirLaMesa(caso, envian);
  exigirOk(await caso.agregar(TELEFONO_A, caso.taco), 'agregar A');
  if (envian === 'comensales') {
    exigirOk(await caso.enviar(TELEFONO_A, true), 'enviar la primera ronda');
  } else {
    exigirOk(
      await comando(enviarElCarritoDeLaMesa, {
        ambito: await ambitoDelPersonal(caso, 'mesero'),
        entrada: { mesaId: caso.mesaId },
        idempotencyKey: clave(),
      }),
      'enviar la primera ronda (el mesero)',
    );
  }
  exigirOk(await caso.agregar(TELEFONO_B, caso.agua), 'agregar B');
  exigirOk(
    await comando(solicitarCuenta, {
      ambito: caso.ambito,
      entrada: { ordenId: ventaId },
      idempotencyKey: clave(),
    }),
    'restaurante.solicitar_cuenta',
  );
  return { caso, ventaId };
}

async function laCuenta(ventaId: string) {
  return obtenerDb()
    .selectFrom('ordenes')
    .select(['estado', 'codigo_caja', 'version'])
    .where('id', '=', ventaId)
    .executeTakeFirstOrThrow();
}

async function enElCarrito(caso: CasoDeLaMesa): Promise<number> {
  const fila = await obtenerDb()
    .selectFrom('carrito_mesa_lineas')
    .select((eb) => eb.fn.countAll<string>().as('n'))
    .where('mesa_id', '=', caso.mesaId)
    .executeTakeFirstOrThrow();
  return Number(fila.n);
}

describe('el comensal con la cuenta ya pedida', () => {
  it('lo ve como un estado, no como un error: «cuenta pedida» y puede llamar al mesero', async () => {
    const { caso, ventaId } = await mesaConLaCuentaPedida();
    const visto = await caso.mirar(TELEFONO_B);
    expect(visto).toMatchObject({ cuentaPedida: true, envio: 'cuenta_pedida' });
    expect(visto?.lineas).toHaveLength(1);

    const envio = await caso.enviar(TELEFONO_B, true);
    expect(regla(envio)).toBe('QR_CUENTA_PEDIDA');
    expect(envio.ok ? '' : envio.error.mensaje).toContain('Tu cuenta ya se pidió');
    expect(await enElCarrito(caso)).toBe(1);
    expect((await laCuenta(ventaId)).estado).toBe('cuenta_solicitada');

    exigirOk(await caso.llamar(TELEFONO_B), 'llamar al mesero');
    expect((await caso.mirar(TELEFONO_B))?.meseroAvisado).toBe(true);
  });

  it('también cuando sólo el mesero envía: la cuenta pedida manda sobre «llamar a mi mesero»', async () => {
    const { caso } = await mesaConLaCuentaPedida('mesero');
    expect((await caso.mirar(TELEFONO_B))?.envio).toBe('cuenta_pedida');
  });

  it('con la cuenta sin pedir nada de esto aparece', async () => {
    const caso = await mesaConPortal({ envian: 'comensales' });
    await caso.abrir(2);
    exigirOk(await caso.agregar(TELEFONO_B, caso.agua), 'agregar B');
    expect(await caso.mirar(TELEFONO_B)).toMatchObject({ cuentaPedida: false, envio: 'enviar' });
  });
});

describe('el mesero con la cuenta ya pedida', () => {
  it('sin pedirlo expresamente, no reabre nada y dice por qué', async () => {
    const { caso, ventaId } = await mesaConLaCuentaPedida();
    const mesero = await ambitoDelPersonal(caso, 'mesero');
    const r = await comando(enviarElCarritoDeLaMesa, {
      ambito: mesero,
      entrada: { mesaId: caso.mesaId },
      idempotencyKey: clave(),
    });
    expect(regla(r)).toBe('CARRITO_CUENTA_PEDIDA');
    expect((await laCuenta(ventaId)).estado).toBe('cuenta_solicitada');
    expect(await enElCarrito(caso)).toBe(1);
  });

  it('reabre la cuenta y envía en una sola transacción, conservando su código de caja', async () => {
    const { caso, ventaId } = await mesaConLaCuentaPedida();
    const antes = await laCuenta(ventaId);
    const comandasAntes = await comandasDe(caso.mesaId);
    const mesero = await ambitoDelPersonal(caso, 'mesero');
    const r = exigirOk(
      await comando(enviarElCarritoDeLaMesa, {
        ambito: mesero,
        entrada: { mesaId: caso.mesaId, reabrirCuenta: true },
        idempotencyKey: clave(),
      }),
      'reabrir y enviar',
    );
    expect(r).toMatchObject({ enviado: true });
    const despues = await laCuenta(ventaId);
    expect(despues.estado).toBe('confirmada');
    expect(despues.codigo_caja).toBe(antes.codigo_caja);
    // Reabrirla cambia la cuenta: una caja que la tenía abierta lo sabe por su versión.
    expect(despues.version).toBe(antes.version + 1);
    expect(await comandasDe(caso.mesaId)).toBe(comandasAntes + 1);
    expect(await enElCarrito(caso)).toBe(0);
    const mesa = await obtenerDb()
      .selectFrom('mesas')
      .select('estado')
      .where('id', '=', caso.mesaId)
      .executeTakeFirstOrThrow();
    expect(mesa.estado).toBe('pedido_enviado');
    expect(await caso.mirar(TELEFONO_B)).toMatchObject({ cuentaPedida: false, envio: 'enviar' });

    const auditoria = await obtenerDb()
      .selectFrom('auditoria')
      .select('payload')
      .where('accion', '=', 'restaurante.carrito_enviar')
      .where('entidad_id', '=', ventaId)
      .executeTakeFirstOrThrow();
    expect(JSON.stringify(auditoria.payload)).toContain('"reabrioLaCuenta":true');
  });

  it('si el envío falla, la cuenta sigue pedida: reabrir y enviar se deshacen juntos', async () => {
    const { caso, ventaId } = await mesaConLaCuentaPedida();
    const mesero = await ambitoDelPersonal(caso, 'mesero');
    // Se rompe el envío DESPUÉS de reabrir (cuando ya se cotiza): lo reabierto se deshace.
    const r = await comando(enviarElCarritoDeLaMesa, {
      ambito: mesero,
      entrada: { mesaId: caso.mesaId, reabrirCuenta: true },
      idempotencyKey: clave(),
      interrumpirEn: 'cotizar',
    });
    expect(r.ok ? null : r.error.codigo).toBe('ERROR_INTERNO');
    expect((await laCuenta(ventaId)).estado).toBe('cuenta_solicitada');
    expect(await enElCarrito(caso)).toBe(1);
    const mesa = await obtenerDb()
      .selectFrom('mesas')
      .select('estado')
      .where('id', '=', caso.mesaId)
      .executeTakeFirstOrThrow();
    expect(mesa.estado).toBe('cuenta_solicitada');
  });

  it('una cuenta ya cobrada no se reabre, aunque lo pida', async () => {
    const { caso, ventaId } = await mesaConLaCuentaPedida();
    await obtenerDb()
      .updateTable('ordenes')
      .set({ estado: 'pagada', folio: 1n, cerrada_en: new Date(Date.now() + 1000) })
      .where('id', '=', ventaId)
      .execute();
    const mesero = await ambitoDelPersonal(caso, 'mesero');
    const r = await comando(enviarElCarritoDeLaMesa, {
      ambito: mesero,
      entrada: { mesaId: caso.mesaId, reabrirCuenta: true },
      idempotencyKey: clave(),
    });
    expect(regla(r)).toBe('CARRITO_SIN_CUENTA');
    expect((await laCuenta(ventaId)).estado).toBe('pagada');
    expect(await enElCarrito(caso)).toBe(1);
  });

  it('una cuenta pedida que ya tiene un pago no se reabre', async () => {
    const { caso, ventaId } = await mesaConLaCuentaPedida();
    await obtenerDb()
      .insertInto('pagos')
      .values({
        orden_id: ventaId,
        organizacion_id: caso.negocio.organizacionId,
        metodo: 'efectivo',
        monto_centavos: 100n,
      })
      .execute();
    const mesero = await ambitoDelPersonal(caso, 'mesero');
    const r = await comando(enviarElCarritoDeLaMesa, {
      ambito: mesero,
      entrada: { mesaId: caso.mesaId, reabrirCuenta: true },
      idempotencyKey: clave(),
    });
    expect(regla(r)).toBe('CARRITO_CUENTA_CON_PAGOS');
    expect((await laCuenta(ventaId)).estado).toBe('cuenta_solicitada');
  });

  it('reabrir por sí solo deja la cuenta confirmada y la mesa ocupada (el envío la avanza después)', async () => {
    const { caso, ventaId } = await mesaConLaCuentaPedida();
    await conTransaccion((tx) =>
      reabrirLaCuentaPedida(tx, {
        organizacionId: caso.negocio.organizacionId,
        sucursalId: caso.sucursalId,
        ordenId: ventaId,
        mesaId: caso.mesaId,
        empleoId: caso.ambito.empleoId,
        ahora: new Date(),
        ambito: caso.ambito,
        correlationId: randomUUID(),
      }),
    );
    expect((await laCuenta(ventaId)).estado).toBe('confirmada');
    const mesa = await obtenerDb()
      .selectFrom('mesas')
      .select('estado')
      .where('id', '=', caso.mesaId)
      .executeTakeFirstOrThrow();
    expect(mesa.estado).toBe('ocupada');
  });

  it('el helper mismo, con candado, rechaza una cuenta que ya no está pedida (carrera con el cobro)', async () => {
    const caso = await mesaConPortal({ envian: 'comensales' });
    const { ventaId } = await caso.abrir(2);
    await expect(
      conTransaccion((tx) =>
        reabrirLaCuentaPedida(tx, {
          organizacionId: caso.negocio.organizacionId,
          sucursalId: caso.sucursalId,
          ordenId: ventaId,
          mesaId: caso.mesaId,
          empleoId: caso.ambito.empleoId,
          ahora: new Date(),
          ambito: caso.ambito,
          correlationId: randomUUID(),
        }),
      ),
    ).rejects.toMatchObject({ codigo: 'ORDEN_NO_EDITABLE' });
    expect((await laCuenta(ventaId)).estado).toBe('borrador');
  });

  it('reabrir sólo se pide para una cuenta pedida: con la cuenta abierta el envío es el de siempre', async () => {
    const caso = await mesaConPortal({ envian: 'mesero' });
    await sembrarLaEstacion(caso);
    const ventaId = await abrirLaMesa(caso, 'mesero');
    exigirOk(await caso.agregar(TELEFONO_A, caso.taco), 'agregar');
    const mesero = await ambitoDelPersonal(caso, 'mesero');
    exigirOk(
      await comando(enviarElCarritoDeLaMesa, {
        ambito: mesero,
        entrada: { mesaId: caso.mesaId, reabrirCuenta: true },
        idempotencyKey: clave(),
      }),
      'enviar con reabrirCuenta sobre una cuenta abierta',
    );
    expect((await laCuenta(ventaId)).estado).toBe('confirmada');
    const auditoria = await obtenerDb()
      .selectFrom('auditoria')
      .select('payload')
      .where('accion', '=', 'restaurante.carrito_enviar')
      .where('entidad_id', '=', ventaId)
      .executeTakeFirstOrThrow();
    expect(JSON.stringify(auditoria.payload)).toContain('"reabrioLaCuenta":false');
  });
});
