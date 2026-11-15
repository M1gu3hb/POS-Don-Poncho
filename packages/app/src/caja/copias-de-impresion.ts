import 'server-only';

import { PAQUETES_MOSTRADOR } from '@morphiqpos/contracts';
import type { Transaccion } from '@morphiqpos/data';
import { z } from 'zod';

import { definirComando } from '../definicion.ts';
import { guardarConfiguracionParcial } from '../puente/configuracion.ts';

/**
 * «COPIAS DEL TICKET DE VENTA» (DP-20 · refuerzo §3).
 *
 * Cuántas copias salen del ticket, de la precuenta y del corte: de 1 a 3, 1 por omisión. Lo
 * cambian sólo el dueño o el administrador y queda en la auditoría, antes y después. Vive en
 * `configuracion.valores.copias_de_impresion` (sin columna, sin migración).
 */

export const CLAVE_COPIAS_DE_IMPRESION = 'copias_de_impresion';
export const COPIAS_MINIMAS = 1;
export const COPIAS_MAXIMAS = 3;

const cuantas = z.number().int().min(COPIAS_MINIMAS).max(COPIAS_MAXIMAS);

export const esquemaCopiasDeImpresion = z.object({
  ticket: cuantas,
  precuenta: cuantas,
  corte: cuantas,
});
export type CopiasDeImpresion = z.infer<typeof esquemaCopiasDeImpresion>;

export const COPIAS_POR_OMISION: CopiasDeImpresion = { ticket: 1, precuenta: 1, corte: 1 };

/** Lo que dice el documento; lo que falte o no se entienda vale 1. */
export function copiasDeImpresionEn(valores: unknown): CopiasDeImpresion {
  if (typeof valores !== 'object' || valores === null || Array.isArray(valores)) {
    return COPIAS_POR_OMISION;
  }
  const leidas = esquemaCopiasDeImpresion.safeParse(
    (valores as Record<string, unknown>)[CLAVE_COPIAS_DE_IMPRESION],
  );
  return leidas.success ? leidas.data : COPIAS_POR_OMISION;
}

async function leerCopias(tx: Transaccion, organizacionId: string): Promise<CopiasDeImpresion> {
  const fila = await tx
    .selectFrom('configuracion')
    .select('valores')
    .where('organizacion_id', '=', organizacionId)
    .executeTakeFirst();
  return copiasDeImpresionEn(fila?.valores);
}

export const entradaFijarCopiasDeImpresion = esquemaCopiasDeImpresion;

export const fijarCopiasDeImpresion = definirComando<
  Transaccion,
  typeof entradaFijarCopiasDeImpresion,
  CopiasDeImpresion
>({
  nombre: 'caja.fijar_copias_de_impresion',
  entidad: 'configuracion',
  escribe: true,
  roles: ['dueno', 'administrador'],
  paquetes: PAQUETES_MOSTRADOR,
  entrada: entradaFijarCopiasDeImpresion,
  async ejecutar(ctx, entrada) {
    const { organizacionId } = ctx.ambito;
    const antes = await ctx.paso('leer', () => leerCopias(ctx.tx, organizacionId));
    await ctx.paso('guardar', () =>
      guardarConfiguracionParcial(
        ctx.tx,
        organizacionId,
        { [CLAVE_COPIAS_DE_IMPRESION]: entrada },
        { desdeComando: true },
      ),
    );
    ctx.auditar({ entidadId: null, payload: { antes, despues: entrada } });
    return entrada;
  },
});
