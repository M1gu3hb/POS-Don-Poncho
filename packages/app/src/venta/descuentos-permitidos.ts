import 'server-only';

import { ErrorDominio, PAQUETES_TODOS } from '@morphiqpos/contracts';
import type { Transaccion } from '@morphiqpos/data';
import { z } from 'zod';

import { definirComando } from '../definicion.ts';
import { guardarConfiguracionParcial } from '../puente/configuracion.ts';

/**
 * «PERMITIR DESCUENTOS» (DP-14.2, decisión DP-D61).
 *
 * Miguel decidió que los descuentos se puedan apagar: en Configuración → Descuentos, sí o no.
 * Apagados, ninguna pantalla enseña el botón y el SERVIDOR los rechaza con su propio código
 * (`DESCUENTOS_APAGADOS`), haya PIN o no: que la pantalla no ofrezca el botón no cuenta, el botón
 * se salta con la consola.
 *
 * Vive en `configuracion.valores` (sin columna, sin migración), bajo el mismo candado que el resto
 * del documento, y sólo se escribe por `configuracion.permitir_descuentos`: el dueño o el
 * administrador, con su entrada en la auditoría (antes y después). Sin escribir vale SÍ.
 */

export const CLAVE_DESCUENTOS_PERMITIDOS = 'descuentos_permitidos';

/** Lo que dice el documento de configuración. Sin el campo, o con algo que no es sí/no: SÍ. */
export function descuentosPermitidosEn(valores: unknown): boolean {
  if (typeof valores !== 'object' || valores === null || Array.isArray(valores)) return true;
  const valor = (valores as Record<string, unknown>)[CLAVE_DESCUENTOS_PERMITIDOS];
  return typeof valor === 'boolean' ? valor : true;
}

async function permitidosEnLaBase(tx: Transaccion, organizacionId: string): Promise<boolean> {
  const fila = await tx
    .selectFrom('configuracion')
    .select('valores')
    .where('organizacion_id', '=', organizacionId)
    .executeTakeFirst();
  return descuentosPermitidosEn(fila?.valores);
}

/** Lo exige cada comando que aplica un descuento, ANTES de leer la autorización. */
export async function exigirDescuentosPermitidos(
  tx: Transaccion,
  organizacionId: string,
): Promise<void> {
  if (await permitidosEnLaBase(tx, organizacionId)) return;
  throw new ErrorDominio(
    'DESCUENTOS_APAGADOS',
    'Los descuentos están apagados en este negocio: el dueño los enciende en Configuración → Descuentos.',
  );
}

export const entradaPermitirDescuentos = z.object({ permitir: z.boolean() });

/** Sólo el dueño o el administrador: el gerente autoriza descuentos, no decide si existen. */
const QUIEN_DECIDE = ['dueno', 'administrador'] as const;

export const permitirDescuentos = definirComando<
  Transaccion,
  typeof entradaPermitirDescuentos,
  { readonly permitir: boolean }
>({
  nombre: 'configuracion.permitir_descuentos',
  entidad: 'configuracion',
  escribe: true,
  roles: [...QUIEN_DECIDE],
  paquetes: PAQUETES_TODOS,
  entrada: entradaPermitirDescuentos,
  async ejecutar(ctx, entrada) {
    const { organizacionId } = ctx.ambito;
    const antes = await ctx.paso('leer', () => permitidosEnLaBase(ctx.tx, organizacionId));
    // El guardado parcial toma el documento con candado y lo escribe entero.
    await ctx.paso('guardar', () =>
      guardarConfiguracionParcial(
        ctx.tx,
        organizacionId,
        { [CLAVE_DESCUENTOS_PERMITIDOS]: entrada.permitir },
        { desdeComando: true },
      ),
    );
    ctx.auditar({ entidadId: null, payload: { antes, despues: entrada.permitir } });
    return { permitir: entrada.permitir };
  },
});
