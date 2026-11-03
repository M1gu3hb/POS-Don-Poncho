import 'server-only';

import { ErrorDominio, PAQUETES_TODOS } from '@morphiqpos/contracts';
import type { Transaccion } from '@morphiqpos/data';
import { z } from 'zod';

import { definirComando } from '../comando.ts';
import { leerDocumentoConCandado } from '../configuracion/documento-con-candado.ts';
import { empleosDePlataforma, exigirPlataforma, guardarEmpleosDePlataforma } from './plataforma.ts';

/**
 * QUITAR, REEMPLAZAR Y PERDER LA MARCA DE PLATAFORMA (DP-13.3b).
 *
 * La marca (`plataforma.ts`) sólo se ponía: quien dejaba Morphiq, o cuyo empleo se desactivaba,
 * seguía en la lista para siempre, con los botones que borran el negocio entero.
 *
 * `mantenimiento.quitar_plataforma` la quita, o la pasa a otro dueño del mismo negocio. Igual que
 * `marcar_plataforma`, NO TIENE RUTA HTTP (un contrato lo vigila, `plataforma.test.ts`) y, además,
 * lo ejecuta SÓLO quien ya es de plataforma (`exigirPlataforma`): un dueño cualquiera no puede
 * quitársela a otro ni, aprovechando el reemplazo, ponérsela a sí mismo. El guion
 * `scripts/marcar-plataforma.mjs` lo corre con el empleo de plataforma que se la quita (o se la
 * pasa a otro).
 */

const entradaQuitarPlataforma = z
  .object({
    /** El empleo al que se le quita la marca. (No se llama `empleoId`: ese nombre es del ámbito.) */
    empleado: z.uuid(),
    /** El empleo que la recibe en su lugar, en la misma transacción. Un dueño activo del negocio. */
    reemplazarPor: z.uuid().optional(),
  })
  .refine((e) => e.reemplazarPor !== e.empleado, {
    message: 'El reemplazo tiene que ser otro empleo.',
  });

export interface ResultadoQuitarPlataforma {
  readonly empleado: string;
  /** `false`: no estaba en la lista (quitarla otra vez no hace nada). */
  readonly quitada: boolean;
  readonly reemplazadoPor: string | null;
  /** Cuántos empleos de plataforma quedan. */
  readonly empleos: number;
}

/** El reemplazo es un dueño ACTIVO de ESTE negocio: sólo un dueño ejecuta los cinco comandos. */
async function exigirDuenoActivo(
  tx: Transaccion,
  organizacionId: string,
  empleoId: string,
): Promise<void> {
  const fila = await tx
    .selectFrom('empleos')
    .select('id')
    .where('id', '=', empleoId)
    .where('organizacion_id', '=', organizacionId)
    .where('activo', '=', true)
    .where('rol', '=', 'dueno')
    .executeTakeFirst();
  if (fila === undefined) {
    throw new ErrorDominio(
      'ACCESO_NO_ENCONTRADO',
      'El reemplazo tiene que ser un dueño activo de este negocio.',
    );
  }
}

export const quitarPlataforma = definirComando<
  Transaccion,
  typeof entradaQuitarPlataforma,
  ResultadoQuitarPlataforma
>({
  nombre: 'mantenimiento.quitar_plataforma',
  entidad: 'organizacion',
  escribe: true,
  roles: ['dueno'],
  paquetes: PAQUETES_TODOS,
  sinFrontera: {
    empleado:
      'El equipo es del negocio, no de una sucursal; y sólo lo ejecuta quien es de plataforma.',
    reemplazarPor: 'Un dueño del negocio entero (se comprueba aquí mismo contra la organización).',
  },
  entrada: entradaQuitarPlataforma,
  async ejecutar(ctx, entrada) {
    // Lo primero: nada de lo que sigue se lee ni se escribe si quien llama no es de plataforma.
    await exigirPlataforma(ctx.tx, ctx.ambito);
    const { organizacionId } = ctx.ambito;
    if (entrada.reemplazarPor !== undefined) {
      await exigirDuenoActivo(ctx.tx, organizacionId, entrada.reemplazarPor);
    }

    const documento = await leerDocumentoConCandado(ctx.tx, organizacionId);
    const antes = empleosDePlataforma(documento?.valores);
    const quitada = antes.includes(entrada.empleado);
    const sinElla = antes.filter((e) => e !== entrada.empleado);
    const despues =
      entrada.reemplazarPor === undefined || sinElla.includes(entrada.reemplazarPor)
        ? sinElla
        : [...sinElla, entrada.reemplazarPor];

    if (despues.length !== antes.length || despues.some((e, i) => e !== antes[i])) {
      await ctx.paso('guardar_marca', () =>
        guardarEmpleosDePlataforma(ctx.tx, organizacionId, documento, despues, ctx.ahora),
      );
    }

    const reemplazadoPor = entrada.reemplazarPor ?? null;
    ctx.auditar({
      entidadId: organizacionId,
      payload: { empleado: entrada.empleado, quitada, reemplazadoPor },
    });
    return { empleado: entrada.empleado, quitada, reemplazadoPor, empleos: despues.length };
  },
});

/**
 * Le quita la marca a un empleo que se desactiva, DENTRO de la transacción que lo desactiva
 * (`identidad.guardar_empleado`). Toma el candado del documento: una marca puesta o quitada al
 * mismo tiempo no se pierde. Devuelve si estaba marcado.
 */
export async function quitarMarcaDeEmpleo(
  tx: Transaccion,
  organizacionId: string,
  empleoId: string,
  ahora: Date,
): Promise<boolean> {
  const documento = await leerDocumentoConCandado(tx, organizacionId);
  const empleos = empleosDePlataforma(documento?.valores);
  if (documento === undefined || !empleos.includes(empleoId)) return false;
  await guardarEmpleosDePlataforma(
    tx,
    organizacionId,
    documento,
    empleos.filter((e) => e !== empleoId),
    ahora,
  );
  return true;
}
