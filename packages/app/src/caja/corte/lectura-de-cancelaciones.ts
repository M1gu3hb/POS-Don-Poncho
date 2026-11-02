import 'server-only';

import { ErrorDominio, PAQUETES_MOSTRADOR } from '@morphiqpos/contracts';
import type { Transaccion } from '@morphiqpos/data';
import { z } from 'zod';

import { definirComando } from '../../definicion.ts';
import { leerCancelaciones, type Cancelacion } from './cancelaciones.ts';
import { leerSesion } from './consultas.ts';

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

export const entradaCancelacionesDelCorte = z.object({ sesionCajaId: z.uuid() });

/** Las cancelaciones de la ventana de UNA sesión de caja, en el orden en que pasaron. */
export const cancelacionesDelCorteComando = definirComando<
  Transaccion,
  typeof entradaCancelacionesDelCorte,
  CancelacionesLeidas
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
    const sesion = await ctx.paso('leer_sesion', () =>
      leerSesion(ctx.tx, organizacionId, entrada.sesionCajaId),
    );
    // Una sesión de otro negocio se ve igual que una que no existe.
    if (sesion === null) {
      throw new ErrorDominio('PUENTE_NO_ENCONTRADO', 'Ese corte no existe en este negocio.');
    }
    const filas = await ctx.paso('leer_cancelaciones', () =>
      leerCancelaciones(ctx.tx, organizacionId, {
        sucursalId: sesion.sucursalId,
        desde: sesion.abiertaEn,
        hasta: sesion.cerradaEn ?? ctx.ahora,
      }),
    );
    // La consulta trae lo más reciente primero; el corte lo cuenta en el orden del día.
    return { cancelaciones: [...filas].reverse() };
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
