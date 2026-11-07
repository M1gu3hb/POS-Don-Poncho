import { obtenerDb } from '@morphiqpos/data';
import { describe, expect, it } from 'vitest';

import { exigirOk } from '../pruebas/negocio-real.ts';
import { enviarElCarrito } from './carrito-comandos.ts';
import { enviarPedidoDesdeQR } from './pedido.ts';
import { huellaDelDispositivo } from './carrito.ts';
import {
  PIMIENTA,
  TELEFONO_A,
  TELEFONO_B,
  comandasDe,
  lineasDeLaCuenta,
  mesaConPortal,
} from './pruebas/mesa-con-portal.ts';

/**
 * PAR-1 · LO QUE YA NO SE PUEDE PEDIR DEL CARRITO COMPARTIDO, contra Postgres real.
 *
 * Una línea entra al carrito cuando el producto se podía pedir. Si después el negocio lo oculta,
 * lo desactiva o le cambia la regla de cantidad, «Enviar» trababa a TODA la mesa
 * (`PRODUCTO_NO_ENCONTRADO`) y sólo el teléfono que la agregó podía quitarla. Ahora todos la ven
 * marcada, el envío la quita, manda lo demás y lo dice; y si algo falla, no se quita nada.
 */

async function cambiarProducto(
  productoId: string,
  cambio: { readonly visible_en_menu_digital?: boolean; readonly activo?: boolean },
): Promise<void> {
  await obtenerDb().updateTable('productos').set(cambio).where('id', '=', productoId).execute();
}

const nombres = (estado: { readonly lineas: readonly { readonly nombre: string }[] } | null) =>
  estado?.lineas.map((l) => l.nombre) ?? [];

describe('lo que ya no se puede pedir del carrito compartido', () => {
  it('todos lo ven marcado; el envío lo quita, manda lo demás y lo dice', async () => {
    const caso = await mesaConPortal();
    await caso.abrir(1);
    exigirOk(await caso.agregar(TELEFONO_A, caso.taco, '2'), 'agregar A');
    exigirOk(await caso.agregar(TELEFONO_B, caso.agua), 'agregar B');
    await cambiarProducto(caso.taco, { visible_en_menu_digital: false });

    const antes = await caso.mirar(TELEFONO_A);
    expect(antes?.lineas.map((l) => [l.nombre, l.disponible])).toEqual([
      ['Taco de barbacoa', false],
      ['Agua de jamaica', true],
    ]);

    const enviado = exigirOk(await caso.enviar(TELEFONO_B, true), 'enviar');
    expect(enviado).toMatchObject({
      enviado: true,
      ronda: 1,
      pedido: { lineas: 1 },
      noDisponibles: ['Taco de barbacoa'],
    });
    expect((await lineasDeLaCuenta(caso.mesaId)).map((l) => l.producto_nombre)).toEqual([
      'Agua de jamaica',
    ]);
    expect(nombres(await caso.mirar(TELEFONO_A))).toEqual([]);
  });

  it('si nada se puede pedir (oculto o desactivado, de dos teléfonos), no se envía nada y se dice', async () => {
    const caso = await mesaConPortal();
    await caso.abrir(1);
    exigirOk(await caso.agregar(TELEFONO_A, caso.taco), 'taco A');
    exigirOk(await caso.agregar(TELEFONO_B, caso.taco), 'taco B');
    exigirOk(await caso.agregar(TELEFONO_A, caso.agua), 'agua A');
    await cambiarProducto(caso.taco, { visible_en_menu_digital: false });
    await cambiarProducto(caso.agua, { activo: false });

    const r = exigirOk(await caso.enviar(TELEFONO_A, true), 'enviar');
    expect(r).toMatchObject({
      enviado: false,
      ronda: 0,
      pedido: null,
      noDisponibles: ['Taco de barbacoa', 'Agua de jamaica'],
    });
    expect(await lineasDeLaCuenta(caso.mesaId)).toEqual([]);
    expect(await comandasDe(caso.mesaId)).toBe(0);
    expect(nombres(await caso.mirar(TELEFONO_B))).toEqual([]);
  });

  it('una cantidad que el producto no admite no entra; si la regla cambió después, el envío la aparta', async () => {
    const caso = await mesaConPortal();
    await caso.abrir(1);
    const media = await caso.agregar(TELEFONO_A, caso.taco, '0.5');
    expect(media.ok ? null : media.error.datos?.['regla']).toBe('CATALOGO_INVALIDO');

    // Como si el negocio hubiera cambiado la unidad con la línea ya en el carrito.
    await obtenerDb()
      .insertInto('carrito_mesa_lineas')
      .values({
        organizacion_id: caso.negocio.organizacionId,
        mesa_id: caso.mesaId,
        dispositivo_huella: huellaDelDispositivo(PIMIENTA, TELEFONO_A),
        producto_id: caso.taco,
        cantidad: '0.5',
      })
      .execute();
    exigirOk(await caso.agregar(TELEFONO_A, caso.agua), 'agregar agua');

    const enviado = exigirOk(await caso.enviar(TELEFONO_A, false), 'enviar');
    expect(enviado).toMatchObject({ enviado: true, noDisponibles: ['Taco de barbacoa'] });
    expect((await lineasDeLaCuenta(caso.mesaId)).map((l) => l.producto_nombre)).toEqual([
      'Agua de jamaica',
    ]);
  });

  it('sin confirmar con dos teléfonos, no se quita nada', async () => {
    const caso = await mesaConPortal();
    await caso.abrir(1);
    exigirOk(await caso.agregar(TELEFONO_A, caso.taco), 'agregar A');
    exigirOk(await caso.agregar(TELEFONO_B, caso.agua), 'agregar B');
    await cambiarProducto(caso.taco, { visible_en_menu_digital: false });

    const r = await caso.enviar(TELEFONO_A, false);
    expect(r.ok ? null : r.error.datos?.['regla']).toBe('QR_CARRITO_SIN_CONFIRMAR');
    expect(nombres(await caso.mirar(TELEFONO_B))).toEqual(['Taco de barbacoa', 'Agua de jamaica']);
  });

  it('si el envío se rompe después de apartar, el carrito queda como estaba', async () => {
    const caso = await mesaConPortal();
    await caso.abrir(1);
    exigirOk(await caso.agregar(TELEFONO_A, caso.taco), 'taco');
    exigirOk(await caso.agregar(TELEFONO_A, caso.agua), 'agua');
    await cambiarProducto(caso.taco, { visible_en_menu_digital: false });

    const roto = await caso.publico(
      enviarElCarrito,
      { dispositivo: TELEFONO_A, confirmado: false },
      'enviar_a_cocina',
    );
    expect(roto.ok).toBe(false);
    expect(nombres(await caso.mirar(TELEFONO_A))).toEqual(['Taco de barbacoa', 'Agua de jamaica']);
    expect(await lineasDeLaCuenta(caso.mesaId)).toEqual([]);
  });
});

