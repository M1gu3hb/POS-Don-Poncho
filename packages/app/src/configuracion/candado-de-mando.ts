import 'server-only';

import { PAQUETES } from '@morphiqpos/contracts';
import type { Transaccion } from '@morphiqpos/data';
import { z } from 'zod';

import { definirComando } from '../definicion.ts';
import { guardarConfiguracionParcial } from '../puente/configuracion.ts';

/**
 * EL CANDADO DE LOS PUESTOS DE MANDO (DP-21 · Bloque 2).
 *
 * Dueño, administrador y gerente: si nadie toca la pantalla, se cierra con su PIN a los 10
 * minutos. El negocio puede moverlo de 5 a 30. Vive en `configuracion.valores.candado_de_mando_min`
 * (sin columna, sin migración); lo cambian el dueño o el administrador, por este comando, y
 * queda en la auditoría con su antes y su después.
 *
 * Es el candado de la PANTALLA. El del servidor no se configura: la sesión de un puesto de mando
 * vence a los 30 minutos sin uso (`sesion/politica.ts`), esté como esté este ajuste.
 */

export const CLAVE_DEL_CANDADO_DE_MANDO = 'candado_de_mando_min';
export const CANDADO_DE_MANDO = { minimo: 5, maximo: 30, porOmision: 10 } as const;

export const esquemaDelCandadoDeMando = z
  .number()
  .int()
  .min(CANDADO_DE_MANDO.minimo)
  .max(CANDADO_DE_MANDO.maximo);

/** Lo que dice el documento; lo que falte o no se entienda vale 10. */
export function candadoDeMandoEn(valores: unknown): number {
  if (typeof valores !== 'object' || valores === null || Array.isArray(valores)) {
    return CANDADO_DE_MANDO.porOmision;
  }
  const leido = esquemaDelCandadoDeMando.safeParse(
    (valores as Record<string, unknown>)[CLAVE_DEL_CANDADO_DE_MANDO],
  );
  return leido.success ? leido.data : CANDADO_DE_MANDO.porOmision;
}

async function leerCandado(tx: Transaccion, organizacionId: string): Promise<number> {
  const fila = await tx
    .selectFrom('configuracion')
    .select('valores')
    .where('organizacion_id', '=', organizacionId)
    .executeTakeFirst();
  return candadoDeMandoEn(fila?.valores);
}

export const entradaFijarCandadoDeMando = z.strictObject({ minutos: esquemaDelCandadoDeMando });

export const fijarCandadoDeMando = definirComando<
  Transaccion,
  typeof entradaFijarCandadoDeMando,
  { readonly minutos: number }
>({
  nombre: 'configuracion.fijar_candado_de_mando',
  entidad: 'configuracion',
  escribe: true,
  roles: ['dueno', 'administrador'],
  paquetes: PAQUETES,
  entrada: entradaFijarCandadoDeMando,
  async ejecutar(ctx, entrada) {
    const { organizacionId } = ctx.ambito;
    const antes = await ctx.paso('leer', () => leerCandado(ctx.tx, organizacionId));
    await ctx.paso('guardar', () =>
      guardarConfiguracionParcial(
        ctx.tx,
        organizacionId,
        { [CLAVE_DEL_CANDADO_DE_MANDO]: entrada.minutos },
        { desdeComando: true },
      ),
    );
    ctx.auditar({
      entidadId: null,
      payload: { antes: { minutos: antes }, despues: { minutos: entrada.minutos } },
    });
    return { minutos: entrada.minutos };
  },
});
