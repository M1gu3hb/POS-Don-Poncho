import 'server-only';

import { ErrorDominio, PAQUETES_PORTAL } from '@morphiqpos/contracts';

import { entradaDelTelefono, huellaDelDispositivo, latir } from './carrito.ts';
import { definirComandoPublico } from './definicion-publica.ts';
import { exigirPedidosDesdeElTelefono } from './mesa.ts';
import { notaDelPedidoListo, platillosDelCarrito } from './quien-envia.ts';
import { insertarSolicitud, ordenActiva, ruteoDeLaMesa } from './solicitudes.ts';

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
    const { organizacionId, mesaId } = ctx.ambito;

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

    let solicitudId: string;
    if (pendiente === undefined) {
      solicitudId = await ctx.paso('crear_solicitud', async () =>
        insertarSolicitud(ctx, {
          tipo: 'ordenar',
          ordenId: await ordenActiva(ctx),
          ruteo: ruteoDeLaMesa(ctx),
          notas,
        }),
      );
    } else {
      solicitudId = pendiente.id;
      await ctx.paso('poner_al_dia_la_nota', () =>
        ctx.tx
          .updateTable('solicitudes_qr')
          .set({ notas, updated_at: ctx.ahora })
          .where('organizacion_id', '=', organizacionId)
          .where('id', '=', pendiente.id)
          .execute(),
      );
    }
    await latir(
      ctx.tx,
      ctx.ambito,
      huellaDelDispositivo(ctx.pimienta, entrada.dispositivo),
      ctx.ahora,
    );

    ctx.auditar({
      entidadId: solicitudId,
      payload: { platillos, yaAvisado: pendiente !== undefined },
    });
    return { solicitudId, platillos, yaAvisado: pendiente !== undefined };
  },
});
