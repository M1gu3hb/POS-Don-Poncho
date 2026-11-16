import { conTransaccion, obtenerDb } from '@morphiqpos/data';
import { sql } from 'kysely';
import { describe, expect, it } from 'vitest';

import { abrirCajaReal, exigirOk } from '../pruebas/negocio-real.ts';
import { leerElCarritoParaElMesero } from '../restaurante/carrito-del-mesero-lectura.ts';
import { cobrarExacto } from '../restaurante/pruebas/salon-real.ts';
import { payloadDelPortal } from './consulta.ts';
import { pedirCuentaQR } from './cuenta.ts';
import { abrirMesaDesdeQR } from './mesa.ts';
import {
  comandasDe,
  mesaConPortal,
  PIMIENTA,
  TELEFONO_A,
  TELEFONO_B,
  telefonoNumero,
} from './pruebas/mesa-con-portal.ts';
import { crearSolicitudQR } from './solicitudes.ts';

/**
 * DP-21 · EL PORTAL, A SALVO DESDE FUERA, contra Postgres real.
 *
 * El QR de cada mesa está impreso: quien le tome una foto tiene la liga. Lo que se vigila aquí es
 * que desde la calle no se pueda hacer daño sin romper el flujo bueno (los comensales se sientan,
 * arman su pedido y llaman al mesero, que lo confirma).
 */

const regla = (r: {
  readonly ok: boolean;
  readonly error?: { readonly datos?: Readonly<Record<string, unknown>> };
}) => (r.ok ? null : r.error?.datos?.['regla']);

const mensaje = (r: { readonly ok: boolean; readonly error?: { readonly mensaje?: string } }) =>
  r.ok ? '' : (r.error?.mensaje ?? '');

async function contar(
  tabla: 'solicitudes_qr' | 'dispositivos_mesa' | 'carrito_mesa_lineas',
  mesaId: string,
  tipo?: string,
) {
  let consulta = obtenerDb()
    .selectFrom(tabla)
    .select((eb) => eb.fn.countAll<string>().as('n'))
    .where('mesa_id', '=', mesaId);
  if (tipo !== undefined && tabla === 'solicitudes_qr')
    consulta = consulta.where('tipo', '=', tipo);
  return Number((await consulta.executeTakeFirst())?.n ?? 0);
}

/** El mesero atendió: lo que estaba pendiente queda resuelto (para poder volver a avisar). */
async function resolverLosAvisos(mesaId: string): Promise<void> {
  await obtenerDb()
    .updateTable('solicitudes_qr')
    .set({ estado: 'resuelta', resuelta_en: new Date() })
    .where('mesa_id', '=', mesaId)
    .where('estado', '=', 'pendiente')
    .execute();
}

const DE_UNA_PERSONA = { personas: 2, clienteNombre: '', notas: '', notasAlergias: '' };

describe('nada llega a cocina sin el mesero', () => {
  it('un negocio sin configurar es de mesero: el comensal ni envía ni abre la mesa', async () => {
    const caso = await mesaConPortal({ envian: 'comensales', abrenMesa: true });
    await conTransaccion((tx) =>
      sql`update configuracion
             set valores = valores - 'portal_qr_envia_a_cocina' - 'portal_qr_comensales_abren_mesa'
           where organizacion_id = ${caso.negocio.organizacionId}`.execute(tx),
    );
    exigirOk(await caso.agregar(TELEFONO_A, caso.taco), 'agregar');
    expect(regla(await caso.enviar(TELEFONO_A, true))).toBe('QR_SOLO_EL_MESERO_ENVIA');
    expect(regla(await caso.publico(abrirMesaDesdeQR, DE_UNA_PERSONA))).toBe(
      'QR_PIDE_QUE_TE_ATIENDAN',
    );
    expect(await comandasDe(caso.mesaId)).toBe(0);
  });

  it('el mesero ve de qué teléfono y a qué hora llegó cada platillo', async () => {
    const caso = await mesaConPortal({ envian: 'mesero' });
    exigirOk(await caso.agregar(TELEFONO_A, caso.taco), 'agregar A');
    exigirOk(await caso.agregar(TELEFONO_B, caso.agua), 'agregar B');
    const filas = await obtenerDb()
      .selectFrom('carrito_mesa_lineas')
      .select(['producto_id', 'created_at'])
      .where('mesa_id', '=', caso.mesaId)
      .execute();
    const vista = await leerElCarritoParaElMesero(caso.ambito, { mesaId: caso.mesaId });
    const delTaco = vista.carrito.lineas.find((l) => l.productoId === caso.taco);
    const delAgua = vista.carrito.lineas.find((l) => l.productoId === caso.agua);
    expect([delTaco?.telefono, delAgua?.telefono]).toEqual([1, 2]);
    const horaDe = (id: string) =>
      filas.find((f) => f.producto_id === id)?.created_at.toISOString();
    expect(delTaco?.agregadaEn).toBe(horaDe(caso.taco));
    expect(delAgua?.agregadaEn).toBe(horaDe(caso.agua));
  });
});

