import { randomUUID } from 'node:crypto';

import { conTransaccion, obtenerDb } from '@morphiqpos/data';
import { sql } from 'kysely';
import { beforeAll, describe, expect, it } from 'vitest';

import {
  ambitoDe,
  clave,
  exigirOk,
  sembrarNegocio,
  sembrarProducto,
  sembrarSucursal,
  type NegocioReal,
} from '../pruebas/negocio-real.ts';
import { comando } from '../produccion.ts';
import { rotarQr } from '../restaurante/qr.ts';
import { ejecutarComandoPublico, type PeticionPublica } from './comando-publico.ts';
import { payloadDelPortal } from './consulta.ts';
import { abrirMesaDesdeQR } from './mesa.ts';
import { enviarPedidoDesdeQR } from './pedido.ts';
import { crearSolicitudQR } from './solicitudes.ts';

/**
 * DP-22 · EL EFECTO DE LOS AJUSTES DEL PORTAL QUE EL SERVIDOR DECIDE, contra Postgres real.
 *
 * Cada prueba cambia UNA casilla de «Portal de comensales» en la configuración del negocio y mira,
 * en lo que el comensal recibe de verdad (`payloadDelPortal`) o en lo que el servidor acepta
 * (`portal.crear_solicitud`), que pasa lo que la casilla promete — y que con la casilla en su valor
 * por omisión NO pasa. Lo que la pantalla del teléfono hace con esos valores (esconder el botón,
 * pintar el mensaje) lo cubre `pruebas/e2e/qa-final/ajustes.portal.spec.ts`.
 */

const PIMIENTA = 'pimienta-de-la-prueba-ajustes-del-portal-0123456789';

type Parche = Readonly<Record<string, unknown>>;

async function fijar(organizacionId: string, parche: Parche): Promise<void> {
  await conTransaccion(async (tx) => {
    await sql`
      insert into configuracion (organizacion_id, valores)
      values (${organizacionId}, ${JSON.stringify(parche)}::jsonb)
      on conflict (organizacion_id) do update set valores = configuracion.valores || excluded.valores
    `.execute(tx);
  });
}

interface Caso {
  readonly negocio: NegocioReal;
  readonly sucursalId: string;
  readonly ambito: ReturnType<typeof ambitoDe>;
  readonly productoId: string;
}

async function negocioDelPortal(): Promise<Caso> {
  const negocio = await sembrarNegocio({
    nombre: 'Fonda de los ajustes del portal',
    rol: 'dueno',
    giro: 'restaurante',
    paquete: 'restaurante',
  });
  const sucursal = await sembrarSucursal(negocio, { terminales: ['Caja'] });
  const ambito = ambitoDe(negocio, sucursal.sucursalId, sucursal.terminales[0] ?? null);
  const { productoId } = await sembrarProducto(negocio, sucursal.almacenId, {
    nombre: 'Taco de barbacoa',
    precioCentavos: 3_500n,
    existencia: '100',
  });
  await conTransaccion(async (tx) => {
    await tx
      .updateTable('productos')
      .set({ visible_en_menu_digital: true, area_preparacion: 'cocina' })
      .where('organizacion_id', '=', negocio.organizacionId)
      .execute();
  });
  await fijar(negocio.organizacionId, {
    portal_qr_activo: true,
    portal_qr_permitir_pedidos_cliente: true,
    portal_qr_envia_a_cocina: 'comensales',
    portal_qr_comensales_abren_mesa: true,
    asignacion_mesas_activa: false,
  });
  return { negocio, sucursalId: sucursal.sucursalId, ambito, productoId };
}

/** Una mesa con su QR propio: cada mesa tiene su propio tope de avisos. */
async function mesaNueva(caso: Caso, numero: number): Promise<string> {
  const mesaId = randomUUID();
  await conTransaccion(async (tx) => {
    await tx
      .insertInto('mesas')
      .values({
        id: mesaId,
        organizacion_id: caso.negocio.organizacionId,
        sucursal_id: caso.sucursalId,
        numero,
        nombre: `Mesa ${String(numero)}`,
      })
      .execute();
  });
  const { qrToken } = exigirOk(
    await comando(rotarQr, { entrada: { mesaId }, ambito: caso.ambito, idempotencyKey: clave() }),
    'restaurante.rotar_qr',
  );
  return qrToken;
}

function peticion(caso: Caso, token: string, entrada: unknown): PeticionPublica {
  return {
    token,
    organizacionId: caso.negocio.organizacionId,
    entrada,
    idempotencyKey: clave(),
    pimienta: PIMIENTA,
  };
}

async function abrirYPedir(caso: Caso, token: string): Promise<void> {
  exigirOk(
    await ejecutarComandoPublico(abrirMesaDesdeQR, peticion(caso, token, { personas: 2 })),
    'portal.abrir_mesa',
  );
  exigirOk(
    await ejecutarComandoPublico(
      enviarPedidoDesdeQR,
      peticion(caso, token, { items: [{ productoId: caso.productoId, cantidad: '2' }] }),
    ),
    'portal.enviar_pedido',
  );
}

const pendientesDe = async (organizacionId: string, tipo: string): Promise<number> =>
  (
    await obtenerDb()
      .selectFrom('solicitudes_qr')
      .select('id')
      .where('organizacion_id', '=', organizacionId)
      .where('tipo', '=', tipo)
      .execute()
  ).length;

