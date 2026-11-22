import 'server-only';

import { ErrorDominio, PAQUETES_OPERATIVOS } from '@morphiqpos/contracts';
import type { Transaccion } from '@morphiqpos/data';
import { mismoOrden, ordenarCategorias, ordenarMenu } from '@morphiqpos/domain/catalogo';
import { z } from 'zod';

import { definirComando } from '../comando.ts';
import { SinNovedad } from '../fallos.ts';

/**
 * DP-24 · 3.2 · EL ORDEN DEL MENÚ Y LO QUE SE VE EN ÉL.
 *
 * Configuración → Portal de comensales deja ordenar las secciones (categorías) y los productos
 * dentro de cada una, y mostrar u ocultar cada producto en el menú digital. Lo que se guarda aquí
 * manda en el portal QR, en la rejilla del mesero y en la de la Caja (un solo orden:
 * `ordenarMenu`). Cada cambio queda en la auditoría.
 *
 * ── Dos personas ordenando a la vez ───────────────────────────────────────────────────────────
 * La pantalla manda también el orden que VIO (`antes`). Si lo guardado ya no es ése, alguien más
 * ordenó entre tanto: se rechaza con `CONFIGURACION_CONFLICTO` y la pantalla se vuelve a leer, en
 * vez de pisar el trabajo de la otra persona con un orden viejo.
 */

const ROLES = ['dueno', 'administrador', 'gerente'] as const;

const ids = (max: number) => z.array(z.uuid()).min(1).max(max);

export const entradaOrdenarCategorias = z.object({
  /** TODAS las categorías de producto activas, en el orden nuevo. */
  categoriaIds: ids(200),
  /** El orden que la pantalla vio al abrir (para detectar que otra persona ordenó). */
  antes: z.array(z.uuid()).max(200).optional(),
});

export const entradaOrdenarProductos = z.object({
  categoriaId: z.uuid(),
  /** TODOS los productos activos de la categoría, en el orden nuevo. */
  productoIds: ids(500),
  antes: z.array(z.uuid()).max(500).optional(),
});

/**
 * DP-25 · Parte 8 · DP-D227 · Dónde se ve un platillo: `visible` es el portal QR
 * (`visible_en_menu_digital`) y `visibleEnPos` el mesero y la Caja (`visible_en_pos`). Cada uno
 * es independiente; se manda al menos uno, y «ocultar de todo» manda los dos.
 */
export const entradaMostrarEnMenu = z
  .object({
    productoId: z.uuid(),
    visible: z.boolean().optional(),
    visibleEnPos: z.boolean().optional(),
  })
  .refine((e) => e.visible !== undefined || e.visibleEnPos !== undefined, {
    message: 'Di dónde se ve el platillo: en el portal, en el POS o en los dos.',
  });

const CONFLICTO =
  'Alguien más cambió el orden del menú mientras lo ordenabas. Se volvió a leer: revísalo y vuelve a ordenar.';

function exigirLosMismos(nuevos: readonly string[], actuales: readonly string[], que: string) {
  const unicos = new Set(nuevos);
  const mismos =
    unicos.size === nuevos.length &&
    nuevos.length === actuales.length &&
    actuales.every((id) => unicos.has(id));
  if (!mismos) {
    throw new ErrorDominio(
      'CATALOGO_INVALIDO',
      `El orden debe incluir exactamente ${que}, cada uno una sola vez.`,
    );
  }
}

function exigirSinConflicto(antes: readonly string[] | undefined, actuales: readonly string[]) {
  if (antes !== undefined && !mismoOrden(antes, actuales)) {
    throw new ErrorDominio('CONFIGURACION_CONFLICTO', CONFLICTO);
  }
}

export interface ResultadoOrden {
  readonly cambiados: number;
  readonly orden: readonly string[];
}

export const ordenarCategoriasDelMenu = definirComando<
  Transaccion,
  typeof entradaOrdenarCategorias,
  ResultadoOrden
>({
  nombre: 'catalogo.ordenar_categorias',
  entidad: 'categoria',
  escribe: true,
  roles: [...ROLES],
  paquetes: PAQUETES_OPERATIVOS,
  entrada: entradaOrdenarCategorias,
  async ejecutar(ctx, entrada) {
    const { organizacionId } = ctx.ambito;
    const filas = await ctx.paso('bloquear_categorias', () =>
      ctx.tx
        .selectFrom('categorias')
        .select(['id', 'nombre', 'orden'])
        .where('organizacion_id', '=', organizacionId)
        .where('tipo', '=', 'producto')
        .where('activa', '=', true)
        .forUpdate()
        .execute(),
    );
    const actuales = ordenarCategorias(filas);
    const idsActuales = actuales.map((c) => c.id);
    exigirSinConflicto(entrada.antes, idsActuales);
    exigirLosMismos(entrada.categoriaIds, idsActuales, 'todas las categorías activas');

    const lugarActual = new Map(filas.map((c) => [c.id, c.orden]));
    let cambiados = 0;
    for (const [indice, id] of entrada.categoriaIds.entries()) {
      const lugar = indice + 1;
      if (lugarActual.get(id) === lugar) continue;
      cambiados += 1;
      await ctx.paso(`ordenar_${id}`, () =>
        ctx.tx
          .updateTable('categorias')
          .set({ orden: lugar, updated_at: ctx.ahora })
          .where('organizacion_id', '=', organizacionId)
          .where('id', '=', id)
          .execute(),
      );
    }
    // Nada cambió: ni auditoría ni clave de idempotencia (un guion que se repite no llena el rastro).
    if (cambiados === 0) throw new SinNovedad({ cambiados, orden: entrada.categoriaIds });
    ctx.auditar({
      entidadId: null,
      payload: { que: 'categorias', antes: idsActuales, despues: entrada.categoriaIds, cambiados },
    });
    return { cambiados, orden: entrada.categoriaIds };
  },
});

