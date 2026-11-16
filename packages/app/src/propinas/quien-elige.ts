import 'server-only';

import { PAQUETES } from '@morphiqpos/contracts';
import type { Transaccion } from '@morphiqpos/data';
import { z } from 'zod';

import { definirComando } from '../definicion.ts';
import { guardarConfiguracionParcial } from '../puente/configuracion.ts';
import {
  CLAVE_LA_ELIGE_EL_MESERO,
  CLAVE_LA_ELIGE_LA_CAJA,
  CLAVE_LA_ELIGEN_LOS_COMENSALES,
  QUIEN_ELIGE_POR_OMISION,
  type QuienPuedeElegir,
} from './una-sola-verdad.ts';

/**
 * «¿QUIÉN PUEDE ELEGIR LA PROPINA?» (DP-21 · Bloque 4 · M12).
 *
 * Tres casillas de Configuración → Ventas y cobro → Propinas: los comensales (en el portal), el
 * mesero (al pedir la cuenta) y la Caja (al cobrar). Para Don Poncho, por omisión: comensales y
 * Caja, sin mesero. Lo cambian el dueño o el administrador y queda en la auditoría.
 *
 * La casilla de los comensales es la que el portal ya tenía (`portal_qr_permitir_propina_cliente`):
 * no se duplica, sólo se ordena aquí. «Activar propinas» (`propinas_activas`) sigue aparte: con
 * las propinas apagadas nadie elige, digan lo que digan estas casillas.
 */

export const entradaFijarQuienEligeLaPropina = z.strictObject({
  comensales: z.boolean(),
  mesero: z.boolean(),
  caja: z.boolean(),
});

function casilla(doc: unknown, clave: string, porOmision: boolean): boolean {
  if (typeof doc !== 'object' || doc === null || Array.isArray(doc)) return porOmision;
  const valor = (doc as Record<string, unknown>)[clave];
  return typeof valor === 'boolean' ? valor : porOmision;
}

/** Las tres casillas TAL COMO ESTÁN GUARDADAS (sin mirar si las propinas están activas). */
export function casillasDeQuienElige(valores: unknown): QuienPuedeElegir {
  return {
    comensales: casilla(
      valores,
      CLAVE_LA_ELIGEN_LOS_COMENSALES,
      QUIEN_ELIGE_POR_OMISION.comensales,
    ),
    mesero: casilla(valores, CLAVE_LA_ELIGE_EL_MESERO, QUIEN_ELIGE_POR_OMISION.mesero),
    caja: casilla(valores, CLAVE_LA_ELIGE_LA_CAJA, QUIEN_ELIGE_POR_OMISION.caja),
  };
}

export const fijarQuienEligeLaPropina = definirComando<
  Transaccion,
  typeof entradaFijarQuienEligeLaPropina,
  QuienPuedeElegir
>({
  nombre: 'configuracion.fijar_quien_elige_la_propina',
  entidad: 'configuracion',
  escribe: true,
  roles: ['dueno', 'administrador'],
  paquetes: PAQUETES,
  entrada: entradaFijarQuienEligeLaPropina,
  async ejecutar(ctx, entrada) {
    const { organizacionId } = ctx.ambito;
    const fila = await ctx.paso('leer', () =>
      ctx.tx
        .selectFrom('configuracion')
        .select('valores')
        .where('organizacion_id', '=', organizacionId)
        .executeTakeFirst(),
    );
    const antes = casillasDeQuienElige(fila?.valores);
    await ctx.paso('guardar', () =>
      guardarConfiguracionParcial(
        ctx.tx,
        organizacionId,
        {
          [CLAVE_LA_ELIGEN_LOS_COMENSALES]: entrada.comensales,
          [CLAVE_LA_ELIGE_EL_MESERO]: entrada.mesero,
          [CLAVE_LA_ELIGE_LA_CAJA]: entrada.caja,
        },
        { desdeComando: true },
      ),
    );
    ctx.auditar({ entidadId: null, payload: { antes, despues: entrada } });
    return entrada;
  },
});