describe('los botones de aviso del portal (permitir_ordenar, permitir_cuenta, permitir_ayuda)', () => {
  let caso: Caso;
  beforeAll(async () => {
    caso = await negocioDelPortal();
  });

  const AVISOS = [
    ['portal_qr_permitir_ordenar', 'ordenar'],
    ['portal_qr_permitir_cuenta', 'cuenta'],
    ['portal_qr_permitir_ayuda', 'ayuda'],
  ] as const;

  it.each(AVISOS)(
    '%s apagada: el portal no ofrece «%s» y el servidor tampoco lo acepta; encendida, sí',
    async (clavePortal, tipo) => {
      const token = await mesaNueva(caso, 20 + AVISOS.findIndex(([c]) => c === clavePortal));
      // La cuenta sólo se pide con la cuenta abierta: se abre y se pide un platillo.
      await abrirYPedir(caso, token);

      await fijar(caso.negocio.organizacionId, { [clavePortal]: false });
      const apagado = await payloadDelPortal(caso.negocio.organizacionId, token, PIMIENTA);
      expect(apagado.negocio[clavePortal]).toBe(false);
      const rechazo = await ejecutarComandoPublico(
        crearSolicitudQR,
        peticion(caso, token, { tipo }),
      );
      expect(rechazo.ok).toBe(false);
      if (!rechazo.ok) expect(rechazo.error.datos?.['regla']).toBe('QR_PORTAL_CERRADO');
      expect(await pendientesDe(caso.negocio.organizacionId, tipo)).toBe(0);

      await fijar(caso.negocio.organizacionId, { [clavePortal]: true });
      const encendido = await payloadDelPortal(caso.negocio.organizacionId, token, PIMIENTA);
      expect(encendido.negocio[clavePortal]).toBe(true);
      exigirOk(
        await ejecutarComandoPublico(crearSolicitudQR, peticion(caso, token, { tipo })),
        'portal.crear_solicitud',
      );
      expect(await pendientesDe(caso.negocio.organizacionId, tipo)).toBe(1);
    },
  );

  it('sin tocar nada, los tres avisos están permitidos', async () => {
    const otro = await negocioDelPortal();
    const token = await mesaNueva(otro, 31);
    const payload = await payloadDelPortal(otro.negocio.organizacionId, token, PIMIENTA);
    expect(payload.negocio.portal_qr_permitir_ordenar).toBe(true);
    expect(payload.negocio.portal_qr_permitir_cuenta).toBe(true);
    expect(payload.negocio.portal_qr_permitir_ayuda).toBe(true);
  });
});

describe('portal_qr_mostrar_precuenta', () => {
  it('apagada: el comensal no recibe ni renglones ni importes de su cuenta; encendida, los recibe', async () => {
    const caso = await negocioDelPortal();
    const token = await mesaNueva(caso, 40);
    await abrirYPedir(caso, token);

    await fijar(caso.negocio.organizacionId, { portal_qr_mostrar_precuenta: true });
    const con = await payloadDelPortal(caso.negocio.organizacionId, token, PIMIENTA);
    expect(con.cuenta?.lineas.length).toBeGreaterThan(0);
    expect(con.cuenta?.total).toBe(70);

    await fijar(caso.negocio.organizacionId, { portal_qr_mostrar_precuenta: false });
    const sin = await payloadDelPortal(caso.negocio.organizacionId, token, PIMIENTA);
    expect(sin.negocio.portal_qr_mostrar_precuenta).toBe(false);
    expect(sin.cuenta).not.toBeNull();
    expect(sin.cuenta?.lineas).toEqual([]);
    expect(sin.cuenta?.total).toBeNull();
    expect(sin.cuenta?.subtotal).toBeNull();
  });
});

describe('portal_qr_mensaje_bienvenida y portal_qr_mostrar_sin_imagen', () => {
  it('el mensaje del negocio llega al portal tal cual, y borrado, llega vacío', async () => {
    const caso = await negocioDelPortal();
    const token = await mesaNueva(caso, 50);
    await fijar(caso.negocio.organizacionId, {
      portal_qr_mensaje_bienvenida: 'Bienvenidos a la barbacoa de Don Poncho',
    });
    const con = await payloadDelPortal(caso.negocio.organizacionId, token, PIMIENTA);
    expect(con.negocio.portal_qr_mensaje_bienvenida).toBe(
      'Bienvenidos a la barbacoa de Don Poncho',
    );
    await fijar(caso.negocio.organizacionId, { portal_qr_mensaje_bienvenida: '' });
    const sin = await payloadDelPortal(caso.negocio.organizacionId, token, PIMIENTA);
    expect(sin.negocio.portal_qr_mensaje_bienvenida).toBe('');
  });

  it('la casilla «platillos sin foto» viaja al portal en los dos sentidos (sin elegir, encendida)', async () => {
    const caso = await negocioDelPortal();
    const token = await mesaNueva(caso, 51);
    const porOmision = await payloadDelPortal(caso.negocio.organizacionId, token, PIMIENTA);
    expect(porOmision.negocio.portal_qr_mostrar_sin_imagen).toBe(true);
    await fijar(caso.negocio.organizacionId, { portal_qr_mostrar_sin_imagen: false });
    const apagada = await payloadDelPortal(caso.negocio.organizacionId, token, PIMIENTA);
    expect(apagada.negocio.portal_qr_mostrar_sin_imagen).toBe(false);
  });
});