export const ordenarProductosDeLaCategoria = definirComando<
  Transaccion,
  typeof entradaOrdenarProductos,
  ResultadoOrden
>({
  nombre: 'catalogo.ordenar_productos',
  entidad: 'categoria',
  escribe: true,
  roles: [...ROLES],
  paquetes: PAQUETES_OPERATIVOS,
  entrada: entradaOrdenarProductos,
  async ejecutar(ctx, entrada) {
    const { organizacionId } = ctx.ambito;
    const categoria = await ctx.paso('verificar_categoria', () =>
      ctx.tx
        .selectFrom('categorias')
        .select('id')
        .where('organizacion_id', '=', organizacionId)
        .where('id', '=', entrada.categoriaId)
        .where('tipo', '=', 'producto')
        .executeTakeFirst(),
    );
    if (categoria === undefined) {
      throw new ErrorDominio('CATALOGO_INVALIDO', 'Esa categoría ya no existe.');
    }
    const filas = await ctx.paso('bloquear_productos', () =>
      ctx.tx
        .selectFrom('productos')
        .select(['id', 'nombre', 'categoria_id', 'orden_en_categoria'])
        .where('organizacion_id', '=', organizacionId)
        .where('categoria_id', '=', entrada.categoriaId)
        .where('activo', '=', true)
        .forUpdate()
        .execute(),
    );
    const idsActuales = ordenarMenu(filas, [{ id: entrada.categoriaId, orden: 0 }]).map(
      (p) => p.id,
    );
    exigirSinConflicto(entrada.antes, idsActuales);
    exigirLosMismos(entrada.productoIds, idsActuales, 'todos los productos de la categoría');

    const lugarActual = new Map(filas.map((p) => [p.id, p.orden_en_categoria]));
    let cambiados = 0;
    for (const [indice, id] of entrada.productoIds.entries()) {
      const lugar = indice + 1;
      if (lugarActual.get(id) === lugar) continue;
      cambiados += 1;
      await ctx.paso(`ordenar_${id}`, () =>
        ctx.tx
          .updateTable('productos')
          .set({ orden_en_categoria: lugar, updated_at: ctx.ahora })
          .where('organizacion_id', '=', organizacionId)
          .where('id', '=', id)
          .execute(),
      );
    }
    if (cambiados === 0) throw new SinNovedad({ cambiados, orden: entrada.productoIds });
    ctx.auditar({
      entidadId: entrada.categoriaId,
      payload: { que: 'productos', antes: idsActuales, despues: entrada.productoIds, cambiados },
    });
    return { cambiados, orden: entrada.productoIds };
  },
});

export interface ResultadoMostrar {
  readonly productoId: string;
  readonly visible: boolean;
  readonly visibleEnPos: boolean;
  readonly cambio: boolean;
}

export const mostrarProductoEnElMenu = definirComando<
  Transaccion,
  typeof entradaMostrarEnMenu,
  ResultadoMostrar
>({
  nombre: 'catalogo.mostrar_en_menu',
  entidad: 'producto',
  escribe: true,
  roles: [...ROLES],
  paquetes: PAQUETES_OPERATIVOS,
  entrada: entradaMostrarEnMenu,
  async ejecutar(ctx, entrada) {
    const { organizacionId } = ctx.ambito;
    const producto = await ctx.paso('bloquear_producto', () =>
      ctx.tx
        .selectFrom('productos')
        .select(['id', 'nombre', 'visible_en_menu_digital', 'visible_en_pos'])
        .where('organizacion_id', '=', organizacionId)
        .where('id', '=', entrada.productoId)
        .where('activo', '=', true)
        .forUpdate()
        .executeTakeFirst(),
    );
    if (producto === undefined) {
      throw new ErrorDominio(
        'PRODUCTO_NO_ENCONTRADO',
        'Ese producto no existe o está dado de baja.',
      );
    }
    // Lo que la entrada no menciona se queda como está: cada lugar es independiente.
    const portal = entrada.visible ?? producto.visible_en_menu_digital;
    const pos = entrada.visibleEnPos ?? producto.visible_en_pos;
    const resultado = { productoId: producto.id, visible: portal, visibleEnPos: pos };
    if (portal === producto.visible_en_menu_digital && pos === producto.visible_en_pos) {
      throw new SinNovedad({ ...resultado, cambio: false });
    }
    await ctx.paso('escribir_visible', () =>
      ctx.tx
        .updateTable('productos')
        .set({ visible_en_menu_digital: portal, visible_en_pos: pos, updated_at: ctx.ahora })
        .where('organizacion_id', '=', organizacionId)
        .where('id', '=', producto.id)
        .execute(),
    );
    ctx.auditar({
      entidadId: producto.id,
      payload: {
        nombre: producto.nombre,
        portal: { antes: producto.visible_en_menu_digital, despues: portal },
        pos: { antes: producto.visible_en_pos, despues: pos },
      },
    });
    return { ...resultado, cambio: true };
  },
});
