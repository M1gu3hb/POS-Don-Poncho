import 'server-only';

import { ErrorDominio, PAQUETES_MOSTRADOR } from '@morphiqpos/contracts';
import type { Transaccion } from '@morphiqpos/data';
import { z } from 'zod';

import { definirComando } from '../../definicion.ts';
import { alcanceDelCorte } from './alcance-del-corte.ts';
import {
  cancelacionesDelCorte,
  leerCancelaciones,
  totalDeLasCancelacionesDelCorte,
  type Cancelacion,
  type TotalDeCancelaciones,
} from './cancelaciones.ts';

/**
 * LAS DOS LECTURAS DE CANCELACIONES que el navegador pide sin armar la hoja entera (DP-12.4).
 *
 * `caja.hoja_del_corte` ya trae las cancelaciones, pero junto con el inventario bajo, el consumo
 * de insumos y media docena de consultas más: el corte heredado de la Caja sólo necesita ésta, y
 * Registros ni siquiera tiene una sesión. Las dos salen de `leerCancelaciones`, la misma consulta
 * de la hoja, así que las tres pantallas dicen lo mismo.
 *
 * Son lecturas de caja y de dirección, como la hoja. El mesero cancela, pero no lee el corte.
 */

const ROLES_DE_CAJA = ['cajero', 'gerente', 'administrador', 'dueno'] as const;

const DIA_EN_MS = 86_400_000;
/** Registros mira, por omisión, los últimos tres meses; no es el historial entero. */
const DIAS_POR_OMISION = 90;
const TOPE_DE_REGISTROS = 200;

export interface CancelacionesLeidas {
  readonly cancelaciones: readonly Cancelacion[];
}

/** DP-13.2 · El corte de una caja dice de qué habla: sus cuentas, o el día (`alcance-del-corte.ts`). */
export interface CancelacionesDelCorte extends CancelacionesLeidas {
  readonly alcance: 'caja' | 'dia';
  /** DP-14.6 · TODAS las del corte, contadas en SQL: la lista tiene tope de filas. */
  readonly total: TotalDeCancelaciones;
}

export const entradaCancelacionesDelCorte = z.object({ sesionCajaId: z.uuid() });

/** Las cancelaciones del corte de UNA sesión de caja, en el orden en que pasaron. */
export const cancelacionesDelCorteComando = definirComando<
  Transaccion,
  typeof entradaCancelacionesDelCorte,
  CancelacionesDelCorte
>({
  nombre: 'caja.cancelaciones_del_corte',
  entidad: 'sesion_caja',
  escribe: false,
  roles: [...ROLES_DE_CAJA],
  paquetes: PAQUETES_MOSTRADOR,
  sucursal: { sesionCajaId: 'sesiones_caja' },
  entrada: entradaCancelacionesDelCorte,
  async ejecutar(ctx, entrada) {
    const { organizacionId } = ctx.ambito;
    const alcance = await ctx.paso('leer_alcance', () =>
      alcanceDelCorte(ctx.tx, organizacionId, entrada.sesionCajaId, ctx.ahora),
    );
    // Una sesión de otro negocio se ve igual que una que no existe.
    if (alcance === null) {
      throw new ErrorDominio('PUENTE_NO_ENCONTRADO', 'Ese corte no existe en este negocio.');
    }
    const cancelaciones = await ctx.paso('leer_cancelaciones', () =>
      cancelacionesDelCorte(ctx.tx, organizacionId, alcance),
    );
    const total = await ctx.paso('totalizar', () =>
      totalDeLasCancelacionesDelCorte(ctx.tx, organizacionId, alcance),
    );
    return { cancelaciones, alcance: alcance.cierraElDia ? 'dia' : 'caja', total };
  },
});

export const entradaCancelacionesRegistradas = z.object({
  dias: z.number().int().min(1).max(366).default(DIAS_POR_OMISION),
});

/**
 * Las cuentas canceladas y los platillos anulados de los últimos días, lo más reciente primero.
 * De la sucursal de quien pregunta; sin sucursal en su ámbito (el dueño de varias), de todas.
 */
export const cancelacionesRegistradasComando = definirComando<
  Transaccion,
  typeof entradaCancelacionesRegistradas,
  CancelacionesLeidas
>({
  nombre: 'caja.cancelaciones_registradas',
  entidad: 'orden',
  escribe: false,
  roles: [...ROLES_DE_CAJA],
  paquetes: PAQUETES_MOSTRADOR,
  entrada: entradaCancelacionesRegistradas,
  async ejecutar(ctx, entrada) {
    const { organizacionId, sucursalId } = ctx.ambito;
    const cancelaciones = await ctx.paso('leer_cancelaciones', () =>
      leerCancelaciones(
        ctx.tx,
        organizacionId,
        {
          sucursalId,
          desde: new Date(ctx.ahora.getTime() - entrada.dias * DIA_EN_MS),
          hasta: ctx.ahora,
        },
        TOPE_DE_REGISTROS,
      ),
    );
    return { cancelaciones };
  },
});
