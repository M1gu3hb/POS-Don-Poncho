import 'server-only';

import { ErrorDominio, PAQUETES_MOSTRADOR } from '@morphiqpos/contracts';
import type { Transaccion } from '@morphiqpos/data';
import { sql } from 'kysely';
import { z } from 'zod';

import { definirComando } from '../definicion.ts';

/**
 * EL CAJÓN QUE SE ABRE AL COBRAR TAMBIÉN QUEDA EN LA AUDITORÍA (DP-20 · Parte 3.4) Y EXIGE UN
 * COBRO EN EFECTIVO (DP-21 · Bloque 7 · X2).
 *
 * El cajón lo abre la app del aparato (un pulso a la impresora); el servidor no lo ve. La
 * apertura SIN venta ya tenía su comando (`caja.abrir_cajon`: exige la caja abierta de esa
 * terminal y, desde el Bloque 7, el PIN de un supervisor). Éste es el de la que se dispara sola al
 * cobrar, y por no pedir PIN no puede ser un sello que cualquiera pone: la orden que llega tiene
 * que tener un pago en EFECTIVO hecho en ESTA terminal en los últimos 2 minutos, y cada cobro
 * abre el cajón UNA sola vez (el reintento con la misma clave de idempotencia ni siquiera llega
 * aquí: recibe la respuesta de la primera). Sin migración: va en la auditoría que ya existe.
 */

export const QUIEN_COBRA = ['cajero', 'gerente', 'administrador', 'dueno'] as const;

/** Cuánto vale un cobro para abrir el cajón: la apertura sigue al cobro, no lo precede ni lo sigue de lejos. */
export const VENTANA_DEL_COBRO_MS = 2 * 60 * 1000;

export const entradaCajonPorCobro = z.object({
  /** La orden que se acaba de cobrar: de ella se comprueba el pago en efectivo. */
  ordenId: z.uuid(),
  /** Lo que se cobró («12»), para leerlo en la auditoría. Sólo texto: no decide nada. */
  referencia: z.string().trim().min(1).max(40).optional(),
});

export interface ResultadoCajonPorCobro {
  readonly registrado: true;
  readonly cuando: string;
}

export const SIN_EFECTIVO =
  'El cajón se abre solo al cobrar en efectivo en esta terminal. Este cobro no lo permite; usa «Abrir cajón».';
export const YA_ABRIO_EL_CAJON = 'Ese cobro ya abrió el cajón una vez.';

export const cajonPorCobro = definirComando<
  Transaccion,
  typeof entradaCajonPorCobro,
  ResultadoCajonPorCobro
>({
  nombre: 'caja.cajon_por_cobro',
  entidad: 'sesion_caja',
  escribe: true,
  roles: [...QUIEN_COBRA],
  paquetes: PAQUETES_MOSTRADOR,
  // La orden tiene que ser de la sucursal de esta terminal: no se abre el cajón por un cobro ajeno.
  sucursal: { ordenId: 'ordenes' },
  entrada: entradaCajonPorCobro,
  async ejecutar(ctx, entrada) {
    const { organizacionId, terminalId } = ctx.ambito;
    // Dos llamadas a la vez con claves distintas: la segunda espera a que la primera confirme y
    // entonces ve su rastro.
    await ctx.paso('candado_del_cobro', () =>
      sql`select pg_advisory_xact_lock(hashtextextended(${`cajon-por-cobro:${organizacionId}:${entrada.ordenId}`}, 0))`.execute(
        ctx.tx,
      ),
    );

    const desde = new Date(ctx.ahora.getTime() - VENTANA_DEL_COBRO_MS);
    const pago = await ctx.paso('buscar_el_pago_en_efectivo', () =>
      ctx.tx
        .selectFrom('pagos as p')
        .innerJoin('sesiones_caja as s', 's.id', 'p.sesion_caja_id')
        .select('p.id')
        .where('p.organizacion_id', '=', organizacionId)
        .where('p.orden_id', '=', entrada.ordenId)
        .where('p.metodo', '=', 'efectivo')
        .where('p.estado', '=', 'confirmado')
        .where('p.created_at', '>=', desde)
        .where('s.terminal_id', '=', terminalId)
        .executeTakeFirst(),
    );
    if (pago === undefined) {
      throw new ErrorDominio('MOVIMIENTO_NO_PERMITIDO', SIN_EFECTIVO);
    }

    const previa = await ctx.paso('buscar_la_apertura_previa', () =>
      ctx.tx
        .selectFrom('auditoria')
        .select('id')
        .where('organizacion_id', '=', organizacionId)
        .where('accion', '=', 'caja.cajon_por_cobro')
        .where(sql<string>`payload ->> 'ordenId'`, '=', entrada.ordenId)
        .executeTakeFirst(),
    );
    if (previa !== undefined) {
      throw new ErrorDominio('MOVIMIENTO_NO_PERMITIDO', YA_ABRIO_EL_CAJON);
    }

    ctx.auditar({
      entidadId: null,
      payload: {
        motivo: 'cobro',
        ordenId: entrada.ordenId,
        ...(entrada.referencia === undefined ? {} : { referencia: entrada.referencia }),
      },
    });
    return { registrado: true, cuando: ctx.ahora.toISOString() };
  },
});
