import 'server-only';

import { ErrorDominio, PAQUETES_OPERATIVOS } from '@morphiqpos/contracts';
import type { Transaccion } from '@morphiqpos/data';
import { claveDeColorDeCategoria } from '@morphiqpos/domain/catalogo';
import { z } from 'zod';

import { definirComando } from '../comando.ts';
import { SinNovedad } from '../fallos.ts';
import { estacionesActivas } from '../restaurante/datos.ts';
import { estacionSiLaHay } from '../restaurante/estaciones.ts';

/**
 * DP-24 · 3.3 y 3.4 · LAS CATEGORÍAS DEL MENÚ: nombre, color, unir dos y mover platillos.
 *
 * Todo por comandos con su auditoría (la hoja de comanda de papel manda cómo se llaman y qué
 * lleva cada una). Una regla manda sobre las tres cosas: **mover un platillo de categoría no puede
 * cambiarle la estación de preparación**. La estación sale de la categoría (la suya, o la general
 * si no tiene) y del área del propio producto; si las dos categorías resuelven a la MISMA estación,
 * la comanda de cocina o de barra sale igual que antes. Si no, se niega diciendo cuáles.
 */

const ROLES = ['dueno', 'administrador', 'gerente'] as const;

const nombreDeCategoria = z.string().trim().min(1).max(80);
/** Una clave de la paleta, o `null` para quitarle el color. */
const colorDeCategoria = z
  .string()
  .nullable()
  .refine((c) => c === null || claveDeColorDeCategoria(c) !== null, {
    message: 'Elige uno de los colores de la paleta.',
  });

export const entradaGuardarCategoria = z.object({
  categoriaId: z.uuid(),
  nombre: nombreDeCategoria.optional(),
  color: colorDeCategoria.optional(),
});

export const entradaUnirCategorias = z.object({
  categoriaQueSobraId: z.uuid(),
  categoriaQueRecibeId: z.uuid(),
});

export const entradaMoverACategoria = z.object({
  productoIds: z.array(z.uuid()).min(1).max(200),
  categoriaId: z.uuid(),
});

interface CategoriaLeida {
  readonly id: string;
  readonly nombre: string;
  readonly color: string | null;
  readonly activa: boolean;
  readonly estacion_preparacion_id: string | null;
}

async function categoriaDeProducto(
  tx: Transaccion,
  organizacionId: string,
  id: string,
): Promise<CategoriaLeida> {
  const fila = await tx
    .selectFrom('categorias')
    .select(['id', 'nombre', 'color', 'activa', 'estacion_preparacion_id'])
    .where('organizacion_id', '=', organizacionId)
    .where('tipo', '=', 'producto')
    .where('id', '=', id)
    .forUpdate()
    .executeTakeFirst();
  if (fila === undefined) {
    throw new ErrorDominio('CATALOGO_INVALIDO', 'Esa categoría ya no existe.');
  }
  return fila;
}

/** La estación a la que llegaría la comanda de un producto de esa categoría (o `null`). */
async function estacionDe(
  tx: Transaccion,
  organizacionId: string,
  categoria: CategoriaLeida,
): Promise<string | null> {
  const estaciones = await estacionesActivas(tx, organizacionId);
  return estacionSiLaHay(categoria.estacion_preparacion_id, estaciones)?.id ?? null;
}

async function exigirMismaEstacion(
  tx: Transaccion,
  organizacionId: string,
  origen: CategoriaLeida,
  destino: CategoriaLeida,
  quienes: string,
): Promise<void> {
  const [deOrigen, deDestino] = [
    await estacionDe(tx, organizacionId, origen),
    await estacionDe(tx, organizacionId, destino),
  ];
  if (deOrigen !== deDestino) {
    throw new ErrorDominio(
      'CATALOGO_INVALIDO',
      `Mover ${quienes} de «${origen.nombre}» a «${destino.nombre}» le cambiaría la estación de preparación: no se movió nada.`,
    );
  }
}

