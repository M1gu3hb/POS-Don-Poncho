/**
 * Lo que `ordenar-menu-produccion.mjs` LEE del negocio: categorías, productos, estaciones, grupos de
 * opciones y sus asignaciones, y cuántas cuentas abiertas traen cada producto «(extra)». Sólo lectura.
 */

const { estacionSiLaHay } = await import('../../packages/app/src/restaurante/estaciones.ts');
const { ORDEN_ACTIVA } = await import('../../packages/app/src/portal/estados.ts');

export async function leerElMenu(db, organizacionId) {
  const categorias = await db
    .selectFrom('categorias')
    .select(['id', 'nombre', 'color', 'activa', 'orden', 'estacion_preparacion_id'])
    .where('organizacion_id', '=', organizacionId)
    .where('tipo', '=', 'producto')
    .execute();
  const productos = await db
    .selectFrom('productos')
    .select(['id', 'nombre', 'categoria_id', 'activo', 'area_preparacion', 'orden_en_categoria'])
    .where('organizacion_id', '=', organizacionId)
    .execute();
  const estaciones = await db
    .selectFrom('estaciones_preparacion')
    .select(['id', 'nombre', 'color', 'es_general as esGeneral'])
    .where('organizacion_id', '=', organizacionId)
    .where('activa', '=', true)
    .orderBy('orden')
    .execute();
  const grupos = await db
    .selectFrom('modificadores')
    .select(['id', 'nombre', 'tipo', 'obligatorio', 'activo'])
    .where('organizacion_id', '=', organizacionId)
    .execute();
  const opciones = await db
    .selectFrom('modificador_opciones as o')
    .innerJoin('modificadores as m', 'm.id', 'o.modificador_id')
    .select(['o.modificador_id', 'o.nombre', 'o.orden', 'o.activa', 'o.delta_precio_centavos'])
    .where('m.organizacion_id', '=', organizacionId)
    .orderBy('o.orden')
    .execute();
  const asignaciones = await db
    .selectFrom('producto_modificadores')
    .select(['producto_id', 'modificador_id', 'orden'])
    .where('organizacion_id', '=', organizacionId)
    .orderBy('orden')
    .execute();
  const lineasAbiertas = await db
    .selectFrom('orden_lineas as l')
    .innerJoin('ordenes as o', 'o.id', 'l.orden_id')
    .select(['l.producto_id'])
    .where('o.organizacion_id', '=', organizacionId)
    .where('o.estado', 'in', [...ORDEN_ACTIVA])
    .where('l.anulada_en', 'is', null)
    .execute();
  const enCuentasAbiertas = new Map();
  for (const { producto_id: id } of lineasAbiertas) {
    if (id !== null) enCuentasAbiertas.set(id, (enCuentasAbiertas.get(id) ?? 0) + 1);
  }
  return {
    organizacionId,
    categorias,
    productos,
    estaciones,
    grupos: grupos.map((g) => ({
      ...g,
      opciones: opciones
        .filter((o) => o.modificador_id === g.id)
        .map((o) => ({
          nombre: o.nombre,
          activa: o.activa,
          centavos: Number(o.delta_precio_centavos),
        })),
    })),
    asignaciones,
    enCuentasAbiertas,
  };
}

/**
 * A qué estación llega la comanda de cada producto: su área (cocina/barra) y la estación de su
 * categoría (o la general). Es lo que NO puede cambiar al mover un platillo de categoría.
 */
export function estacionDeCadaProducto(estado) {
  const porCategoria = new Map(estado.categorias.map((c) => [c.id, c]));
  return new Map(
    estado.productos.map((p) => {
      const categoria = porCategoria.get(p.categoria_id);
      const estacion = estacionSiLaHay(
        categoria?.estacion_preparacion_id ?? null,
        estado.estaciones,
      );
      return [p.id, `${p.area_preparacion}|${estacion?.id ?? 'ninguna'}`];
    }),
  );
}

/** La estación (id) a la que llegaría un platillo de esa categoría. */
export function estacionDeLaCategoria(estado, categoriaId) {
  const categoria = estado.categorias.find((c) => c.id === categoriaId);
  return estacionSiLaHay(categoria?.estacion_preparacion_id ?? null, estado.estaciones)?.id ?? null;
}
