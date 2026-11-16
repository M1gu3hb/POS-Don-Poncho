import 'server-only';

import { PAQUETES } from '@morphiqpos/contracts';
import type { Transaccion } from '@morphiqpos/data';

import { definirComando } from '../definicion.ts';
import { guardarConfiguracionParcial } from '../puente/configuracion.ts';
import {
  CLAVE_DEL_IMPUESTO,
  esquemaDelImpuesto,
  impuestoEn,
  type ImpuestoDelNegocio,
} from './impuesto-del-negocio.ts';

/**
 * «IVA» de Configuración → Ventas y cobro (DP-21 · Bloque 1).
 *
 * Sin IVA, 8 % o 16 %, y si los precios ya lo incluyen. Cambia el total (o el desglose) de toda
 * cuenta posterior, así que no va por el camino genérico de la configuración: lo guardan sólo
 * el dueño o el administrador, por este comando, y queda en la auditoría con su antes y su
 * después («¿desde cuándo cobramos sin IVA?» tiene que tener respuesta).
 *
 * La cotización lo lee dentro de su propia transacción (`venta/cotizar.ts`): una cuenta que se
 * cobra después del cambio ya sale con la tasa nueva; las cobradas antes no se tocan.
 */

async function leerImpuesto(tx: Transaccion, organizacionId: string): Promise<ImpuestoDelNegocio> {
  const fila = await tx
    .selectFrom('configuracion')
    .select('valores')
    .where('organizacion_id', '=', organizacionId)
    .executeTakeFirst();
  return impuestoEn(fila?.valores);
}

export const entradaFijarImpuesto = esquemaDelImpuesto;

export const fijarImpuesto = definirComando<
  Transaccion,
  typeof entradaFijarImpuesto,
  ImpuestoDelNegocio
>({
  nombre: 'configuracion.fijar_impuesto',
  entidad: 'configuracion',
  escribe: true,
  roles: ['dueno', 'administrador'],
  paquetes: PAQUETES,
  entrada: entradaFijarImpuesto,
  async ejecutar(ctx, entrada) {
    const { organizacionId } = ctx.ambito;
    // Sin IVA no hay nada que incluir ni que sumar: se guarda siempre como «incluido», para que
    // el documento no diga «0 % que se suma» y alguien lo lea como una regla distinta.
    const despues: ImpuestoDelNegocio =
      entrada.puntosBase === 0
        ? { puntosBase: 0, incluidoEnPrecio: true }
        : { puntosBase: entrada.puntosBase, incluidoEnPrecio: entrada.incluidoEnPrecio };
    const antes = await ctx.paso('leer', () => leerImpuesto(ctx.tx, organizacionId));
    await ctx.paso('guardar', () =>
      guardarConfiguracionParcial(
        ctx.tx,
        organizacionId,
        { [CLAVE_DEL_IMPUESTO]: despues },
        { desdeComando: true },
      ),
    );
    ctx.auditar({ entidadId: null, payload: { antes, despues } });
    return despues;
  },
});