export const guardarCategoriaDelMenu = definirComando<
  Transaccion,
  typeof entradaGuardarCategoria,
  { readonly categoriaId: string; readonly nombre: string; readonly color: string | null }
>({
  nombre: 'catalogo.guardar_categoria',
  entidad: 'categoria',
  escribe: true,
  roles: [...ROLES],
  paquetes: PAQUETES_OPERATIVOS,
  entrada: entradaGuardarCategoria,
  async ejecutar(ctx, entrada) {
    const { organizacionId } = ctx.ambito;
    const actual = await ctx.paso('bloquear_categoria', () =>
      categoriaDeProducto(ctx.tx, organizacionId, entrada.categoriaId),
    );
    const nombre = entrada.nombre ?? actual.nombre;
    const color = entrada.color === undefined ? actual.color : entrada.color;
    if (nombre === actual.nombre && color === actual.color) {
      throw new SinNovedad({ categoriaId: actual.id, nombre, color });
    }
    if (nombre !== actual.nombre) {
      const repetida = await ctx.paso('buscar_repetida', () =>
        ctx.tx
          .selectFrom('categorias')
          .select('id')
          .where('organizacion_id', '=', organizacionId)
          .where('tipo', '=', 'producto')
          // También entre las apagadas: la base no admite dos con el mismo nombre.
          .where('id', '<>', actual.id)
          .where((eb) => eb(eb.fn('lower', ['nombre']), '=', nombre.toLowerCase()))
          .executeTakeFirst(),
      );
      if (repetida !== undefined) {
        throw new ErrorDominio('CATALOGO_INVALIDO', `Ya existe una categoría llamada «${nombre}».`);
      }
    }
    await ctx.paso('guardar_categoria', () =>
      ctx.tx
        .updateTable('categorias')
        .set({ nombre, color, updated_at: ctx.ahora })
        .where('organizacion_id', '=', organizacionId)
        .where('id', '=', actual.id)
        .execute(),
    );
    ctx.auditar({
      entidadId: actual.id,
      payload: {
        antes: { nombre: actual.nombre, color: actual.color },
        despues: { nombre, color },
      },
    });
    return { categoriaId: actual.id, nombre, color };
  },
});

export const unirCategoriasDelMenu = definirComando<
  Transaccion,
  typeof entradaUnirCategorias,
  { readonly movidos: number; readonly categoriaQueRecibeId: string }
>({
  nombre: 'catalogo.unir_categorias',
  entidad: 'categoria',
  escribe: true,
  roles: [...ROLES],
  paquetes: PAQUETES_OPERATIVOS,
  entrada: entradaUnirCategorias,
  async ejecutar(ctx, entrada) {
    const { organizacionId } = ctx.ambito;
    if (entrada.categoriaQueSobraId === entrada.categoriaQueRecibeId) {
      throw new ErrorDominio('CATALOGO_INVALIDO', 'Elige dos categorías distintas.');
    }
    const origen = await ctx.paso('bloquear_origen', () =>
      categoriaDeProducto(ctx.tx, organizacionId, entrada.categoriaQueSobraId),
    );
    const destino = await ctx.paso('bloquear_destino', () =>
      categoriaDeProducto(ctx.tx, organizacionId, entrada.categoriaQueRecibeId),
    );
    const suyos = await ctx.paso('productos_del_origen', () =>
      ctx.tx
        .selectFrom('productos')
        .select('id')
        .where('organizacion_id', '=', organizacionId)
        .where('categoria_id', '=', origen.id)
        .forUpdate()
        .execute(),
    );
    if (suyos.length === 0 && !origen.activa) {
      throw new SinNovedad({ movidos: 0, categoriaQueRecibeId: destino.id });
    }
    await ctx.paso('misma_estacion', () =>
      exigirMismaEstacion(
        ctx.tx,
        organizacionId,
        origen,
        destino,
        `los ${String(suyos.length)} productos`,
      ),
    );
    if (suyos.length > 0) {
      await ctx.paso('mover_productos', () =>
        ctx.tx
          .updateTable('productos')
          .set({ categoria_id: destino.id, orden_en_categoria: null, updated_at: ctx.ahora })
          .where('organizacion_id', '=', organizacionId)
          .where('categoria_id', '=', origen.id)
          .execute(),
      );
    }
    // La categoría que sobra se APAGA, no se borra: su historia (y sus ventas) siguen ahí.
    await ctx.paso('apagar_origen', () =>
      ctx.tx
        .updateTable('categorias')
        .set({ activa: false, updated_at: ctx.ahora })
        .where('organizacion_id', '=', organizacionId)
        .where('id', '=', origen.id)
        .execute(),
    );
    ctx.auditar({
      entidadId: destino.id,
      payload: {
        origen: { id: origen.id, nombre: origen.nombre },
        destino: { id: destino.id, nombre: destino.nombre },
        movidos: suyos.length,
      },
    });
    return { movidos: suyos.length, categoriaQueRecibeId: destino.id };
  },
});

