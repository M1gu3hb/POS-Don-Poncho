import 'server-only';

import { ErrorDominio, PAQUETES_MOSTRADOR } from '@morphiqpos/contracts';
import { repoCaja, type Transaccion } from '@morphiqpos/data';
import { z } from 'zod';

import { definirComando } from '../definicion.ts';

/**
 * «CAJAS ABIERTAS A LA VEZ», 1 O 2 (DP-14.2, decisión DP-D60).
 *
 * El cupo ya existía en la base (`sucursales.cajas_simultaneas`, la 179, con su disparador que lo
 * hace cumplir al abrir) y ninguna pantalla lo escribía: el restaurante quedaba en una. Miguel
 * decidió que Don Poncho puede tener DOS cajas abiertas, nunca más: aquí se escribe el dato —sin
 * DDL—, sólo el dueño o el administrador, para la sucursal de la sesión y con su entrada en la
 * auditoría. Bajar a una con dos abiertas no se deja: el cupo nuevo dejaría una caja abierta por
 * encima de él, y la salida (cerrar una) se dice.
 */

/** El tope de Don Poncho: la base acepta hasta cuatro (179), el negocio decidió dos. */
export const MAXIMO_DE_CAJAS = 2;

export const entradaFijarCajasSimultaneas = z.object({
  cajas: z.number().int().min(1).max(MAXIMO_DE_CAJAS),
});

export const entradaCajasSimultaneas = z.object({});

export interface CajasALaVez {
  readonly cajas: number;
  readonly abiertas: number;
}

const QUIEN_DECIDE = ['dueno', 'administrador'] as const;
const QUIEN_LEE = ['cajero', 'gerente', 'administrador', 'dueno'] as const;

function sucursalDe(sucursalId: string | null): string {
  if (sucursalId === null) {
    throw new ErrorDominio(
      'VENTA_SIN_TERMINAL',
      'Entra desde una sucursal para ver o cambiar sus cajas.',
    );
  }
  return sucursalId;
}

async function leerCupo(
  tx: Transaccion,
  organizacionId: string,
  sucursalId: string,
): Promise<CajasALaVez> {
  const { cupo, abiertas } = await repoCaja.cupoDeCajas(tx, organizacionId, sucursalId);
  return { cajas: cupo, abiertas: abiertas.length };
}

export const fijarCajasSimultaneas = definirComando<
  Transaccion,
  typeof entradaFijarCajasSimultaneas,
  CajasALaVez
>({
  nombre: 'caja.fijar_cajas_simultaneas',
  entidad: 'sucursal',
  escribe: true,
  roles: [...QUIEN_DECIDE],
  paquetes: PAQUETES_MOSTRADOR,
  entrada: entradaFijarCajasSimultaneas,
  async ejecutar(ctx, entrada) {
    const { organizacionId } = ctx.ambito;
    const sucursalId = sucursalDe(ctx.ambito.sucursalId);
    // La fila de la sucursal, con candado: es la misma que bloquea el disparador de la 179 al
    // abrir una caja, así que una apertura simultánea espera a este cambio (o éste a ella).
    await ctx.paso('bloquear_sucursal', () =>
      ctx.tx
        .selectFrom('sucursales')
        .select('id')
        .where('organizacion_id', '=', organizacionId)
        .where('id', '=', sucursalId)
        .forUpdate()
        .executeTakeFirstOrThrow(),
    );
    const antes = await ctx.paso('leer_cupo', () => leerCupo(ctx.tx, organizacionId, sucursalId));
    if (antes.abiertas > entrada.cajas) {
      throw new ErrorDominio(
        'CONFIGURACION_INVALIDA',
        `Hay ${String(antes.abiertas)} cajas abiertas: cierra una antes de dejar ${String(entrada.cajas)}.`,
        { abiertas: antes.abiertas },
      );
    }
    await ctx.paso('escribir_cupo', () =>
      ctx.tx
        .updateTable('sucursales')
        .set({ cajas_simultaneas: entrada.cajas })
        .where('organizacion_id', '=', organizacionId)
        .where('id', '=', sucursalId)
        .execute(),
    );
    ctx.auditar({
      entidadId: sucursalId,
      payload: { antes: antes.cajas, despues: entrada.cajas },
    });
    return { cajas: entrada.cajas, abiertas: antes.abiertas };
  },
});

/** Lo que enseña Configuración → Caja: el cupo de la sucursal y cuántas hay abiertas. */
export const cajasSimultaneas = definirComando<
  Transaccion,
  typeof entradaCajasSimultaneas,
  CajasALaVez
>({
  nombre: 'caja.cajas_simultaneas',
  entidad: 'sucursal',
  escribe: false,
  roles: [...QUIEN_LEE],
  paquetes: PAQUETES_MOSTRADOR,
  entrada: entradaCajasSimultaneas,
  async ejecutar(ctx) {
    const sucursalId = sucursalDe(ctx.ambito.sucursalId);
    return ctx.paso('leer_cupo', () => leerCupo(ctx.tx, ctx.ambito.organizacionId, sucursalId));
  },
});