describe('«Llamar al mesero» y «Ayuda» no se pueden usar para llenar de avisos', () => {
  it('un teléfono no pasa de 3 avisos por minuto: el cuarto se contesta con amabilidad y no suena', async () => {
    const caso = await mesaConPortal({ envian: 'mesero' });
    exigirOk(await caso.agregar(TELEFONO_A, caso.taco), 'agregar');
    for (let i = 0; i < 3; i += 1) exigirOk(await caso.llamar(TELEFONO_A), `llamar ${String(i)}`);
    const cuarto = exigirOk(await caso.llamar(TELEFONO_A), 'el cuarto es amable, no un error');
    expect(cuarto.yaAvisado).toBe(true);
    expect(await contar('solicitudes_qr', caso.mesaId, 'ordenar')).toBe(3);
  });

  it('una mesa no pasa de 6 avisos por minuto, aunque cada teléfono vaya por su cuenta', async () => {
    const caso = await mesaConPortal({ envian: 'mesero' });
    exigirOk(await caso.agregar(TELEFONO_A, caso.taco), 'agregar');
    for (const tel of [TELEFONO_A, TELEFONO_B]) {
      for (let i = 0; i < 3; i += 1) exigirOk(await caso.llamar(tel), 'llamar');
    }
    exigirOk(await caso.llamar(telefonoNumero(3)), 'el séptimo, amable');
    expect(await contar('solicitudes_qr', caso.mesaId, 'ordenar')).toBe(6);
  });

  it('«Ayuda» también: 3 por minuto por teléfono, con el mensaje amable', async () => {
    const caso = await mesaConPortal({ envian: 'mesero' });
    for (let i = 0; i < 3; i += 1) {
      exigirOk(
        await caso.publico(crearSolicitudQR, { tipo: 'ayuda', dispositivo: TELEFONO_A }),
        'ayuda',
      );
      await resolverLosAvisos(caso.mesaId);
    }
    const cuarta = await caso.publico(crearSolicitudQR, { tipo: 'ayuda', dispositivo: TELEFONO_A });
    expect(regla(cuarta)).toBe('QR_SOLICITUD_DUPLICADA');
    expect(mensaje(cuarta)).toContain('Ya avisamos a tu mesero');
    expect(await contar('solicitudes_qr', caso.mesaId, 'ayuda')).toBe(3);
  });

  it('un id de teléfono inventado no esquiva el tope', async () => {
    const caso = await mesaConPortal({ envian: 'mesero' });
    for (let i = 0; i < 3; i += 1) {
      const dispositivo = `inventado-${String(i)}-xxxxxxxxxx`;
      exigirOk(await caso.publico(crearSolicitudQR, { tipo: 'ayuda', dispositivo }), 'ayuda');
      await resolverLosAvisos(caso.mesaId);
    }
    const cuarta = await caso.publico(crearSolicitudQR, {
      tipo: 'ayuda',
      dispositivo: 'inventado-otro-xxxxxxxxxx',
    });
    expect(mensaje(cuarta)).toContain('Ya avisamos a tu mesero');
  });

  it('el flujo bueno no se estorba: cuatro comensales avisan una vez cada uno', async () => {
    const caso = await mesaConPortal({ envian: 'mesero' });
    exigirOk(await caso.agregar(TELEFONO_A, caso.taco), 'agregar');
    exigirOk(await caso.llamar(TELEFONO_A), 'A llama');
    exigirOk(await caso.llamar(TELEFONO_B), 'B llama');
    exigirOk(
      await caso.publico(crearSolicitudQR, { tipo: 'ayuda', dispositivo: telefonoNumero(3) }),
      'C pide ayuda',
    );
    exigirOk(await caso.llamar(telefonoNumero(4)), 'D llama');
    // Cada uno de los cuatro avisó de verdad: nadie se quedó sin que sonara.
    expect(await contar('solicitudes_qr', caso.mesaId, 'ordenar')).toBe(3);
    expect(await contar('solicitudes_qr', caso.mesaId, 'ayuda')).toBe(1);
  });
});

