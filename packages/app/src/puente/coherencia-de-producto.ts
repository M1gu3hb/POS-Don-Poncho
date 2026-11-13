import { ErrorDominio } from '@morphiqpos/contracts';
import { calcularMlPorPorcion, cantidadATexto } from '@morphiqpos/domain/catalogo';

/**
 * LA COHERENCIA DE UN PRODUCTO ESCRITO POR EL PUENTE (DP-18 · A2 y A3).
 *
 * Crear o editar un producto desde las pantallas viejas pasa por la escritura genérica del
 * puente, que sólo traduce campos. Eso dejaba dos huecos que la base destapaba tarde y mal:
 *
 *   · A2 · un producto «por porción» sin `ml_por_porcion` (la pantalla lo deja «auto») o un
 *     producto por medida con `unidad_variable: ''` rompía un `check` de la base: 500, sin un
 *     mensaje que se entienda. Aquí se rechaza ANTES, con su mensaje, o se deriva lo derivable.
 *   · A3 · el producto por peso o por porción nacía con la estrategia de consumo `sku` (el
 *     valor por omisión de la columna) y `inventario.guardar_receta`, que la pantalla llama
 *     siempre al guardar, la dejaba en `sku` al no haber líneas. Resultado: se vendía y NO
 *     bajaba el «Ingrediente base». La estrategia correcta se DEDUCE del tipo de venta y del
 *     ingrediente base, también para un cliente viejo que no la manda.
 *
 * Pura y sin base de datos, para probarse y mutarse sola. Opera sobre COLUMNAS (lo que ya
 * salió de `aColumnas`), no sobre el vocabulario de la pantalla.
 */

type Fila = Record<string, unknown>;

/** Las columnas que, si una edición las toca, obligan a revisar el conjunto. */
export const COLUMNAS_DE_COHERENCIA = [
  'tipo_venta',
  'unidad_variable',
  'precio_por_unidad_variable_centavos',
  'capacidad_contenedor_ml',
  'porciones_por_contenedor',
  'ml_por_porcion',
  'precio_por_porcion_centavos',
  'insumo_base_id',
  'estrategia_consumo',
] as const;

const UNIDADES_VARIABLE: readonly string[] = ['kg', 'g', 'l', 'ml', 'm'];

/** Lo que vale una fila nueva que no dijo nada: los valores por omisión de la base. */
export const PRODUCTO_NUEVO: Fila = { tipo_venta: 'precio_fijo', estrategia_consumo: 'sku' };

function textoOVacio(valor: unknown): string | null {
  if (typeof valor !== 'string' && typeof valor !== 'number' && typeof valor !== 'bigint') {
    return null;
  }
  const texto = String(valor).trim();
  return texto === '' ? null : texto;
}

/**
 * La estrategia de consumo que le toca a un producto.
 *
 *   · por medida o por porción CON ingrediente base → `insumo_base` (baja ese insumo);
 *   · con receta (`receta`) se respeta: la barbacoa por kilo baja sus ingredientes;
 *   · `insumo_base` sin ingrediente base, o en un producto de precio fijo, es una estrategia
 *     que no tiene con qué cumplirse (la base lo prohíbe sin insumo): vuelve a `sku`.
 *   · lo demás —`sku`, `ninguno`— se queda como está.
 */
export function estrategiaDeConsumo(producto: Readonly<Record<string, unknown>>): string {
  const actual = textoOVacio(producto['estrategia_consumo']) ?? 'sku';
  const porMedida = producto['tipo_venta'] === 'variable_medida';
  const porPorcion = producto['tipo_venta'] === 'porcion_contenedor';
  const conBase = textoOVacio(producto['insumo_base_id']) !== null;
  if (actual === 'receta' || actual === 'ninguno') return actual;
  if ((porMedida || porPorcion) && conBase) return 'insumo_base';
  if (actual === 'insumo_base') return 'sku';
  return actual;
}

/**
 * Cuadra la fila que se va a escribir: `actual` es lo que ya hay (o `PRODUCTO_NUEVO`) y `cambios`
 * lo que la petición trae. Devuelve las columnas a escribir —las de la petición más lo que se
 * deriva— o lanza un `ErrorDominio` (422) con el motivo en español.
 */
export function cuadrarProducto(actual: Fila, cambios: Fila): Fila {
  const salida: Fila = { ...cambios };
  const final: Fila = { ...actual, ...cambios };
  const tipo = final['tipo_venta'];

  // Una unidad en blanco no es una unidad: «sin dato». Por medida es obligatoria; en cualquier
  // otro tipo no significa nada y se guarda como nula (la pantalla la manda '' al cambiar de tipo).
  if ('unidad_variable' in cambios) {
    const unidad = textoOVacio(cambios['unidad_variable']);
    salida['unidad_variable'] = unidad;
    final['unidad_variable'] = unidad;
  }
  const unidad = textoOVacio(final['unidad_variable']);
  if (unidad !== null && !UNIDADES_VARIABLE.includes(unidad)) {
    throw new ErrorDominio(
      'CATALOGO_INVALIDO',
      `La unidad «${unidad}» no es válida: usa kg, g, l, ml o m.`,
    );
  }

  if (tipo === 'variable_medida') {
    if (unidad === null) {
      throw new ErrorDominio(
        'CATALOGO_INVALIDO',
        'Un producto por medida necesita su unidad (kg, g, l, ml o m).',
      );
    }
    if (final['precio_por_unidad_variable_centavos'] == null) {
      throw new ErrorDominio(
        'CATALOGO_INVALIDO',
        'Un producto por medida necesita su precio por unidad.',
      );
    }
  }

  if (tipo === 'porcion_contenedor') {
    const capacidad = textoOVacio(final['capacidad_contenedor_ml']);
    if (capacidad === null) {
      throw new ErrorDominio(
        'CATALOGO_INVALIDO',
        'Un producto por porción necesita la capacidad del contenedor (ml).',
      );
    }
    if (final['precio_por_porcion_centavos'] == null) {
      throw new ErrorDominio('CATALOGO_INVALIDO', 'Un producto por porción necesita su precio.');
    }
    const ml = textoOVacio(final['ml_por_porcion']);
    const porciones = textoOVacio(final['porciones_por_contenedor']);
    if (ml === null && porciones === null) {
      throw new ErrorDominio(
        'CATALOGO_INVALIDO',
        'Define los ml por porción o cuántas porciones trae el contenedor.',
      );
    }
    // La medida explícita manda; si falta, se deriva de capacidad ÷ porciones. La base exige el
    // dato guardado (`producto_porcion_completo`) y el cobro lo usa para saber cuánto baja.
    const mlPorPorcion = calcularMlPorPorcion({
      capacidadMl: capacidad,
      ...(ml === null ? {} : { mlPorPorcion: ml }),
      ...(porciones === null ? {} : { porcionesPorContenedor: porciones }),
    });
    const texto = cantidadATexto(mlPorPorcion);
    salida['ml_por_porcion'] = texto;
    final['ml_por_porcion'] = texto;
  }

  const estrategia = estrategiaDeConsumo(final);
  if (estrategia !== final['estrategia_consumo'] || 'estrategia_consumo' in cambios) {
    salida['estrategia_consumo'] = estrategia;
  }
  return salida;
}
