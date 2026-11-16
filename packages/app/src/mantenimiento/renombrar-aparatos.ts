import 'server-only';

import { PAQUETES_TODOS } from '@morphiqpos/contracts';
import type { Transaccion } from '@morphiqpos/data';
import { sql } from 'kysely';
import { z } from 'zod';

import { definirComando } from '../comando.ts';
import { exigirNombreDelNegocio } from './confirmacion.ts';
import { exigirPlataforma } from './plataforma.ts';

/**
 * `mantenimiento.renombrar_aparatos` · LOS APARATOS DEJAN DE LLAMARSE «CAJA N» (DP-21 · Bloque 5).
 *
 * Hasta DP-21 cada navegador o aparato que entraba se daba de alta como «Caja N», y ése era el
 * nombre que veía la caja: en producción hay 35 terminales «Caja N». Desde DP-21 la caja es un
 * lugar de la sucursal con su nombre (`caja/lugares.ts`) y un aparato nuevo nace como «Aparato N».
 * Esto pone al día los que ya existían: «Caja 33» pasa a «Aparato 33».
 *
 * Sólo cambia el NOMBRE, nada más: ni el aparato, ni su cookie, ni sus sesiones, ni sus cortes.
 * Un aparato al que alguien ya le puso nombre («iMin mostrador») no se toca. Si «Aparato N» ya
 * existe en esa sucursal, ese aparato se deja como está y se cuenta en `omitidos`.
 *
 * Es un comando de mantenimiento y no una migración: deja quién lo corrió y cuántos cambió en la
 * auditoría. Lo ejecuta el dueño de plataforma, con el nombre del negocio como confirmación.
 */

export const entradaRenombrarAparatos = z.object({
  confirmacionNombreNegocio: z.string().trim().min(1).max(200),
});

export interface AparatosRenombrados {
  readonly negocio: string;
  readonly renombrados: number;
  /** Los «Caja N» que se quedaron así porque su «Aparato N» ya existía en la sucursal. */
  readonly omitidos: number;
}

export const renombrarAparatos = definirComando<
  Transaccion,
  typeof entradaRenombrarAparatos,
  AparatosRenombrados
>({
  nombre: 'mantenimiento.renombrar_aparatos',
  entidad: 'organizacion',
  escribe: true,
  roles: ['dueno'],
  paquetes: PAQUETES_TODOS,
  entrada: entradaRenombrarAparatos,
  async ejecutar(ctx, entrada) {
    await exigirPlataforma(ctx.tx, ctx.ambito);
    const org = ctx.ambito.organizacionId;
    const negocio = await exigirNombreDelNegocio(ctx.tx, org, entrada.confirmacionNombreNegocio);

    const renombrados = await ctx.paso('renombrar', async () => {
      const r = await sql<{ id: string }>`
        update terminales t
           set nombre = 'Aparato ' || substring(t.nombre from 6),
               updated_at = ${ctx.ahora}
         where t.organizacion_id = ${org}
           and t.nombre ~ '^Caja [0-9]+$'
           and not exists (
             select 1
               from terminales otra
              where otra.organizacion_id = t.organizacion_id
                and otra.sucursal_id = t.sucursal_id
                and otra.id <> t.id
                and lower(otra.nombre) = lower('Aparato ' || substring(t.nombre from 6))
           )
        returning t.id
      `.execute(ctx.tx);
      return r.rows.length;
    });
    const omitidos = await ctx.paso('contar_omitidos', async () => {
      const r = await sql<{ n: number }>`
        select count(*)::int n
          from terminales
         where organizacion_id = ${org}
           and nombre ~ '^Caja [0-9]+$'
      `.execute(ctx.tx);
      return r.rows[0]?.n ?? 0;
    });

    ctx.auditar({ entidadId: org, payload: { renombrados, omitidos } });
    return { negocio, renombrados, omitidos };
  },
});