describe('«Pedir la cuenta» sólo con la cuenta abierta', () => {
  it('sin cuenta no hay cuenta que pedir, ni por el comando ni por el aviso', async () => {
    const caso = await mesaConPortal();
    const directa = await caso.publico(pedirCuentaQR, { propinaTipo: 'sin_propina' });
    expect(regla(directa)).toBe('ORDEN_NO_ENCONTRADA');
    const aviso = await caso.publico(crearSolicitudQR, { tipo: 'cuenta', dispositivo: TELEFONO_A });
    expect(regla(aviso)).toBe('ORDEN_NO_ENCONTRADA');
    expect(await contar('solicitudes_qr', caso.mesaId, 'cuenta')).toBe(0);
  });

  it('con la cuenta abierta, el aviso sí sale', async () => {
    const caso = await mesaConPortal();
    await caso.abrir(2);
    exigirOk(
      await caso.publico(crearSolicitudQR, { tipo: 'cuenta', dispositivo: TELEFONO_A }),
      'aviso',
    );
    expect(await contar('solicitudes_qr', caso.mesaId, 'cuenta')).toBe(1);
  });
});

describe('al cobrar la cuenta, la sesión del portal termina', () => {
  it('quien vuelve a abrir la liga empieza de cero: ni ve ni toca la cuenta anterior', async () => {
    const caso = await mesaConPortal();
    // La cuenta la pide el comensal (por omisión la dispara el mesero): así se prueba el camino
    // del comensal hasta el cobro.
    await conTransaccion((tx) =>
      sql`update configuracion
             set valores = valores || '{"portal_qr_cuenta_modo":"cliente_solicita"}'::jsonb
           where organizacion_id = ${caso.negocio.organizacionId}`.execute(tx),
    );
    await abrirCajaReal(caso.ambito);
    const { ventaId } = await caso.abrir(2);
    exigirOk(await caso.agregar(TELEFONO_A, caso.taco), 'agregar A');
    exigirOk(await caso.agregar(TELEFONO_B, caso.agua), 'agregar B');
    exigirOk(await caso.enviar(TELEFONO_A, true), 'enviar');
    exigirOk(await caso.agregar(TELEFONO_B, caso.agua), 'otra de B');
    const cuenta = exigirOk(
      await caso.publico(pedirCuentaQR, { propinaTipo: 'sin_propina' }),
      'pedir la cuenta',
    );
    exigirOk(await cobrarExacto(caso.ambito, ventaId, Number(cuenta.subtotalCentavos)), 'cobrar');

    expect(await contar('dispositivos_mesa', caso.mesaId)).toBe(0);
    expect(await contar('carrito_mesa_lineas', caso.mesaId)).toBe(0);
    expect(await caso.mirar(TELEFONO_B)).toMatchObject({
      lineas: [],
      cuentaAbierta: false,
      cuentaPedida: false,
      conectados: 1,
    });
    const portal = await payloadDelPortal(caso.negocio.organizacionId, caso.qrToken, PIMIENTA);
    expect(portal.cuenta).toBeNull();
    expect(regla(await caso.publico(pedirCuentaQR, { propinaTipo: 'sin_propina' }))).toBe(
      'ORDEN_NO_ENCONTRADA',
    );
  });
});
