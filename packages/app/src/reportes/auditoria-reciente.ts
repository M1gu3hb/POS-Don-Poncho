import 'server-only';

import { PAQUETES_TODOS } from '@morphiqpos/contracts';
import type { Transaccion } from '@morphiqpos/data';
import { z } from 'zod';

import { definirComando } from '../comando.ts';

/**
 * DP-15 · LO QUE SE CAMBIÓ, EN REGISTROS (informativo QA2-A4 de `docs/qa/HALLAZGOS.md`).
 *
 * Cada escritura deja su renglón en `auditoria` (quién, qué y cuándo), pero ninguna pantalla lo
 * enseñaba: el renombre de una caja, un PIN cambiado o un platillo marcado agotado sólo se veían
 * leyendo la base. Esto lee lo más reciente del negocio, con el nombre de quien lo hizo, para la
 * pestaña «Auditoría» de Registros. Es de quien manda (dueño y administrador): la bitácora dice de
 * todos. Sólo lee; la auditoría nunca guarda un PIN ni su hash, y las autorizaciones firmadas van
 * tapadas desde que se escriben (`saneado.ts`).
 */

export const entradaAuditoriaReciente = z
  .object({
    limite: z.number().int().min(1).max(300).default(100),
  })
  .strict();

export interface RenglonDeAuditoria {
  readonly id: string;
  readonly cuando: string;
  readonly accion: string;
  readonly entidad: string;
  readonly quien: string | null;
  readonly payload: unknown;
}

export const auditoriaReciente = definirComando<
  Transaccion,
  typeof entradaAuditoriaReciente,
  { readonly renglones: readonly RenglonDeAuditoria[] }
>({
  nombre: 'reportes.auditoria_reciente',
  entidad: 'auditoria',
  escribe: false,
  roles: ['dueno', 'administrador'],
  paquetes: PAQUETES_TODOS,
  entrada: entradaAuditoriaReciente,
  async ejecutar(ctx, entrada) {
    const filas = await ctx.paso('leer_auditoria', () =>
      ctx.tx
        .selectFrom('auditoria as a')
        .leftJoin('identidades as i', 'i.id', 'a.identidad_id')
        .leftJoin('personas as p', 'p.id', 'i.persona_id')
        .select(['a.id', 'a.created_at', 'a.accion', 'a.entidad', 'a.payload', 'p.nombre as quien'])
        .where('a.organizacion_id', '=', ctx.ambito.organizacionId)
        .orderBy('a.created_at', 'desc')
        .orderBy('a.id', 'desc')
        .limit(entrada.limite)
        .execute(),
    );
    return {
      renglones: filas.map((f) => ({
        id: String(f.id),
        cuando: f.created_at.toISOString(),
        accion: f.accion,
        entidad: f.entidad,
        quien: f.quien,
        payload: f.payload,
      })),
    };
  },
});
