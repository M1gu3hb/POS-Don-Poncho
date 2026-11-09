import 'server-only';

import { ErrorDominio, PAQUETES_RESTAURANTE } from '@morphiqpos/contracts';
import type { Transaccion } from '@morphiqpos/data';
import { estaAgotado } from '@morphiqpos/domain/catalogo';
import { z } from 'zod';

import { definirComando } from '../comando.ts';
import { diaDelNegocio } from '../reportes/dia.ts';

/**
 * DP-15 · EL PLATILLO AGOTADO DEL DÍA.
 *
 * En una barbacoa se acaba la carne, y el mesero y el comensal tienen que dejar de pedirla al
 * momento, sin que nadie edite el producto ni se acuerde de volver a mostrarlo mañana.
 *
 * `productos.agotado_hasta` (la 189) guarda el FIN del día del negocio en que se marcó. Un producto
 * está agotado mientras esa hora no llega; al empezar el día siguiente vuelve solo. Quién lo marca:
 * la cocina (que es quien ve que se acabó), la gerente, el administrador y el dueño. El mesero y la
 * caja no: lo ven, no lo deciden.
 *
 * El servidor lo hace valer donde entra un platillo NUEVO a una cuenta: el pedido del mesero
 * (`restaurante.enviar_pedido`), el carrito y el envío del portal (`cargarProductosDelMenu`) y la
 * línea del mostrador (`venta.agregar_linea`). Lo que ya estaba pedido antes de marcarlo sigue su
 * camino: la cocina lo prepara, se cobra y se cancela como siempre.
 */

export const QUIEN_MARCA_AGOTADO = ['dueno', 'administrador', 'gerente', 'cocina'] as const;

export { estaAgotado };

/**
 * Niega el pedido si alguno de sus platillos está agotado, y dice cuáles: «Barbacoa de horno se
 * agotó por hoy». Lo usan los caminos que AGREGAN platillos a una cuenta.
 */
export function exigirNoAgotados(
  productos: readonly { readonly nombre: string; readonly agotadoHasta: Date | string | null }[],
  ahora: Date,
): void {
  const agotados = [
    ...new Set(productos.filter((p) => estaAgotado(p.agotadoHasta, ahora)).map((p) => p.nombre)),
  ];
  if (agotados.length === 0) return;
  throw new ErrorDominio(
    'PRODUCTO_AGOTADO',
    agotados.length === 1
      ? `${agotados[0] ?? ''} se agotó por hoy. Quítalo del pedido y ofrece otra cosa.`
      : `Se agotaron por hoy: ${agotados.join(', ')}. Quítalos del pedido y ofrece otra cosa.`,
    { productos: agotados.join(', ') },
  );
}

export const entradaMarcarAgotado = z
  .object({
    productoId: z.uuid(),
    agotado: z.boolean(),
  })
  .strict();

export interface ResultadoMarcarAgotado {
  readonly productoId: string;
  readonly nombre: string;
  readonly agotado: boolean;
  /** Hasta cuándo (el fin del día del negocio), o nulo si quedó disponible. */
  readonly hasta: string | null;
}

export const marcarAgotado = definirComando<
  Transaccion,
  typeof entradaMarcarAgotado,
  ResultadoMarcarAgotado
>({
  nombre: 'catalogo.marcar_agotado',
  entidad: 'producto',
  escribe: true,
  roles: [...QUIEN_MARCA_AGOTADO],
  paquetes: PAQUETES_RESTAURANTE,
  entrada: entradaMarcarAgotado,
  async ejecutar(ctx, entrada) {
    const { organizacionId } = ctx.ambito;
    // La fila del producto, con candado: dos personas que lo marcan a la vez se forman.
    const producto = await ctx.paso('bloquear_producto', () =>
      ctx.tx
        .selectFrom('productos')
        .select(['id', 'nombre', 'agotado_hasta'])
        .where('organizacion_id', '=', organizacionId)
        .where('id', '=', entrada.productoId)
        .where('activo', '=', true)
        .forUpdate()
        .executeTakeFirst(),
    );
    if (producto === undefined) {
      throw new ErrorDominio(
        'PRODUCTO_NO_ENCONTRADO',
        'Ese platillo no existe o está dado de baja.',
      );
    }

    const antes = estaAgotado(producto.agotado_hasta, ctx.ahora);
    const hasta = entrada.agotado
      ? (await ctx.paso('fin_del_dia', () => diaDelNegocio(ctx.tx, organizacionId, ctx.ahora)))
          .hasta
      : null;

    await ctx.paso('escribir_agotado', () =>
      ctx.tx
        .updateTable('productos')
        .set({ agotado_hasta: hasta, updated_at: ctx.ahora })
        .where('organizacion_id', '=', organizacionId)
        .where('id', '=', producto.id)
        .execute(),
    );

    ctx.auditar({
      entidadId: producto.id,
      payload: {
        nombre: producto.nombre,
        antes,
        agotado: entrada.agotado,
        hasta: hasta === null ? null : hasta.toISOString(),
      },
    });

    return {
      productoId: producto.id,
      nombre: producto.nombre,
      agotado: entrada.agotado,
      hasta: hasta === null ? null : hasta.toISOString(),
    };
  },
});
