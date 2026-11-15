import 'server-only';

import { ErrorDominio, PAQUETES_MOSTRADOR } from '@morphiqpos/contracts';
import { repoOrdenes, type Transaccion } from '@morphiqpos/data';
import { sql } from 'kysely';

import { definirComando } from '../definicion.ts';
import { entradaTicket } from './esquemas.ts';

/**
 * CADA TICKET QUE SALE QUEDA REGISTRADO, Y DESDE EL SEGUNDO DICE «REIMPRESIÓN» (DP-20 · refuerzo §3).
 *
 * «Reimprimir» siempre está disponible, sin bloqueo. Pero un ticket viejo no se debe poder
 * reusar: la pantalla pide este comando antes de mandar el papel; el servidor cuenta cuántas
 * veces salió ya ESA venta y contesta si ésta es la original (la primera) o una reimpresión, con
 * la fecha y la hora del servidor que el papel lleva impresas. Cada salida queda en la auditoría
 * (quién y cuándo). Sin migración: la cuenta se lee de la auditoría misma.
 *
 * El reintento de un trabajo que falló (sin papel, tapa abierta) manda la MISMA clave de
 * idempotencia: recibe la misma respuesta y no cuenta como otra salida.
 */

const NOMBRE = 'venta.registrar_impresion';
const ROLES_QUE_IMPRIMEN = ['cajero', 'mesero', 'gerente', 'administrador', 'dueno'] as const;

/** Holgura hacia atrás al buscar salidas anteriores: los relojes y una venta reabierta. */
const HOLGURA_MS = 24 * 60 * 60 * 1000;

export interface ResultadoRegistrarImpresion {
  /** 1 es la original; de 2 en adelante el papel va marcado «REIMPRESIÓN». */
  readonly numero: number;
  readonly reimpresion: boolean;
  /** La hora del servidor: la que se imprime en la marca. */
  readonly impresoEn: string;
}

export const registrarImpresion = definirComando<
  Transaccion,
  typeof entradaTicket,
  ResultadoRegistrarImpresion
>({
  nombre: NOMBRE,
  entidad: 'orden',
  escribe: true,
  roles: [...ROLES_QUE_IMPRIMEN],
  paquetes: PAQUETES_MOSTRADOR,
  sucursal: { ordenId: 'ordenes' },
  entrada: entradaTicket,
  async ejecutar(ctx, entrada) {
    const { organizacionId } = ctx.ambito;
    const orden = await ctx.paso('cargar_orden', () =>
      repoOrdenes.ordenParaTicket(ctx.tx, organizacionId, entrada.ordenId),
    );
    if (orden === null) throw new ErrorDominio('ORDEN_NO_ENCONTRADA', 'Esa venta no existe.');

    // Dos toques a la vez sobre la misma venta se ponen en fila: sólo uno es «la original».
    await sql`select pg_advisory_xact_lock(hashtextextended(${`impresion:${organizacionId}:${entrada.ordenId}`}, 0))`.execute(
      ctx.tx,
    );
    const desde = new Date(orden.createdAt.getTime() - HOLGURA_MS);
    const previas = await ctx.paso('contar', () =>
      ctx.tx
        .selectFrom('auditoria')
        .select((eb) => eb.fn.countAll<string>().as('salidas'))
        .where('organizacion_id', '=', organizacionId)
        .where('accion', '=', NOMBRE)
        .where('created_at', '>=', desde)
        .where('entidad_id', '=', entrada.ordenId)
        .executeTakeFirstOrThrow(),
    );
    const numero = Number(previas.salidas) + 1;
    const reimpresion = numero > 1;
    ctx.auditar({
      entidadId: entrada.ordenId,
      payload: {
        folio: orden.folio === null ? null : `${orden.serie}-${orden.folio.toString()}`,
        numero,
        reimpresion,
      },
    });
    return { numero, reimpresion, impresoEn: ctx.ahora.toISOString() };
  },
});
