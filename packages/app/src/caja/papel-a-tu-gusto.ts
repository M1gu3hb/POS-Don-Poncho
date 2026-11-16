import 'server-only';

import { PAQUETES_MOSTRADOR } from '@morphiqpos/contracts';
import type { Transaccion } from '@morphiqpos/data';
import {
  IDS_DE_CAMPOS,
  PAPELES_DE_VENTA,
  completarPapel,
  type PapelDeVenta,
  type PapelATuGusto,
} from '@morphiqpos/domain/venta';
import { z } from 'zod';

import { definirComando } from '../definicion.ts';
import { guardarConfiguracionParcial } from '../puente/configuracion.ts';

/**
 * «EL TICKET Y LA PRECUENTA A TU GUSTO» (DP-21 · Bloque 12 · M10).
 *
 * Qué renglones salen en la precuenta y en el ticket de venta (`@morphiqpos/domain/venta`,
 * `campos-del-papel.ts`). Lo cambian sólo el dueño o el administrador, por este comando, y queda en
 * la auditoría con su antes y su después. Vive en `configuracion.valores.papel_a_tu_gusto` (sin
 * columna, sin migración); el camino genérico de la configuración lo rechaza. El papel lo lee la
 * pantalla (`PreCuentaTicket`): la imagen ESC/POS sale de ese mismo HTML, así que respeta lo elegido
 * sin otro código.
 */

export const CLAVE_PAPEL_A_TU_GUSTO = 'papel_a_tu_gusto';

const deUnPapel = z.strictObject(
  Object.fromEntries(IDS_DE_CAMPOS.map((id) => [id, z.boolean()])) as Record<
    (typeof IDS_DE_CAMPOS)[number],
    z.ZodBoolean
  >,
);

/** Lo que se guarda: los dos papeles, con TODOS sus renglones. Estricto: un campo de más no entra. */
export const esquemaPapelATuGusto = z.strictObject({
  precuenta: deUnPapel,
  ticket: deUnPapel,
});

/** Lo que dice el documento; lo que falte o no se entienda sale (el papel de siempre). */
export function papelATuGustoEn(valores: unknown): PapelATuGusto {
  if (typeof valores !== 'object' || valores === null || Array.isArray(valores)) {
    return completarPapel(undefined);
  }
  const crudo = (valores as Record<string, unknown>)[CLAVE_PAPEL_A_TU_GUSTO];
  if (typeof crudo !== 'object' || crudo === null || Array.isArray(crudo)) {
    return completarPapel(undefined);
  }
  return completarPapel(crudo);
}

async function leerPapel(tx: Transaccion, organizacionId: string): Promise<PapelATuGusto> {
  const fila = await tx
    .selectFrom('configuracion')
    .select('valores')
    .where('organizacion_id', '=', organizacionId)
    .executeTakeFirst();
  return papelATuGustoEn(fila?.valores);
}

/** Qué renglones se apagaron (y cuáles se volvieron a encender) entre dos papeles: para la auditoría. */
export function cambiosDelPapel(
  antes: PapelATuGusto,
  despues: PapelATuGusto,
): { readonly apagados: readonly string[]; readonly encendidos: readonly string[] } {
  const apagados: string[] = [];
  const encendidos: string[] = [];
  for (const papel of PAPELES_DE_VENTA) {
    for (const campo of IDS_DE_CAMPOS) {
      if (antes[papel][campo] && !despues[papel][campo]) apagados.push(`${papel}.${campo}`);
      if (!antes[papel][campo] && despues[papel][campo]) encendidos.push(`${papel}.${campo}`);
    }
  }
  return { apagados, encendidos };
}

/**
 * Lo apagado de cada papel, por nombre. La auditoría saneada redacta por NOMBRE DE CLAVE y
 * «pro-PIN-a» lo contiene: guardar el papel como objeto de interruptores dejaría la propina en
 * «[redactado]». Como lista de nombres (valores, no claves) queda legible.
 */
export function apagadosDe(papel: PapelATuGusto): Record<PapelDeVenta, readonly string[]> {
  const de = (cual: PapelDeVenta): string[] => IDS_DE_CAMPOS.filter((campo) => !papel[cual][campo]);
  return { precuenta: de('precuenta'), ticket: de('ticket') };
}

export const entradaFijarPapelATuGusto = esquemaPapelATuGusto;

export const fijarPapelATuGusto = definirComando<
  Transaccion,
  typeof entradaFijarPapelATuGusto,
  PapelATuGusto
>({
  nombre: 'caja.fijar_papel_a_tu_gusto',
  entidad: 'configuracion',
  escribe: true,
  roles: ['dueno', 'administrador'],
  paquetes: PAQUETES_MOSTRADOR,
  entrada: entradaFijarPapelATuGusto,
  async ejecutar(ctx, entrada) {
    const { organizacionId } = ctx.ambito;
    const antes = await ctx.paso('leer', () => leerPapel(ctx.tx, organizacionId));
    await ctx.paso('guardar', () =>
      guardarConfiguracionParcial(
        ctx.tx,
        organizacionId,
        { [CLAVE_PAPEL_A_TU_GUSTO]: entrada },
        { desdeComando: true },
      ),
    );
    const { apagados, encendidos } = cambiosDelPapel(antes, entrada);
    ctx.auditar({
      entidadId: null,
      payload: {
        antes: { apagados: apagadosDe(antes) },
        despues: { apagados: apagadosDe(entrada) },
        apagados,
        encendidos,
      },
    });
    return entrada;
  },
});
