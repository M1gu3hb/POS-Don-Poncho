import { conTransaccion, obtenerDb } from '@morphiqpos/data';
import { sql } from 'kysely';
import { describe, expect, it } from 'vitest';

import { cerrarCaja } from '../caja/sesion.ts';
import { negocioDelTokenDeMesa } from '../negocio/despliegue.ts';
import { comando } from '../produccion.ts';
import { abrirCajaReal, clave, exigirOk } from '../pruebas/negocio-real.ts';
import { cancelarOrden } from '../restaurante/cancelacion.ts';
import { pasarMesaCobradaALimpieza } from '../restaurante/mesas-escrituras.ts';
import { enviarElCarrito } from './carrito-comandos.ts';
import { abrirMesaDesdeQR } from './mesa.ts';
import { enviarPedidoDesdeQR } from './pedido.ts';
import {
  comandasDe,
  lineasDeLaCuenta,
  mesaConPortal,
  TELEFONO_A,
  TELEFONO_B,
} from './pruebas/mesa-con-portal.ts';

/**
 * DP-12.2 · EL CARRITO CON LA MESA CERRADA Y QUIÉN MANDA A COCINA, contra Postgres real.
 *
 * Los comensales arman el carrito aunque la mesa no tenga cuenta; lo armado se conserva al abrirla
 * y se olvida cuando la cuenta se cierra o se cierra el día. Por omisión sólo el mesero envía: el
 * comensal lo llama para confirmar. Con «también los comensales», envían; y abren la mesa al
 * enviar sólo si el negocio lo deja.
 */

const regla = (r: {
  readonly ok: boolean;
  readonly error?: { readonly datos?: Readonly<Record<string, unknown>> };
}) => (r.ok ? null : r.error?.datos?.['regla']);

async function lineasEnElCarrito(mesaId: string): Promise<number> {
  const fila = await obtenerDb()
    .selectFrom('carrito_mesa_lineas')
    .select((eb) => eb.fn.countAll<string>().as('n'))
    .where('mesa_id', '=', mesaId)
    .executeTakeFirst();
  return Number(fila?.n ?? 0);
}

describe('el carrito con la mesa cerrada (DP-12.2)', () => {
  it('se arma sin cuenta, lo ven todos los teléfonos y se conserva al abrir la mesa', async () => {
    const caso = await mesaConPortal();
    exigirOk(await caso.agregar(TELEFONO_A, caso.taco, '2'), 'agregar A');
    exigirOk(await caso.agregar(TELEFONO_B, caso.agua), 'agregar B');
    const visto = await caso.mirar(TELEFONO_B);
    expect(visto).toMatchObject({ cuentaAbierta: false, envio: 'abrir_y_enviar' });
    expect(visto?.lineas.map((l) => [l.nombre, l.esMia, l.telefono])).toEqual([
      ['Taco de barbacoa', false, 1],
      ['Agua de jamaica', true, 2],
    ]);
    await caso.abrir(2);
    expect((await caso.mirar(TELEFONO_A))?.lineas).toHaveLength(2);
    exigirOk(await caso.enviar(TELEFONO_A, true), 'enviar');
    expect((await lineasDeLaCuenta(caso.mesaId)).map((l) => l.producto_nombre)).toEqual([
      'Taco de barbacoa',
      'Agua de jamaica',
    ]);
  });

  it('cada quien quita lo suyo también con la mesa cerrada', async () => {
    const caso = await mesaConPortal();
    const estado = exigirOk(await caso.agregar(TELEFONO_A, caso.taco), 'agregar');
    const linea = estado.lineas[0]?.id ?? '';
    const { quitarDelCarrito } = await import('./carrito-comandos.ts');
    const ajena = await caso.publico(quitarDelCarrito, { dispositivo: TELEFONO_B, lineaId: linea });
    expect(regla(ajena)).toBe('QR_LINEA_AJENA');
    exigirOk(
      await caso.publico(quitarDelCarrito, { dispositivo: TELEFONO_A, lineaId: linea }),
      'quitar',
    );
    expect(await lineasEnElCarrito(caso.mesaId)).toBe(0);
  });

  it('se olvida al cancelar la cuenta y al cobrarla; lo de antes no pasa a la siguiente', async () => {
    const caso = await mesaConPortal();
    const { ventaId } = await caso.abrir(1);
    exigirOk(await caso.agregar(TELEFONO_A, caso.taco), 'agregar');
    exigirOk(
      await comando(cancelarOrden, {
        ambito: caso.ambito,
        entrada: { ordenId: ventaId, motivo: 'Se fueron' },
        idempotencyKey: clave(),
      }),
      'cancelar',
    );
    expect(await lineasEnElCarrito(caso.mesaId)).toBe(0);

    const otra = await caso.abrir(1);
    exigirOk(await caso.agregar(TELEFONO_A, caso.agua), 'agregar');
    await conTransaccion((tx) =>
      pasarMesaCobradaALimpieza(tx, caso.negocio.organizacionId, otra.ventaId, {
        empleoId: caso.ambito.empleoId,
        ahora: new Date(),
      }),
    );
    expect(await lineasEnElCarrito(caso.mesaId)).toBe(0);
  });

  it('se olvida al cerrar el día (la última caja de la sucursal)', async () => {
    const caso = await mesaConPortal();
    exigirOk(await caso.agregar(TELEFONO_A, caso.taco), 'agregar');
    await abrirCajaReal(caso.ambito, 50_000);
    exigirOk(
      await comando(cerrarCaja, {
        ambito: caso.ambito,
        entrada: { efectivoContadoCentavos: 50_000 },
        idempotencyKey: clave(),
      }),
      'caja.cerrar',
    );
    expect(await lineasEnElCarrito(caso.mesaId)).toBe(0);
  });
});

