import 'server-only';

import { ErrorDominio } from '@morphiqpos/contracts';
import type { Transaccion } from '@morphiqpos/data';
import { opcionesQueDejanSinPrecio, type GrupoParaRevisar } from '@morphiqpos/domain/catalogo';

/**
 * DP-18 · M6 · Antes de dejar guardado un grupo de opciones (o su asignación a un platillo), cada
 * platillo que lo usa se revisa: lo que pueden restar las opciones elegibles juntas no puede llegar
 * a su precio. La regla vive en `@morphiqpos/domain/catalogo` (`opcionesQueDejanSinPrecio`), la misma
 * que usa el editor. Si se rompe, `OPCION_DEJA_SIN_PRECIO` y la transacción no guarda nada.
 *
 * El precio más chico de un renglón: la pieza; la porción; o, en lo que va por peso, el peso más
 * chico que se vende (su presentación más chica o su mínimo). Sin presentaciones ni mínimo no hay
 * un piso que revisar aquí: lo cuida la venta (`precioConLasOpciones`).
 */

interface FilaDelPlatillo {
  readonly id: string;
  readonly nombre: string;
  readonly tipo_venta: string;
  readonly precio_venta_centavos: bigint;
  readonly precio_por_unidad_variable_centavos: bigint | null;
  readonly cantidad_minima_variable: string | null;
  readonly precio_por_porcion_centavos: bigint | null;
  readonly presets_variable: unknown;
  readonly solo_presets_variable: boolean;
}

function pesoMasChico(p: FilaDelPlatillo): number | null {
  const presets = Array.isArray(p.presets_variable)
    ? p.presets_variable.map(Number).filter((n) => Number.isFinite(n) && n > 0)
    : [];
  const minimo =
    p.cantidad_minima_variable === null ? Number.NaN : Number(p.cantidad_minima_variable);
  const candidatos = p.solo_presets_variable && presets.length > 0 ? presets : [...presets, minimo];
  const validos = candidatos.filter((n) => Number.isFinite(n) && n > 0);
  return validos.length === 0 ? null : Math.min(...validos);
}

/** Lo menos que cuesta un renglón del platillo sin opciones, o `null` si no hay un piso que revisar. */
export function precioMinimoDelRenglon(p: FilaDelPlatillo): bigint | null {
  if (p.tipo_venta === 'porcion_contenedor') return p.precio_por_porcion_centavos;
  if (p.tipo_venta === 'variable_medida') {
    const peso = pesoMasChico(p);
    const porUnidad = p.precio_por_unidad_variable_centavos ?? p.precio_venta_centavos;
    return peso === null ? null : BigInt(Math.round(Number(porUnidad) * peso));
  }
  return p.precio_venta_centavos;
}

async function gruposDelPlatillo(
  tx: Transaccion,
  organizacionId: string,
  productoId: string,
): Promise<GrupoParaRevisar[]> {
  const grupos = await tx
    .selectFrom('producto_modificadores as pm')
    .innerJoin('modificadores as m', 'm.id', 'pm.modificador_id')
    .select([
      'm.id',
      'm.nombre',
      'm.tipo',
      'm.obligatorio',
      'm.minimo_elecciones',
      'm.maximo_elecciones',
    ])
    .where('pm.organizacion_id', '=', organizacionId)
    .where('pm.producto_id', '=', productoId)
    .where('m.activo', '=', true)
    .execute();
  if (grupos.length === 0) return [];
  const opciones = await tx
    .selectFrom('modificador_opciones')
    .select(['modificador_id', 'nombre', 'delta_precio_centavos', 'activa'])
    .where(
      'modificador_id',
      'in',
      grupos.map((g) => g.id),
    )
    .execute();
  return grupos.map((g) => ({
    nombre: g.nombre,
    tipo: g.tipo === 'multiple' ? 'multiple' : 'unica',
    obligatorio: g.obligatorio,
    minimo: g.minimo_elecciones,
    maximo: g.maximo_elecciones,
    opciones: opciones
      .filter((o) => o.modificador_id === g.id)
      .map((o) => ({
        nombre: o.nombre,
        deltaCentavos: BigInt(o.delta_precio_centavos),
        activa: o.activa,
      })),
  }));
}

/** Lanza `OPCION_DEJA_SIN_PRECIO` si algún platillo de la lista podría quedar en $0 o menos. */
export async function exigirQueNoQuedenSinPrecio(
  tx: Transaccion,
  organizacionId: string,
  productoIds: readonly string[],
): Promise<void> {
  if (productoIds.length === 0) return;
  const platillos = (await tx
    .selectFrom('productos')
    .select([
      'id',
      'nombre',
      'tipo_venta',
      'precio_venta_centavos',
      'precio_por_unidad_variable_centavos',
      'cantidad_minima_variable',
      'precio_por_porcion_centavos',
      'presets_variable',
      'solo_presets_variable',
    ])
    .where('organizacion_id', '=', organizacionId)
    .where('id', 'in', [...productoIds])
    .execute()) as FilaDelPlatillo[];
  for (const p of platillos) {
    const piso = precioMinimoDelRenglon(p);
    if (piso === null) continue;
    const motivo = opcionesQueDejanSinPrecio(
      { nombre: p.nombre, precioMinimoCentavos: piso },
      await gruposDelPlatillo(tx, organizacionId, p.id),
    );
    if (motivo !== null)
      throw new ErrorDominio('OPCION_DEJA_SIN_PRECIO', motivo, { productoId: p.id });
  }
}

/** Los platillos que usan el grupo (para revisarlos todos al cambiarlo). */
export async function platillosDelGrupo(
  tx: Transaccion,
  organizacionId: string,
  grupoId: string,
): Promise<string[]> {
  const filas = await tx
    .selectFrom('producto_modificadores')
    .select('producto_id')
    .where('organizacion_id', '=', organizacionId)
    .where('modificador_id', '=', grupoId)
    .execute();
  return filas.map((f) => f.producto_id);
}