export const moverProductosACategoria = definirComando<
  Transaccion,
  typeof entradaMoverACategoria,
  { readonly movidos: number; readonly categoriaId: string }
>({
  nombre: 'catalogo.mover_a_categoria',
  entidad: 'categoria',
  escribe: true,
  roles: [...ROLES],
  paquetes: PAQUETES_OPERATIVOS,
  entrada: entradaMoverACategoria,
  async ejecutar(ctx, entrada) {
    const { organizacionId } = ctx.ambito;
    const destino = await ctx.paso('bloquear_destino', () =>
      categoriaDeProducto(ctx.tx, organizacionId, entrada.categoriaId),
    );
    const unicos = [...new Set(entrada.productoIds)];
    const productos = await ctx.paso('bloquear_productos', () =>
      ctx.tx
        .selectFrom('productos')
        .select(['id', 'nombre', 'categoria_id'])
        .where('organizacion_id', '=', organizacionId)
        .where('id', 'in', unicos)
        .forUpdate()
        .execute(),
    );
    if (productos.length !== unicos.length) {
      throw new ErrorDominio('PRODUCTO_NO_ENCONTRADO', 'Uno de los productos ya no existe.');
    }
    const porMover = productos.filter((p) => p.categoria_id !== destino.id);
    if (porMover.length === 0) throw new SinNovedad({ movidos: 0, categoriaId: destino.id });

    const origenes = [
      ...new Set(porMover.flatMap((p) => (p.categoria_id === null ? [] : [p.categoria_id]))),
    ];
    for (const categoriaQueSobraId of origenes) {
      const origen = await ctx.paso(`origen_${categoriaQueSobraId}`, () =>
        categoriaDeProducto(ctx.tx, organizacionId, categoriaQueSobraId),
      );
      const quienes = porMover
        .filter((p) => p.categoria_id === categoriaQueSobraId)
        .map((p) => `«${p.nombre}»`)
        .join(', ');
      await ctx.paso(`misma_estacion_${categoriaQueSobraId}`, () =>
        exigirMismaEstacion(ctx.tx, organizacionId, origen, destino, quienes),
      );
    }
    await ctx.paso('mover', () =>
      ctx.tx
        .updateTable('productos')
        .set({ categoria_id: destino.id, orden_en_categoria: null, updated_at: ctx.ahora })
        .where('organizacion_id', '=', organizacionId)
        .where(
          'id',
          'in',
          porMover.map((p) => p.id),
        )
        .execute(),
    );
    ctx.auditar({
      entidadId: destino.id,
      payload: {
        destino: { id: destino.id, nombre: destino.nombre },
        productos: porMover.map((p) => ({ id: p.id, nombre: p.nombre, de: p.categoria_id })),
      },
    });
    return { movidos: porMover.length, categoriaId: destino.id };
  },
});