describe('quién manda a cocina (DP-12.2)', () => {
  it('sólo el mesero: el comensal no envía, lo llama con «Pedido listo para confirmar (N)»', async () => {
    const caso = await mesaConPortal({ envian: 'mesero' });
    exigirOk(await caso.agregar(TELEFONO_A, caso.taco, '2'), 'agregar');
    exigirOk(await caso.agregar(TELEFONO_B, caso.agua), 'agregar');
    expect((await caso.mirar(TELEFONO_A))?.envio).toBe('llamar_mesero');
    expect(regla(await caso.enviar(TELEFONO_A, true))).toBe('QR_SOLO_EL_MESERO_ENVIA');

    const primero = exigirOk(await caso.llamar(TELEFONO_A), 'llamar');
    expect(primero).toMatchObject({ platillos: 3, yaAvisado: false });
    exigirOk(await caso.agregar(TELEFONO_B, caso.agua), 'agregar otra');
    const segundo = exigirOk(await caso.llamar(TELEFONO_B), 'llamar otra vez');
    // DP-13.2: volver a llamar RENUEVA el aviso (otro id), para que se anuncie otra vez.
    expect(segundo).toMatchObject({ platillos: 4, yaAvisado: true });
    expect(segundo.solicitudId).not.toBe(primero.solicitudId);
    const avisos = await obtenerDb()
      .selectFrom('solicitudes_qr')
      .select(['tipo', 'estado', 'notas'])
      .where('mesa_id', '=', caso.mesaId)
      .orderBy('created_at')
      .execute();
    expect(avisos).toEqual([
      { tipo: 'ordenar', estado: 'resuelta', notas: 'Pedido listo para confirmar (3 platillos)' },
      { tipo: 'ordenar', estado: 'pendiente', notas: 'Pedido listo para confirmar (4 platillos)' },
    ]);
    expect((await caso.mirar(TELEFONO_A))?.meseroAvisado).toBe(true);
    expect(await comandasDe(caso.mesaId)).toBe(0);
  });

  it('llamar con el carrito vacío no avisa a nadie', async () => {
    const caso = await mesaConPortal({ envian: 'mesero' });
    expect(regla(await caso.llamar(TELEFONO_A))).toBe('QR_CARRITO_VACIO');
  });

  it('también los comensales, con la mesa cerrada y sin poder abrirla: piden que los atiendan', async () => {
    const caso = await mesaConPortal({ envian: 'comensales', abrenMesa: false });
    exigirOk(await caso.agregar(TELEFONO_A, caso.taco), 'agregar');
    expect(regla(await caso.enviar(TELEFONO_A, true))).toBe('QR_PIDE_QUE_TE_ATIENDAN');
    expect(await lineasDeLaCuenta(caso.mesaId)).toEqual([]);
  });

  it('también los comensales y pueden abrir: enviar abre la mesa y manda, con confirmación de 2+', async () => {
    const caso = await mesaConPortal({ envian: 'comensales', abrenMesa: true });
    exigirOk(await caso.agregar(TELEFONO_A, caso.taco), 'agregar A');
    exigirOk(await caso.agregar(TELEFONO_B, caso.agua), 'agregar B');
    expect((await caso.mirar(TELEFONO_A))?.envio).toBe('abrir_y_enviar');
    expect(regla(await caso.enviar(TELEFONO_A, false))).toBe('QR_CARRITO_SIN_CONFIRMAR');
    // DP-13.3: las personas son las que el comensal confirma al abrir, no los teléfonos conectados.
    const enviado = exigirOk(
      await caso.publico(enviarElCarrito, {
        dispositivo: TELEFONO_A,
        confirmado: true,
        apertura: {
          personas: 2,
          clienteNombre: '',
          notas: '',
          notasAlergias: '',
          celebracionEspecial: false,
          tipoCelebracion: '',
        },
      }),
      'enviar',
    );
    expect(enviado.enviado).toBe(true);
    const mesa = await obtenerDb()
      .selectFrom('mesas')
      .select(['estado', 'orden_activa_id', 'personas_actuales'])
      .where('id', '=', caso.mesaId)
      .executeTakeFirstOrThrow();
    expect(mesa.orden_activa_id).not.toBeNull();
    expect(mesa.personas_actuales).toBe(2);
    expect(await comandasDe(caso.mesaId)).toBe(2);
  });
});

