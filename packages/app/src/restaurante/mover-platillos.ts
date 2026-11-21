import 'server-only';

import { ErrorDominio, PAQUETES_RESTAURANTE } from '@morphiqpos/contracts';
import type { Transaccion } from '@morphiqpos/data';
import { z } from 'zod';

import { definirComando, type ContextoComando } from '../definicion.ts';
import { tomarCandadosDeCocina } from './candados-de-cocina.ts';
import { comandaPorId } from './datos.ts';
import { ajustarComandaAlMinimo } from './items.ts';
import { cerrarElMovimiento } from './preparacion.ts';
import { ROLES_DE_COCINA } from './roles-de-cocina.ts';
import { estadoItemDe, selloDeItem, type EstadoComanda } from './transiciones.ts';

/**
 * DP-24 · EL BLOQUE COMPLETO DE LA COCINA: varios platillos de una columna, de una vez.
 *
 * La cocina mueve cada platillo por separado (`transicionar_pedido` con `comandaItemId`), y para
 * el bloque de una mesa —«Preparar todo», «Todo listo»— manda aquí los que ve en la columna.
 * `desde` es la columna que la pantalla tiene a la vista: sólo se mueven los platillos que SIGUEN
 * en ella. Uno que otro cocinero ya adelantó se omite sin error y sin retroceder, y el comando es
 * idempotente: repetirlo no cambia nada. Cada comanda queda donde sus platillos digan.
 */

const COLUMNAS_QUE_AVANZAN = ['nuevo', 'en_preparacion'] as const;

export const entradaMoverPlatillos = z
  .object({
    platilloIds: z.array(z.uuid()).min(1).max(120),
    /** La columna de la que salen: sólo se mueven los platillos que todavía estén en ella. */
    desde: z.enum(COLUMNAS_QUE_AVANZAN),
    estado: z.enum(['en_preparacion', 'listo']),
  })
  .refine((e) => !(e.desde === 'en_preparacion' && e.estado === 'en_preparacion'), {
    message: 'Un platillo en preparación sólo puede pasar a listo.',
  });

export interface ResultadoMoverPlatillos {
  readonly movidos: number;
  /** Los que ya no estaban en la columna (otro aparato los adelantó) o no existen. */
  readonly omitidos: number;
  readonly comandas: readonly string[];
}

export const moverPlatillos = definirComando<
  Transaccion,
  typeof entradaMoverPlatillos,
  ResultadoMoverPlatillos
>({
  nombre: 'restaurante.mover_platillos',
  entidad: 'comanda',
  escribe: true,
  roles: [...ROLES_DE_COCINA],
  paquetes: PAQUETES_RESTAURANTE,
  sucursal: { 'platilloIds[]': 'comanda_items' },
  modulo: 'cocina',
  entrada: entradaMoverPlatillos,
  async ejecutar(ctx, entrada) {
    const { organizacionId, empleoId } = ctx.ambito;
    const ids = [...new Set(entrada.platilloIds)];

    // La primera lectura sólo dice de qué cuentas y comandas son; la que vale es la de después.
    const ubicados = await ctx.paso('ubicar', () =>
      ctx.tx
        .selectFrom('comanda_items as i')
        .innerJoin('comandas as c', (j) =>
          j.onRef('c.id', '=', 'i.comanda_id').onRef('c.organizacion_id', '=', 'i.organizacion_id'),
        )
        .select(['i.comanda_id as comandaId', 'c.orden_id as ordenId'])
        .where('i.organizacion_id', '=', organizacionId)
        .where('i.id', 'in', ids)
        .execute(),
    );
    if (ubicados.length === 0) {
      throw new ErrorDominio('COMANDA_NO_ENCONTRADA', 'Esos platillos ya no están en cocina.');
    }
    await ctx.paso('candados', () =>
      tomarCandadosDeCocina(ctx.tx, {
        organizacionId,
        ordenIds: ubicados.map((u) => u.ordenId),
        comandas: { de: 'ids', ids: ubicados.map((u) => u.comandaId) },
      }),
    );

    const origen = estadoItemDe(entrada.desde);
    const movidos = await ctx.paso('mover_platillos', () =>
      ctx.tx
        .updateTable('comanda_items')
        .set({ estado: estadoItemDe(entrada.estado), ...selloDeItem(entrada.estado, ctx.ahora) })
        .where('organizacion_id', '=', organizacionId)
        .where('id', 'in', ids)
        .where('estado', '=', origen)
        .returning(['id', 'comanda_id as comandaId'])
        .execute(),
    );

    const comandaIds = [...new Set(movidos.map((m) => m.comandaId))];
    for (const comandaId of comandaIds) {
      await cerrarLaComanda(ctx, comandaId, entrada.estado, empleoId);
    }

    ctx.auditar({
      entidadId: comandaIds[0] ?? ubicados[0]?.comandaId ?? null,
      payload: {
        desde: entrada.desde,
        a: entrada.estado,
        movidos: movidos.length,
        omitidos: ids.length - movidos.length,
      },
    });
    return {
      movidos: movidos.length,
      omitidos: ids.length - movidos.length,
      comandas: comandaIds,
    };
  },
});

/** La comanda queda en el estado de su platillo menos avanzado, y la mesa la sigue si le toca. */
async function cerrarLaComanda(
  ctx: ContextoComando<Transaccion>,
  comandaId: string,
  destino: 'en_preparacion' | 'listo',
  empleoId: string | null,
): Promise<void> {
  const { organizacionId } = ctx.ambito;
  const comanda = await ctx.paso('cargar_comanda', () =>
    comandaPorId(ctx.tx, organizacionId, comandaId),
  );
  const estadoComanda: EstadoComanda = await ctx.paso('derivar_comanda', () =>
    ajustarComandaAlMinimo(ctx.tx, organizacionId, comanda.id, comanda.estado, ctx.ahora),
  );
  await cerrarElMovimiento(ctx.tx, (nombre, fn) => ctx.paso(nombre, fn), {
    organizacionId,
    comanda,
    estadoComanda,
    empleoId,
    ahora: ctx.ahora,
    cambioLaComanda: estadoComanda !== comanda.estado,
    salioUnPlato: destino === 'listo',
  });
}
