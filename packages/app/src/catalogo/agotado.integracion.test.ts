import { obtenerDb } from '@morphiqpos/data';
import { describe, expect, it } from 'vitest';

import { comando } from '../produccion.ts';
import {
  ambitoDe,
  clave,
  exigirOk,
  sembrarNegocio,
  sembrarSucursal,
} from '../pruebas/negocio-real.ts';
import { enviarPedidoDesdeQR } from '../portal/pedido.ts';
import { TELEFONO_A, lineasDeLaCuenta, mesaConPortal } from '../portal/pruebas/mesa-con-portal.ts';
import { enviarPedido } from '../restaurante/pedido.ts';
import { crearOrden, agregarLinea } from '../venta/carrito.ts';
import { marcarAgotado } from './agotado.ts';

/**
 * DP-15 · EL PLATILLO AGOTADO DEL DÍA, contra Postgres real.
 *
 * Se acabó la barbacoa: la cocina la marca agotada y, desde ese momento, ni el mesero, ni el
 * comensal desde su teléfono, ni el mostrador la pueden poner en una cuenta. Al empezar el día
 * siguiente vuelve sola. Lo que ya estaba pedido sigue su camino.
 */

type Caso = Awaited<ReturnType<typeof mesaConPortal>>;

type Ambito = Caso['ambito'];
const comoCocina = (caso: Caso): Ambito => ({ ...caso.ambito, rol: 'cocina' });
const comoMesero = (caso: Caso): Ambito => ({ ...caso.ambito, rol: 'mesero' });

async function marcar(
  caso: Caso,
  productoId: string,
  agotado: boolean,
  ambito: Ambito = comoCocina(caso),
) {
  return comando(marcarAgotado, {
    ambito,
    entrada: { productoId, agotado },
    idempotencyKey: clave(),
  });
}

async function ordenDeLaMesa(mesaId: string): Promise<string> {
  const fila = await obtenerDb()
    .selectFrom('ordenes')
    .select('id')
    .where('mesa_id', '=', mesaId)
    .orderBy('created_at', 'desc')
    .executeTakeFirstOrThrow();
  return fila.id;
}

/** Lo que el servidor contestó: el código de dominio viaja en `datos.regla`. */
function regla(r: {
  readonly ok: boolean;
  readonly error?: { readonly datos?: Record<string, unknown> };
}): unknown {
  return r.ok ? null : r.error?.datos?.['regla'];
}

async function pedirComoMesero(caso: Caso, productoId: string) {
  // El envío del mesero exige estación (regla 10): la general.
  await obtenerDb()
    .insertInto('estaciones_preparacion')
    .values({
      organizacion_id: caso.negocio.organizacionId,
      nombre: 'Cocina general',
      es_general: true,
    })
    .onConflict((oc) => oc.doNothing())
    .execute();
  return comando(enviarPedido, {
    ambito: comoMesero(caso),
    entrada: { ordenId: await ordenDeLaMesa(caso.mesaId), lineas: [{ productoId, cantidad: '1' }] },
    idempotencyKey: clave(),
  });
}

