import 'server-only';

import { ErrorDominio, PAQUETES_TODOS, type Ambito } from '@morphiqpos/contracts';
import { obtenerDb, type Transaccion } from '@morphiqpos/data';
import { sql } from 'kysely';
import { z } from 'zod';

import { definirComando } from '../comando.ts';
import {
  leerDocumentoConCandado,
  type DocumentoDeConfiguracion,
} from '../configuracion/documento-con-candado.ts';
import { Rechazo } from '../fallos.ts';

/**
 * EL USUARIO DE PLATAFORMA (DP-12.1, decisión de Miguel del 1-11-2026).
 *
 * «Miguel · Morphiq» entra con un empleo de DUEÑO, igual que el dueño del restaurante: los siete
 * roles de `empleos.rol` los fija un `check` de la base y uno nuevo pediría una migración. Lo que
 * lo distingue es una marca en `configuracion.valores.plataforma` con los empleos de plataforma
 * del negocio:
 *
 *   · NO se lee ni se escribe por el camino genérico de Configuración (`NUNCA_SALEN` en
 *     `puente/configuracion.ts`): el dueño no se la puede poner.
 *   · La escribe `mantenimiento.marcar_plataforma`, que marca el empleo DE QUIEN LO EJECUTA y no
 *     tiene ruta HTTP (un contrato lo vigila): sólo lo corre un guion del servidor con acceso a la
 *     base (`scripts/marcar-plataforma.mjs`), que es por definición de plataforma. La quita o la
 *     pasa a otro `mantenimiento.quitar_plataforma` (`plataforma-cambios.ts`), también sin ruta
 *     HTTP y sólo para quien ya es de plataforma.
 *   · Viaja con las filas del negocio en la mudanza (Fase B y C) sin configurar nada más.
 *   · DP-13.3b: sólo vale para un empleo ACTIVO. Desactivar un empleo le quita la marca en la misma
 *     transacción, y aunque la marca siguiera escrita (SQL suelto, una importación) la lectura y
 *     la exigencia fallan cerradas con un empleo inactivo.
 *
 * Los cinco comandos de mantenimiento que borran en masa la exigen además del rol (`exigirPlataforma`),
 * y la sesión la dice (`es_plataforma`) para que las pantallas sólo enseñen sus botones a quien sí.
 */
export const CLAVE_DE_PLATAFORMA = 'plataforma';

/** Cuántos empleos de plataforma caben: más y la marca entera dejaría de leerse (falla cerrada). */
export const MAXIMO_DE_PLATAFORMA = 20;

const PLATAFORMA = z.object({ empleos: z.array(z.uuid()).max(MAXIMO_DE_PLATAFORMA) });

/** Los empleos de plataforma de un documento de configuración; cualquier otra forma, ninguno. */
export function empleosDePlataforma(valores: unknown): readonly string[] {
  if (typeof valores !== 'object' || valores === null || Array.isArray(valores)) return [];
  const leido = PLATAFORMA.safeParse((valores as Record<string, unknown>)[CLAVE_DE_PLATAFORMA]);
  return leido.success ? leido.data.empleos : [];
}

/**
 * ¿Este empleo es de plataforma HOY? Marcado en el documento Y activo, en una sola lectura.
 * Un empleo que no existe en este negocio, o está desactivado, no lo es.
 */
async function esDePlataformaVigente(
  db: Transaccion | ReturnType<typeof obtenerDb>,
  organizacionId: string,
  empleoId: string,
): Promise<boolean> {
  const fila = await db
    .selectFrom('empleos as e')
    .leftJoin('configuracion as c', 'c.organizacion_id', 'e.organizacion_id')
    .select(['e.activo as activo', 'c.valores as valores'])
    .where('e.id', '=', empleoId)
    .where('e.organizacion_id', '=', organizacionId)
    .executeTakeFirst();
  return fila?.activo === true && empleosDePlataforma(fila.valores).includes(empleoId);
}

