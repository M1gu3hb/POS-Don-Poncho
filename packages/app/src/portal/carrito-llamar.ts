import 'server-only';

import { ErrorDominio, PAQUETES_PORTAL } from '@morphiqpos/contracts';

import { candadoDelCarrito } from '../restaurante/carrito-del-salon.ts';
import { entradaDelTelefono, latir } from './carrito.ts';
import { definirComandoPublico } from './definicion-publica.ts';
import { exigirPedidosDesdeElTelefono } from './mesa.ts';
import { notaDelPedidoListo, platillosDelCarrito } from './quien-envia.ts';
import { insertarSolicitud, ordenActiva, ruteoDeLaMesa } from './solicitudes.ts';
import { huellaDelTelefono } from './telefono.ts';

/**
 * `portal.carrito_llamar_mesero` — «Llamar a mi mesero para confirmar» (DP-12.2).
 *
 * Con el carrito armado y sólo el mesero mandando a cocina, el comensal no envía: avisa. Es una
 * solicitud `ordenar` (los tipos los fija un `check` de la base) con la nota «Pedido listo para
 * confirmar (N platillos)», que el mesero ve como globo en su mapa y en «Solicitudes», con su voz.
 *
 * Una por mesa mientras esté pendiente (`solicitudes_qr_una_pendiente`): si ya la hay, se le
 * ACTUALIZA la nota con lo que hay ahora, en vez de contestar «ya avisamos» con la cuenta vieja.
 * También sirve con la mesa cerrada: el mesero la abre al llegar.
 */

export interface ResultadoDelLlamado {
  readonly solicitudId: string;
  readonly platillos: number;
  /** Ya estaba avisado: sólo se le puso al día la nota. */
  readonly yaAvisado: boolean;
}

export const llamarAlMeseroParaConfirmar = definirComandoPublico<
  typeof entradaDelTelefono,
  ResultadoDelLlamado
>({
  nombre: 'portal.carrito_llamar_mesero',
  entidad: 'solicitud_qr',
  accion: 'crear_solicitud',
  paquetes: PAQUETES_PORTAL,
  entrada: entradaDelTelefono,
  async ejecutar(ctx, entrada) {
    exigirPedidosDesdeElTelefono(ctx);
    // DP-13.3: antes de tocar nada, que el teléfono sea uno que el servidor firmó.
    const huella = huellaDelTelefono(ctx.pimienta, entrada.dispositivo);
    const { organizacionId, mesaId } = ctx.ambito;
    // DP-13.2: el candado del carrito, el mismo que el envío: llamar no se cruza con un envío ni con
    // el mesero vaciándolo.
    await ctx.paso('candado_del_carrito', () => candadoDelCarrito(ctx.tx, organizacionId, mesaId));

    const lineas = await ctx.tx
      .selectFrom('carrito_mesa_lineas')
      .select('cantidad')
      .where('organizacion_id', '=', organizacionId)
      .where('mesa_id', '=', mesaId)
      .execute();
    if (lineas.length === 0) {
      throw new ErrorDominio(
        'QR_CARRITO_VACIO',
        'Agrega algo al pedido antes de llamar a tu mesero.',
      );
    }
    const platillos = platillosDelCarrito(lineas.map((l) => l.cantidad));
    const notas = notaDelPedidoListo(platillos);

    const pendiente = await ctx.tx
      .selectFrom('solicitudes_qr')
      .select('id')
      .where('organizacion_id', '=', organizacionId)
      .where('mesa_id', '=', mesaId)
      .where('tipo', '=', 'ordenar')
      .where('estado', '=', 'pendiente')
      .forUpdate()
      .executeTakeFirst();

    // DP-13.2 · «Volver a llamar» RENUEVA el aviso: el que esperaba se resuelve y llega uno nuevo,
    // con su nota al día. Las pantallas anuncian (y dicen en voz) cada aviso nuevo una vez; poner
    // al día la nota del viejo no volvía a sonar. Una sola pendiente por mesa y tipo, como manda
    // `solicitudes_qr_una_pendiente`: primero se resuelve, luego se inserta.
    if (pendiente !== undefined) {
      await ctx.paso('renovar_el_aviso', () =>
        ctx.tx
          .updateTable('solicitudes_qr')
          .set({ estado: 'resuelta', resuelta_en: ctx.ahora, updated_at: ctx.ahora })
          .where('organizacion_id', '=', organizacionId)
          .where('id', '=', pendiente.id)
          .execute(),
      );
    }
    const solicitudId = await ctx.paso('crear_solicitud', async () =>
      insertarSolicitud(ctx, {
        tipo: 'ordenar',
        ordenId: await ordenActiva(ctx),
        ruteo: ruteoDeLaMesa(ctx),
        notas,
      }),
    );
    await latir(ctx.tx, ctx.ambito, huella, ctx.ahora);

    ctx.auditar({
      entidadId: solicitudId,
      payload: { platillos, yaAvisado: pendiente !== undefined },
    });
    return { solicitudId, platillos, yaAvisado: pendiente !== undefined };
  },
});