describe('DP-15 · el platillo agotado del día', () => {
  it('la cocina lo marca hasta el fin del día del negocio, con su auditoría', async () => {
    const caso = await mesaConPortal();
    const hecho = exigirOk(await marcar(caso, caso.taco, true), 'marcar agotado');
    expect(hecho).toMatchObject({
      productoId: caso.taco,
      nombre: 'Taco de barbacoa',
      agotado: true,
    });
    expect(hecho.hasta).not.toBeNull();
    const hasta = new Date(hecho.hasta ?? '');
    const faltan = hasta.getTime() - Date.now();
    expect(faltan).toBeGreaterThan(0);
    expect(faltan).toBeLessThanOrEqual(24 * 3600 * 1000);
    // Y es la MEDIANOCHE DE MÉXICO (la zona del negocio), no la de UTC: con un cálculo en UTC el
    // platillo volvería a las 18:00 (la revisión de código). Con lo de arriba, es la siguiente.
    const enMexico = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Mexico_City',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).format(hasta);
    expect(enMexico).toBe('00:00:00');

    const fila = await obtenerDb()
      .selectFrom('productos')
      .select('agotado_hasta')
      .where('id', '=', caso.taco)
      .executeTakeFirstOrThrow();
    expect(fila.agotado_hasta?.toISOString()).toBe(hecho.hasta);

    const auditoria = await obtenerDb()
      .selectFrom('auditoria')
      .select(['accion', 'entidad_id'])
      .where('organizacion_id', '=', caso.negocio.organizacionId)
      .where('accion', '=', 'catalogo.marcar_agotado')
      .execute();
    expect(auditoria).toEqual([{ accion: 'catalogo.marcar_agotado', entidad_id: caso.taco }]);
  });

  it('el mesero no lo puede enviar, y lo demás sí', async () => {
    const caso = await mesaConPortal();
    await caso.abrir(2);
    exigirOk(await marcar(caso, caso.taco, true), 'marcar agotado');

    const negado = await pedirComoMesero(caso, caso.taco);
    expect(regla(negado)).toBe('PRODUCTO_AGOTADO');
    expect(negado.ok ? '' : negado.error.mensaje).toContain('Taco de barbacoa se agotó por hoy');

    exigirOk(await pedirComoMesero(caso, caso.agua), 'enviar el agua');
    expect((await lineasDeLaCuenta(caso.mesaId)).map((l) => l.producto_nombre)).toEqual([
      'Agua de jamaica',
    ]);
  });

  it('el comensal no lo puede agregar al carrito; el menú y el carrito lo dicen', async () => {
    const caso = await mesaConPortal();
    await caso.abrir(1);
    exigirOk(await caso.agregar(TELEFONO_A, caso.taco), 'agregar antes de agotarse');
    exigirOk(await marcar(caso, caso.taco, true), 'marcar agotado');

    const negado = await caso.agregar(TELEFONO_A, caso.taco);
    expect(regla(negado)).toBe('PRODUCTO_AGOTADO');

    const carrito = await caso.mirar(TELEFONO_A);
    expect(carrito?.lineas.map((l) => [l.nombre, l.disponible])).toEqual([
      ['Taco de barbacoa', false],
    ]);

    // Al enviar, lo agotado sale del carrito y lo demás llega a la cuenta, como lo que ya no está.
    exigirOk(await caso.agregar(TELEFONO_A, caso.agua), 'agregar el agua');
    const enviado = exigirOk(await caso.enviar(TELEFONO_A, true), 'enviar');
    expect(enviado).toMatchObject({ enviado: true, noDisponibles: ['Taco de barbacoa'] });
    expect((await lineasDeLaCuenta(caso.mesaId)).map((l) => l.producto_nombre)).toEqual([
      'Agua de jamaica',
    ]);

    // Y el pedido directo desde el teléfono (sin carrito) también lo niega.
    const directo = await caso.publico(enviarPedidoDesdeQR, {
      items: [{ productoId: caso.taco, cantidad: '1', notas: '' }],
    });
    expect(regla(directo)).toBe('PRODUCTO_AGOTADO');
  });

  it('desmarcado, o al pasar el fin del día, vuelve a pedirse', async () => {
    const caso = await mesaConPortal();
    await caso.abrir(2);
    exigirOk(await marcar(caso, caso.taco, true), 'marcar agotado');
    const desmarcado = exigirOk(await marcar(caso, caso.taco, false), 'desmarcar');
    expect(desmarcado).toMatchObject({ agotado: false, hasta: null });
    exigirOk(await pedirComoMesero(caso, caso.taco), 'pedir desmarcado');

    // Como si se hubiera marcado ayer: su fin del día ya pasó.
    await obtenerDb()
      .updateTable('productos')
      .set({ agotado_hasta: new Date(Date.now() - 60_000) })
      .where('id', '=', caso.agua)
      .execute();
    exigirOk(await pedirComoMesero(caso, caso.agua), 'pedir lo de ayer');
    exigirOk(await caso.agregar(TELEFONO_A, caso.agua), 'agregar lo de ayer al carrito');
  });

  it('el mostrador tampoco lo vende', async () => {
    const caso = await mesaConPortal();
    exigirOk(await marcar(caso, caso.taco, true), 'marcar agotado');
    const orden = exigirOk(
      await comando(crearOrden, { ambito: caso.ambito, entrada: {}, idempotencyKey: clave() }),
      'crear orden',
    );
    const negado = await comando(agregarLinea, {
      ambito: caso.ambito,
      entrada: { ordenId: orden.ordenId, productoId: caso.taco, cantidad: '1' },
      idempotencyKey: clave(),
    });
    expect(regla(negado)).toBe('PRODUCTO_AGOTADO');
  });

  it('el mesero y la caja no lo marcan; un producto de otro negocio no se toca', async () => {
    const caso = await mesaConPortal();
    const mesero = await marcar(caso, caso.taco, true, comoMesero(caso));
    expect(mesero.ok).toBe(false);
    const caja = await marcar(caso, caso.taco, true, { ...caso.ambito, rol: 'cajero' });
    expect(caja.ok).toBe(false);

    const otro = await sembrarNegocio({
      nombre: 'Otra fonda',
      rol: 'dueno',
      giro: 'restaurante',
      paquete: 'restaurante',
    });
    const suSucursal = await sembrarSucursal(otro, { terminales: [] });
    const ajeno = await comando(marcarAgotado, {
      ambito: { ...ambitoDe(otro, suSucursal.sucursalId, null), rol: 'cocina' as const },
      entrada: { productoId: caso.taco, agotado: true },
      idempotencyKey: clave(),
    });
    expect(regla(ajeno)).toBe('PRODUCTO_NO_ENCONTRADO');
    const fila = await obtenerDb()
      .selectFrom('productos')
      .select('agotado_hasta')
      .where('id', '=', caso.taco)
      .executeTakeFirstOrThrow();
    expect(fila.agotado_hasta).toBeNull();
  });
});
