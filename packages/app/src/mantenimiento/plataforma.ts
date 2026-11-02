import 'server-only';

import { PAQUETES_TODOS, type Ambito } from '@morphiqpos/contracts';
import { obtenerDb, type Transaccion } from '@morphiqpos/data';
import { sql } from 'kysely';
import { z } from 'zod';

import { definirComando } from '../comando.ts';
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
 *     base (`scripts/marcar-plataforma.mjs`), que es por definición de plataforma.
 *   · Viaja con las filas del negocio en la mudanza (Fase B y C) sin configurar nada más.
 *
 * Los cinco comandos de mantenimiento que borran en masa la exigen además del rol (`exigirPlataforma`),
 * y la sesión la dice (`es_plataforma`) para que las pantallas sólo enseñen sus botones a quien sí.
 */
export const CLAVE_DE_PLATAFORMA = 'plataforma';

const PLATAFORMA = z.object({ empleos: z.array(z.uuid()).max(20) });

/** Los empleos de plataforma de un documento de configuración; cualquier otra forma, ninguno. */
export function empleosDePlataforma(valores: unknown): readonly string[] {
  if (typeof valores !== 'object' || valores === null || Array.isArray(valores)) return [];
  const leido = PLATAFORMA.safeParse((valores as Record<string, unknown>)[CLAVE_DE_PLATAFORMA]);
  return leido.success ? leido.data.empleos : [];
}

async function valoresDe(
  db: Transaccion | ReturnType<typeof obtenerDb>,
  organizacionId: string,
): Promise<unknown> {
  const fila = await db
    .selectFrom('configuracion')
    .select('valores')
    .where('organizacion_id', '=', organizacionId)
    .executeTakeFirst();
  return fila?.valores ?? null;
}

/** ¿Este empleo es de plataforma en este negocio? Para la sesión (fuera de transacción). */
export async function leerEsDePlataforma(
  organizacionId: string,
  empleoId: string,
): Promise<boolean> {
  return empleosDePlataforma(await valoresDe(obtenerDb(), organizacionId)).includes(empleoId);
}

/**
 * Dentro de la transacción del comando, antes de leer o borrar nada: si quien llama no es de
 * plataforma, 403 `SIN_PERMISO` con su rastro de «denegado», como un rol que no alcanza.
 */
export async function exigirPlataforma(tx: Transaccion, ambito: Ambito): Promise<void> {
  const empleos = empleosDePlataforma(await valoresDe(tx, ambito.organizacionId));
  if (!empleos.includes(ambito.empleoId)) {
    throw new Rechazo('SIN_PERMISO', 'denegado', {
      codigo: 'SIN_PERMISO',
      mensaje: 'Esto sólo lo hace el usuario de plataforma de Morphiq.',
    });
  }
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
    const actual = await ctx.tx
      .selectFrom('configuracion')
      .select(['id', 'valores'])
      .where('organizacion_id', '=', organizacionId)
      .forUpdate()
      .executeTakeFirst();
    const empleos = empleosDePlataforma(actual?.valores ?? null);
    const yaLoEra = empleos.includes(empleoId);
    if (!yaLoEra) {
      const marca = JSON.stringify({ empleos: [...empleos, empleoId] });
      await ctx.paso('marcar', async () => {
        if (actual === undefined) {
          await ctx.tx
            .insertInto('configuracion')
            .values({
              organizacion_id: organizacionId,
              valores: sql`jsonb_build_object(${CLAVE_DE_PLATAFORMA}::text, ${marca}::jsonb)`,
              version: 1,
            })
            .execute();
          return;
        }
        await ctx.tx
          .updateTable('configuracion')
          .set({
            valores: sql`configuracion.valores || jsonb_build_object(${CLAVE_DE_PLATAFORMA}::text, ${marca}::jsonb)`,
            version: sql`configuracion.version + 1`,
            updated_at: ctx.ahora,
          })
          .where('id', '=', actual.id)
          .execute();
      });
    }
    ctx.auditar({ entidadId: organizacionId, payload: { empleoId, yaLoEra } });
    return { empleoId, yaLoEra };
  },
});
