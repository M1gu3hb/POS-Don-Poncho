import 'server-only';

import { ErrorDominio, PAQUETES_TODOS } from '@morphiqpos/contracts';
import type { Transaccion } from '@morphiqpos/data';
import { sql } from 'kysely';
import { z } from 'zod';

import { definirComando } from '../comando.ts';
import { CLAVE_DE_OPERACION_DESDE } from '../configuracion/folios-del-negocio.ts';
import { leerOperacionDesde } from '../configuracion/folios-leidos.ts';
import { guardarConfiguracionParcial } from '../puente/configuracion.ts';
import { exigirNombreDelNegocio } from './confirmacion.ts';
import type { ResultadoMantenimiento } from './comandos.ts';
import { exigirPlataforma } from './plataforma.ts';

/**
 * H1 · EL BLOQUEO DESPUÉS DEL ARRANQUE (DP-21 · Bloque 6).
 *
 * Mientras Don Poncho prueba, dejar el sistema en ceros es parte del trabajo. El día que opera de
 * verdad deja de serlo: lo cobrado ya no se borra, ni por un descuido ni por un guion mal
 * apuntado. Ese día se marca con `configuracion.valores.operacion_desde` (la hora del SERVIDOR, no
 * una que mande un cliente):
 *
 *   · `mantenimiento.activar_operacion` la escribe (dueño de plataforma, idempotente: si ya
 *     estaba, no la mueve). Se corre en la parte final, después de dejar en ceros.
 *   · `exigirQueNoHayaOperacionReal` la consultan quienes borran ventas o cortes o reinician
 *     folios (y el cambio del «Primer folio»): se niegan si hay UNA sola cuenta creada después.
 *   · `mantenimiento.quitar_bloqueo_de_operacion` la quita: sólo el dueño, escribiendo el nombre
 *     del negocio, y la auditoría guarda la fecha que tenía.
 *
 * Sin `operacion_desde`, todo funciona como antes. Ninguno de los dos comandos tiene ruta HTTP: los
 * corre un guion del servidor (`scripts/operacion-real.mjs`).
 */

const SOLO_DUENO = ['dueno'] as const;

/** Cuántas cuentas hay creadas después de `desde`, y la zona del negocio para decir la fecha. */
async function cuentasPosteriores(
  tx: Transaccion,
  organizacionId: string,
  desde: Date,
): Promise<{ readonly cuentas: number; readonly zona: string }> {
  const r = await sql<{ n: number; zona: string }>`
    select (select count(*) from ordenes
             where organizacion_id = ${organizacionId} and created_at > ${desde})::int n,
           coalesce((select zona_horaria from organizaciones where id = ${organizacionId}),
                    'America/Mexico_City') zona
  `.execute(tx);
  return { cuentas: r.rows[0]?.n ?? 0, zona: r.rows[0]?.zona ?? 'America/Mexico_City' };
}

function fechaParaLeer(fecha: Date, zona: string): string {
  return new Intl.DateTimeFormat('es-MX', {
    timeZone: zona,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(fecha);
}

/**
 * Se niega si el negocio ya opera (hay `operacion_desde`) y existe al menos una cuenta creada
 * DESPUÉS de esa fecha. Sin `operacion_desde`, o con cero cuentas posteriores, no hace nada.
 */
export async function exigirQueNoHayaOperacionReal(
  tx: Transaccion,
  organizacionId: string,
  ahora: Date,
): Promise<void> {
  const desde = await leerOperacionDesde(tx, organizacionId);
  if (desde === null || desde.getTime() > ahora.getTime()) return;
  const { cuentas, zona } = await cuentasPosteriores(tx, organizacionId, desde);
  if (cuentas === 0) return;
  const reales = cuentas === 1 ? 'hay 1 cuenta real' : `hay ${String(cuentas)} cuentas reales`;
  throw new ErrorDominio(
    'CONFIGURACION_CONFLICTO',
    `Este negocio ya opera desde el ${fechaParaLeer(desde, zona)}: ${reales}. Lo cobrado ya no se borra.`,
  );
}

export interface ResultadoDeOperacion {
  readonly desde: string | null;
  readonly yaEstaba: boolean;
}

const entradaVacia = z.object({});

export const activarOperacion = definirComando<
  Transaccion,
  typeof entradaVacia,
  ResultadoDeOperacion
>({
  nombre: 'mantenimiento.activar_operacion',
  entidad: 'organizacion',
  escribe: true,
  roles: SOLO_DUENO,
  paquetes: PAQUETES_TODOS,
  entrada: entradaVacia,
  async ejecutar(ctx) {
    await exigirPlataforma(ctx.tx, ctx.ambito);
    const org = ctx.ambito.organizacionId;
    const actual = await ctx.paso('leer', () => leerOperacionDesde(ctx.tx, org));
    if (actual !== null) {
      ctx.auditar({ entidadId: org, payload: { yaEstaba: true, desde: actual.toISOString() } });
      return { desde: actual.toISOString(), yaEstaba: true };
    }
    const desde = ctx.ahora.toISOString();
    await ctx.paso('guardar', () =>
      guardarConfiguracionParcial(
        ctx.tx,
        org,
        { [CLAVE_DE_OPERACION_DESDE]: desde },
        { desdeComando: true },
      ),
    );
    ctx.auditar({ entidadId: org, payload: { yaEstaba: false, desde } });
    return { desde, yaEstaba: false };
  },
});

export const entradaQuitarBloqueo = z.object({
  confirmacionNombreNegocio: z.string().trim().min(1).max(200),
});

export const quitarBloqueoDeOperacion = definirComando<
  Transaccion,
  typeof entradaQuitarBloqueo,
  ResultadoMantenimiento & { readonly teniaDesde: string | null }
>({
  nombre: 'mantenimiento.quitar_bloqueo_de_operacion',
  entidad: 'organizacion',
  escribe: true,
  roles: SOLO_DUENO,
  paquetes: PAQUETES_TODOS,
  entrada: entradaQuitarBloqueo,
  async ejecutar(ctx, entrada) {
    const org = ctx.ambito.organizacionId;
    const negocio = await exigirNombreDelNegocio(ctx.tx, org, entrada.confirmacionNombreNegocio);
    const tenia = await ctx.paso('leer', () => leerOperacionDesde(ctx.tx, org));
    if (tenia !== null) {
      await ctx.paso('quitar', () =>
        guardarConfiguracionParcial(
          ctx.tx,
          org,
          { [CLAVE_DE_OPERACION_DESDE]: null },
          { desdeComando: true },
        ),
      );
    }
    const teniaDesde = tenia === null ? null : tenia.toISOString();
    ctx.auditar({ entidadId: org, payload: { teniaDesde } });
    return { negocio, borrado: {}, teniaDesde };
  },
});