describe('lo que trae el carrito (DP-12.2)', () => {
  it('sin «Mostrar precios», la respuesta tampoco los trae', async () => {
    const caso = await mesaConPortal();
    exigirOk(await caso.agregar(TELEFONO_A, caso.taco), 'agregar');
    await sql`
      update configuracion set valores = valores || '{"portal_qr_mostrar_precios": false}'::jsonb
       where organizacion_id = ${caso.negocio.organizacionId}
    `.execute(obtenerDb());
    const visto = await caso.mirar(TELEFONO_A);
    expect(visto?.lineas.map((l) => l.precioCentavos)).toEqual([null]);
  });

  it('una cantidad fuera de rango es un error de la entrada, no un 500', async () => {
    const caso = await mesaConPortal();
    const r = await caso.agregar(TELEFONO_A, caso.taco, '999.5');
    expect(r.ok ? null : r.error.codigo).toBe('ENTRADA_INVALIDA');
  });

  it('un token inventado no llega a contar en el límite: no es de ninguna mesa', async () => {
    const caso = await mesaConPortal();
    const slug = (
      await obtenerDb()
        .selectFrom('organizaciones')
        .select('slug')
        .where('id', '=', caso.negocio.organizacionId)
        .executeTakeFirstOrThrow()
    ).slug;
    await expect(negocioDelTokenDeMesa(slug, null, 'inventado_123456789')).rejects.toMatchObject({
      codigo: 'QR_TOKEN_INVALIDO',
    });
    await expect(negocioDelTokenDeMesa(slug, null, caso.qrToken)).resolves.toMatchObject({
      organizacionId: caso.negocio.organizacionId,
    });
  });
});

describe('con el mesero confirmando, el comensal no abre ni pide directo (DP-12.2)', () => {
  it('ni abrir la mesa ni el pedido sin carrito', async () => {
    const caso = await mesaConPortal({ envian: 'mesero' });
    const abrir = await caso.publico(abrirMesaDesdeQR, {
      personas: 2,
      clienteNombre: '',
      notas: '',
      notasAlergias: '',
    });
    expect(regla(abrir)).toBe('QR_PIDE_QUE_TE_ATIENDAN');
    const directo = await caso.publico(enviarPedidoDesdeQR, {
      items: [{ productoId: caso.taco, cantidad: '1', notas: '' }],
      notaGeneral: '',
    });
    expect(regla(directo)).toBe('QR_SOLO_EL_MESERO_ENVIA');
  });

  it('y con los comensales enviando pero sin poder abrir, tampoco abre', async () => {
    const caso = await mesaConPortal({ envian: 'comensales', abrenMesa: false });
    const abrir = await caso.publico(abrirMesaDesdeQR, {
      personas: 2,
      clienteNombre: '',
      notas: '',
      notasAlergias: '',
    });
    expect(regla(abrir)).toBe('QR_PIDE_QUE_TE_ATIENDAN');
  });
});
