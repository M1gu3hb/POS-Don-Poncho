import 'server-only';

import { PAQUETES_MOSTRADOR } from '@morphiqpos/contracts';
import type { Transaccion } from '@morphiqpos/data';
import { z } from 'zod';

import { definirComando } from '../definicion.ts';
import { guardarConfiguracionParcial } from '../puente/configuracion.ts';

/**
 * LOS DOS AJUSTES DEL CORTE DE LA CAJA (DP-21 · Bloque 20 · dinero y datos).
 *
 *   · `mostrar_costos_a_caja`: si el CAJERO ve costos y utilidad en su corte (`caja.hoja_del_corte`
 *     decide con ella; sin ella, el corte del cajero sale sin un solo costo). Es un dato sensible:
 *     antes nadie podía escribirla y siempre valía «no».
 *   · `comision_terminal_bp`: la comisión de la terminal de tarjeta, en puntos base (3.6 % = 360, de
 *     0 a 1000). El corte calcula con ella la comisión estimada que descuenta; sin tasa dice «sin tasa».
 *
 * Las cambian sólo el dueño o el administrador, por este comando y con su auditoría; el camino
 * genérico de la configuración (que también deja a un gerente) las rechaza.
 */

export const CLAVE_COSTOS_A_CAJA = 'mostrar_costos_a_caja';
export const CLAVE_COMISION_DE_LA_TERMINAL = 'comision_terminal_bp';
export const TASA_MAXIMA_EN_PUNTOS_BASE = 1_000;

export interface AjustesDelCorte {
  readonly mostrarCostosACaja: boolean;
  readonly comisionTerminalBp: number | null;
}

export const entradaFijarAjustesDelCorte = z.strictObject({
  mostrarCostosACaja: z.boolean(),
  comisionTerminalBp: z.number().int().min(0).max(TASA_MAXIMA_EN_PUNTOS_BASE).nullable(),
});

/** Lo que dice el documento; lo que falte o no se entienda: el cajero no ve costos y no hay tasa. */
export function ajustesDelCorteEn(valores: unknown): AjustesDelCorte {
  const doc =
    typeof valores === 'object' && valores !== null && !Array.isArray(valores)
      ? (valores as Record<string, unknown>)
      : {};
  const tasa = doc[CLAVE_COMISION_DE_LA_TERMINAL];
  return {
    mostrarCostosACaja: doc[CLAVE_COSTOS_A_CAJA] === true,
    comisionTerminalBp:
      typeof tasa === 'number' &&
      Number.isInteger(tasa) &&
      tasa >= 0 &&
      tasa <= TASA_MAXIMA_EN_PUNTOS_BASE
        ? tasa
        : null,
  };
}

export const fijarAjustesDelCorte = definirComando<
  Transaccion,
  typeof entradaFijarAjustesDelCorte,
  AjustesDelCorte
>({
  nombre: 'caja.fijar_ajustes_del_corte',
  entidad: 'configuracion',
  escribe: true,
  roles: ['dueno', 'administrador'],
  paquetes: PAQUETES_MOSTRADOR,
  entrada: entradaFijarAjustesDelCorte,
  async ejecutar(ctx, entrada) {
    const { organizacionId } = ctx.ambito;
    const antes = await ctx.paso('leer', async () => {
      const fila = await ctx.tx
        .selectFrom('configuracion')
        .select('valores')
        .where('organizacion_id', '=', organizacionId)
        .executeTakeFirst();
      return ajustesDelCorteEn(fila?.valores);
    });
    await ctx.paso('guardar', () =>
      guardarConfiguracionParcial(
        ctx.tx,
        organizacionId,
        {
          [CLAVE_COSTOS_A_CAJA]: entrada.mostrarCostosACaja,
          [CLAVE_COMISION_DE_LA_TERMINAL]: entrada.comisionTerminalBp,
        },
        { desdeComando: true },
      ),
    );
    ctx.auditar({ entidadId: null, payload: { antes, despues: entrada } });
    return entrada;
  },
});
