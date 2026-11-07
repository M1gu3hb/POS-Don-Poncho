import 'server-only';

import { PAQUETES_TODOS } from '@morphiqpos/contracts';
import type { Transaccion } from '@morphiqpos/data';
import { z } from 'zod';

import { definirComando } from '../definicion.ts';
import { topeDe } from './descuento.ts';

/**
 * `venta.topes_de_los_puestos` — LO QUE DE VERDAD AUTORIZA CADA PUESTO (DP-14 · ronda 2, menor).
 *
 * Configuración → Descuentos decía «gerente 30 %, administrador 50 %, dueño 100 %» fijo, aunque el
 * negocio hubiera escrito otros topes en `topes_descuento`. Esto lee, para los tres puestos que
 * autorizan con su PIN, el tope que el servidor aplica: la fila del negocio o, si no la escribió, la
 * del sistema (`topeDe`, el respaldo por puesto de DP-14.2). Sólo lee.
 */

const PUESTOS_QUE_AUTORIZAN = ['gerente', 'administrador', 'dueno'] as const;

export const entradaTopesDeLosPuestos = z.object({});

export interface TopeDelPuesto {
  readonly rol: (typeof PUESTOS_QUE_AUTORIZAN)[number];
  /** Puntos base: 3000 = 30 %. */
  readonly topeBp: number;
  readonly topeCentavos: string;
}

export const topesDeLosPuestos = definirComando<
  Transaccion,
  typeof entradaTopesDeLosPuestos,
  { readonly topes: readonly TopeDelPuesto[] }
>({
  nombre: 'venta.topes_de_los_puestos',
  entidad: 'organizacion',
  escribe: false,
  roles: ['dueno', 'administrador'],
  paquetes: PAQUETES_TODOS,
  entrada: entradaTopesDeLosPuestos,
  async ejecutar(ctx) {
    const topes: TopeDelPuesto[] = [];
    for (const rol of PUESTOS_QUE_AUTORIZAN) {
      const tope = await topeDe(ctx, rol);
      topes.push({ rol, topeBp: tope.topeBp, topeCentavos: tope.topeCentavos.toString() });
    }
    return { topes };
  },
});