/** El taco pasa a pedir su salsa (grupo obligatorio con «Verde»). */
async function tacoConSalsaObligatoria(caso: Awaited<ReturnType<typeof mesaConPortal>>) {
  const db = obtenerDb();
  const org = caso.negocio.organizacionId;
  const grupo = await db
    .insertInto('modificadores')
    .values({ organizacion_id: org, nombre: 'Salsa', obligatorio: true, tipo: 'unica' })
    .returning('id')
    .executeTakeFirstOrThrow();
  await db
    .insertInto('modificador_opciones')
    .values([{ modificador_id: grupo.id, nombre: 'Verde' }])
    .execute();
  await db
    .insertInto('producto_modificadores')
    .values({ organizacion_id: org, producto_id: caso.taco, modificador_id: grupo.id })
    .execute();
}

describe('DP-14.6 · la opción obligatoria en el carrito compartido (revisión del PR #9)', () => {
  it('no entra sin su opción; la que ya estaba sin ella se aparta al enviar y lo demás sale', async () => {
    const caso = await mesaConPortal();
    await tacoConSalsaObligatoria(caso);
    await caso.abrir(1);

    // Al agregar: sin su salsa no entra (si entrara, trabaría el envío de toda la mesa).
    const sin = await caso.agregar(TELEFONO_A, caso.taco, '1', 'sin cebolla');
    expect(sin.ok ? null : sin.error.datos?.['regla']).toBe('OPCION_OBLIGATORIA');
    expect(nombres(await caso.mirar(TELEFONO_A))).toEqual([]);

    // Una que ya estaba sin ella (de un teléfono con la versión anterior, o de antes del cambio).
    await obtenerDb()
      .insertInto('carrito_mesa_lineas')
      .values({
        organizacion_id: caso.negocio.organizacionId,
        mesa_id: caso.mesaId,
        dispositivo_huella: huellaDelDispositivo(PIMIENTA, TELEFONO_A),
        producto_id: caso.taco,
        cantidad: '1',
        notas: 'sin cebolla',
      })
      .execute();
    exigirOk(await caso.agregar(TELEFONO_B, caso.agua), 'agregar agua');

    const enviado = exigirOk(await caso.enviar(TELEFONO_B, true), 'enviar');
    expect(enviado).toMatchObject({ enviado: true, noDisponibles: ['Taco de barbacoa'] });
    expect((await lineasDeLaCuenta(caso.mesaId)).map((l) => l.producto_nombre)).toEqual([
      'Agua de jamaica',
    ]);
    expect(nombres(await caso.mirar(TELEFONO_A))).toEqual([]);

    // Con su salsa (como la pliega el portal en la nota), entra y sale.
    exigirOk(await caso.agregar(TELEFONO_A, caso.taco, '1', 'Salsa: Verde · sin cebolla'), 'con');
    expect(exigirOk(await caso.enviar(TELEFONO_A, true), 'enviar con salsa')).toMatchObject({
      enviado: true,
      noDisponibles: [],
    });
  });
});

describe('DP-14.6 · el pedido directo no deja sondear el menú oculto (revisión del PR #9)', () => {
  it('un platillo oculto con su grupo obligatorio contesta como uno que no existe', async () => {
    const caso = await mesaConPortal({ envian: 'comensales' });
    await tacoConSalsaObligatoria(caso);
    await caso.abrir(1);
    await cambiarProducto(caso.taco, { visible_en_menu_digital: false });
    const r = await caso.publico(enviarPedidoDesdeQR, {
      items: [{ productoId: caso.taco, cantidad: '1', notas: '' }],
    });
    expect(r.ok ? null : r.error.datos?.['regla']).toBe('PRODUCTO_NO_ENCONTRADO');
  });
});
