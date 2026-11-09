import 'server-only';

import { PAQUETES_TODOS } from '@morphiqpos/contracts';
import type { Transaccion } from '@morphiqpos/data';
import { IDS_DE_GRUPOS_DE_AUDITORIA, accionesDelGrupo } from '@morphiqpos/domain/auditoria';
import { z } from 'zod';

import { definirComando } from '../comando.ts';
import { limitesDeLaFecha } from './dia.ts';

/**
 * DP-15 · LO QUE SE CAMBIÓ, EN REGISTROS (informativo QA2-A4 de `docs/qa/HALLAZGOS.md`).
 *
 * Cada escritura deja su renglón en `auditoria` (quién, qué y cuándo), pero ninguna pantalla lo
 * enseñaba: el renombre de una caja, un PIN cambiado o un platillo marcado agotado sólo se veían
 * leyendo la base. Esto lee la bitácora del negocio, con el nombre de quien lo hizo, para la
 * pestaña «Auditoría» de Registros. DP-15.1: el filtro (grupo de acción y día del negocio) y las
 * páginas viven AQUÍ, en la consulta: antes se traían las últimas N y se filtraba en el navegador,
 * y un cambio de PIN de la mañana no se encontraba en la noche porque ya no estaba entre las N.
 * Es de quien manda (dueño y administrador): la bitácora dice de todos. Sólo lee; la auditoría
 * nunca guarda un PIN ni su hash, y las autorizaciones firmadas van tapadas desde que se escriben
 * (`saneado.ts`). Los intentos negados también están aquí: la pantalla los marca
 * (`describir-accion.ts`).
 */

/** Renglones por página: fijo, para que «siguiente» y «anterior» signifiquen lo mismo siempre. */
export const TAMANO_DE_PAGINA_DE_AUDITORIA = 50;

/** Hasta dónde se puede paginar: 1000 páginas son 50 000 renglones, más de lo que nadie recorre. */
const ULTIMA_PAGINA = 1000;

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** `YYYY-MM-DD` y además un día que existe: «2026-02-31» no es fecha aunque cumpla la forma. */
const esDiaReal = (texto: string): boolean => {
  const [anio = 0, mes = 0, dia = 0] = texto.split('-').map(Number);
  // Un día que no existe rueda al mes siguiente (31 de febrero → 3 de marzo): si el mes cambió, no existía.
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  return fecha.getUTCFullYear() === anio && fecha.getUTCMonth() === mes - 1;
};

export const entradaAuditoriaReciente = z
  .object({
    /** Qué cambios: un grupo de la lista cerrada (`domain/auditoria`). Sin grupo, todos. */
    grupo: z.enum(IDS_DE_GRUPOS_DE_AUDITORIA).optional(),
    /** Un día del negocio (hora de la zona del negocio). Sin fecha, cualquier día. */
    fecha: z.string().regex(FECHA).refine(esDiaReal, 'No es un día del calendario.').optional(),
    pagina: z.number().int().min(0).max(ULTIMA_PAGINA).default(0),
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
  {
    readonly renglones: readonly RenglonDeAuditoria[];
    readonly pagina: number;
    /** Hay una página siguiente: se pidió un renglón de más para saberlo sin contar todo. */
    readonly hayMas: boolean;
  }
>({
  nombre: 'reportes.auditoria_reciente',
  entidad: 'auditoria',
  escribe: false,
  roles: ['dueno', 'administrador'],
  paquetes: PAQUETES_TODOS,
  entrada: entradaAuditoriaReciente,
  async ejecutar(ctx, entrada) {
    const { organizacionId } = ctx.ambito;
    const dia =
      entrada.fecha === undefined
        ? null
        : await ctx.paso('limites_del_dia', () =>
            limitesDeLaFecha(ctx.tx, organizacionId, entrada.fecha ?? ''),
          );
    const acciones = entrada.grupo === undefined ? null : accionesDelGrupo(entrada.grupo);
    const filas = await ctx.paso('leer_auditoria', () => {
      let consulta = ctx.tx
        .selectFrom('auditoria as a')
        .leftJoin('identidades as i', 'i.id', 'a.identidad_id')
        .leftJoin('personas as p', 'p.id', 'i.persona_id')
        .select(['a.id', 'a.created_at', 'a.accion', 'a.entidad', 'a.payload', 'p.nombre as quien'])
        .where('a.organizacion_id', '=', organizacionId);
      if (acciones !== null) consulta = consulta.where('a.accion', 'in', [...acciones]);
      if (dia !== null) {
        consulta = consulta
          .where('a.created_at', '>=', dia.desde)
          .where('a.created_at', '<', dia.hasta);
      }
      return consulta
        .orderBy('a.created_at', 'desc')
        .orderBy('a.id', 'desc')
        .limit(TAMANO_DE_PAGINA_DE_AUDITORIA + 1)
        .offset(entrada.pagina * TAMANO_DE_PAGINA_DE_AUDITORIA)
        .execute();
    });
    const pagina = filas.slice(0, TAMANO_DE_PAGINA_DE_AUDITORIA);
    return {
      pagina: entrada.pagina,
      hayMas: filas.length > TAMANO_DE_PAGINA_DE_AUDITORIA,
      renglones: pagina.map((f) => ({
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
