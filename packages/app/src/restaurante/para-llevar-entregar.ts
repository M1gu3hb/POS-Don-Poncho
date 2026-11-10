import 'server-only';

import { ErrorDominio, PAQUETES_RESTAURANTE } from '@morphiqpos/contracts';
import type { Transaccion } from '@morphiqpos/data';
import { z } from 'zod';

import { definirComando } from '../definicion.ts';
import { marcarEntregadas } from './preparacion-escrituras.ts';
import { propagarAItems, recalcularEstadoDeLineas } from './propagacion.ts';

/**
 * DP-16 · «ENTREGADO»: la caja le dio al cliente su pedido para llevar.
 *
 * Lo listo del pedido pasa a entregado (comandas y platillos), y sale de la pantalla de su estación
 * y de la lista «Para llevar» de la Caja. Lo que siga en el fuego no se toca: la otra estación lo
 * termina y vuelve a avisar. `restaurante.entregar_pedidos` es el de la mesa (su mesero, su mapa);
 * éste no mueve mesas porque el pedido para llevar no tiene.
 *
 * Sin nada listo no es un fallo (dos toques seguidos, o el otro aparato ya lo entregó): devuelve
 * cero y no escribe.
 */

const ROLES_DE_CAJA = ['cajero', 'gerente', 'administrador', 'dueno'] as const;

export const entradaEntregarParaLlevar = z.object({ ordenId: z.uuid() });

export const entregarParaLlevar = definirComando<
  Transaccion,
  typeof entradaEntregarParaLlevar,
  { readonly ordenId: string; readonly entregadas: number }
>({
  nombre: 'restaurante.entregar_para_llevar',
  entidad: 'comanda',
  escribe: true,
  roles: [...ROLES_DE_CAJA],
  paquetes: PAQUETES_RESTAURANTE,
  sucursal: { ordenId: 'ordenes' },
  entrada: entradaEntregarParaLlevar,
  async ejecutar(ctx, entrada) {
    const { organizacionId } = ctx.ambito;
    const orden = await ctx.paso('cargar_orden', () =>
      ctx.tx
        .selectFrom('ordenes')
        .select(['canal', 'estado'])
        .where('organizacion_id', '=', organizacionId)
        .where('id', '=', entrada.ordenId)
        .executeTakeFirst(),
    );
    if (orden?.canal !== 'llevar') {
      throw new ErrorDominio(
        'ORDEN_NO_ENCONTRADA',
        'Ese no es un pedido para llevar. Si es de una mesa, lo entrega su mesero.',
      );
    }
    const listas = await ctx.paso('buscar_listas', () =>
      ctx.tx
        .selectFrom('comandas')
        .select('id')
        .where('organizacion_id', '=', organizacionId)
        .where('orden_id', '=', entrada.ordenId)
        .where('estado', '=', 'listo')
        .execute(),
    );
    const ids = listas.map((c) => c.id);
    if (ids.length > 0) {
      await ctx.paso('marcar_entregadas', () =>
        marcarEntregadas(ctx.tx, organizacionId, ids, ctx.ahora),
      );
      await ctx.paso('propagar_items', () =>
        propagarAItems(ctx.tx, organizacionId, ids, 'entregado', ctx.ahora),
      );
      await ctx.paso('recalcular_lineas', () =>
        recalcularEstadoDeLineas(ctx.tx, organizacionId, ids),
      );
    }
    ctx.auditar({ entidadId: entrada.ordenId, payload: { entregadas: ids.length } });
    return { ordenId: entrada.ordenId, entregadas: ids.length };
  },
});