/** ¿Este empleo es de plataforma en este negocio? Para la sesión (fuera de transacción). */
export function leerEsDePlataforma(organizacionId: string, empleoId: string): Promise<boolean> {
  return esDePlataformaVigente(obtenerDb(), organizacionId, empleoId);
}

/**
 * Dentro de la transacción del comando, antes de leer o borrar nada: si quien llama no es de
 * plataforma, 403 `SIN_PERMISO` con su rastro de «denegado», como un rol que no alcanza.
 */
export async function exigirPlataforma(tx: Transaccion, ambito: Ambito): Promise<void> {
  if (!(await esDePlataformaVigente(tx, ambito.organizacionId, ambito.empleoId))) {
    throw new Rechazo('SIN_PERMISO', 'denegado', {
      codigo: 'SIN_PERMISO',
      mensaje: 'Esto sólo lo hace el usuario de plataforma de Morphiq.',
    });
  }
}

/**
 * Escribe la lista de plataforma SIN tocar ninguna otra clave del documento (`valores || …`).
 * `documento` es el que se leyó con candado (`leerDocumentoConCandado`): quien llama ya tiene la
 * fila tomada, así que la lista que recibe parte de lo último que se confirmó.
 */
export async function guardarEmpleosDePlataforma(
  tx: Transaccion,
  organizacionId: string,
  documento: DocumentoDeConfiguracion | undefined,
  empleos: readonly string[],
  ahora: Date,
): Promise<void> {
  if (empleos.length > MAXIMO_DE_PLATAFORMA) {
    throw new ErrorDominio(
      'CONFIGURACION_INVALIDA',
      `Caben ${String(MAXIMO_DE_PLATAFORMA)} usuarios de plataforma como máximo.`,
    );
  }
  const marca = JSON.stringify({ empleos });
  if (documento === undefined) {
    await tx
      .insertInto('configuracion')
      .values({
        organizacion_id: organizacionId,
        valores: sql`jsonb_build_object(${CLAVE_DE_PLATAFORMA}::text, ${marca}::jsonb)`,
        version: 1,
      })
      .execute();
    return;
  }
  await tx
    .updateTable('configuracion')
    .set({
      valores: sql`configuracion.valores || jsonb_build_object(${CLAVE_DE_PLATAFORMA}::text, ${marca}::jsonb)`,
      version: sql`configuracion.version + 1`,
      updated_at: ahora,
    })
    .where('id', '=', documento.id)
    .execute();
}

export interface ResultadoMarcarPlataforma {
  readonly empleoId: string;
  readonly yaLoEra: boolean;
}

/**
 * `mantenimiento.marcar_plataforma`: el empleo de QUIEN LO EJECUTA queda como de plataforma.
 * Idempotente (dos veces, la misma lista) y con candado sobre la fila de configuración, como el
 * guardado de siempre. SIN RUTA HTTP: un dueño que pudiera llamarlo se marcaría a sí mismo.
 */
export const marcarPlataforma = definirComando<
  Transaccion,
  z.ZodObject<Record<string, never>>,
  ResultadoMarcarPlataforma
>({
  nombre: 'mantenimiento.marcar_plataforma',
  entidad: 'organizacion',
  escribe: true,
  roles: ['dueno'],
  paquetes: PAQUETES_TODOS,
  entrada: z.object({}),
  async ejecutar(ctx) {
    const { organizacionId, empleoId } = ctx.ambito;
    const actual = await leerDocumentoConCandado(ctx.tx, organizacionId);
    const empleos = empleosDePlataforma(actual?.valores ?? null);
    const yaLoEra = empleos.includes(empleoId);
    if (!yaLoEra) {
      await ctx.paso('marcar', () =>
        guardarEmpleosDePlataforma(
          ctx.tx,
          organizacionId,
          actual,
          [...empleos, empleoId],
          ctx.ahora,
        ),
      );
    }
    ctx.auditar({ entidadId: organizacionId, payload: { empleoId, yaLoEra } });
    return { empleoId, yaLoEra };
  },
});
