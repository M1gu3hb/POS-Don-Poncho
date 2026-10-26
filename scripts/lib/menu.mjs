/**
 * EL MENÚ DE UN RESTAURANTE, de su archivo de datos a las entradas de los comandos.
 *
 * La parte PURA de `scripts/cargar-menu.mjs`: valida el archivo y arma, producto por producto,
 * lo que se le manda a `catalogo.crear_producto` y a `catalogo.guardar_modificadores`. Vive
 * aparte para probarse sin base de datos (`menu.test.ts`); el guion sólo pone la conexión.
 *
 * Reglas que salen del encargo de Don Poncho (DP-5) y se comprueban aquí:
 *   · el dinero viaja en CENTAVOS enteros en el archivo y como texto exacto al comando
 *     (`desdeTexto` lo vuelve a centavos sin pasar por coma flotante);
 *   · todo platillo nace con RECETA PENDIENTE: estrategia `receta` y cero renglones de
 *     receta. Se vende, no descuenta inventario y su costo es desconocido, no $0;
 *   · lo que se vende por peso (la barbacoa) es `variable_medida` en kg, con sus atajos;
 *   · un sabor o un relleno es una opción sin precio: en el restaurante el modificador
 *     viaja como nota y NO cobra (los de pago son la tarea E9-3 del maestro).
 */

/** Máximo de opciones por grupo que acepta `catalogo.guardar_modificadores`. */
export const MAXIMO_DE_OPCIONES = 30;

/** Las áreas que generan comanda (`restaurante/estaciones.ts`, `areasDe`). `ninguno` no comanda. */
const AREAS_QUE_COMANDAN = new Set(['cocina', 'barra', 'ambos']);

/** Las unidades por peso que entiende el catálogo para vender a granel. */
const UNIDADES_POR_PESO = new Set(['kg', 'g', 'l', 'ml']);

/** Centavos enteros → el texto exacto que esperan los comandos: 79500 → «795.00». */
export function pesos(centavos) {
  if (!Number.isSafeInteger(centavos) || centavos < 0) {
    throw new Error(`Importe inválido: ${String(centavos)} (se esperan centavos enteros).`);
  }
  const texto = String(centavos).padStart(3, '0');
  return `${texto.slice(0, -2)}.${texto.slice(-2)}`;
}

function esCentavos(valor) {
  return Number.isSafeInteger(valor) && valor > 0;
}

function problemasDelProducto(menu, categoria, producto, vistos) {
  const problemas = [];
  const donde = `«${producto.nombre}» (${categoria.nombre})`;
  if (typeof producto.nombre !== 'string' || producto.nombre.trim() === '') {
    return [`Producto sin nombre en ${categoria.nombre}.`];
  }
  const clave = producto.nombre.trim().toLocaleLowerCase('es-MX');
  if (vistos.has(clave)) problemas.push(`${donde} está repetido.`);
  vistos.add(clave);
  if (!esCentavos(producto.precio)) problemas.push(`${donde}: el precio no son centavos enteros.`);
  if (producto.porPeso !== undefined) {
    if (!UNIDADES_POR_PESO.has(producto.porPeso.unidad)) {
      problemas.push(`${donde}: unidad de peso desconocida «${producto.porPeso.unidad}».`);
    }
    const atajos = producto.porPeso.presets ?? [];
    if (!atajos.every((a) => typeof a === 'number' && a > 0)) {
      problemas.push(`${donde}: los atajos de peso deben ser cantidades positivas.`);
    }
  }
  const grupos = new Set(menu.modificadores.map((g) => g.clave));
  for (const clave of producto.modificadores ?? []) {
    if (!grupos.has(clave)) problemas.push(`${donde}: el grupo «${clave}» no existe.`);
  }
  return problemas;
}

/** Todo lo que está mal en el archivo, en palabras. Vacío quiere decir que se puede cargar. */
export function validarMenu(menu) {
  const problemas = [];
  if (!Number.isSafeInteger(menu.version) || menu.version < 1) {
    problemas.push('El menú no declara su `version` (entero desde 1).');
  }
  if (menu.moneda !== 'MXN') problemas.push(`Moneda inesperada: ${String(menu.moneda)}.`);
  const estaciones = new Set(menu.estaciones);
  for (const estacion of menu.estaciones) {
    if (!AREAS_QUE_COMANDAN.has(menu.areaPorEstacion?.[estacion])) {
      problemas.push(`La estación «${estacion}» no dice a qué área comanda (cocina o barra).`);
    }
  }
  for (const grupo of menu.modificadores) {
    if (grupo.opciones.length === 0 || grupo.opciones.length > MAXIMO_DE_OPCIONES) {
      problemas.push(`El grupo «${grupo.clave}» tiene ${grupo.opciones.length} opciones.`);
    }
    if (grupo.opciones.some(([, precio]) => precio !== 0)) {
      problemas.push(`El grupo «${grupo.clave}» tiene opciones con precio: no se cobrarían.`);
    }
  }
  const vistos = new Set();
  for (const categoria of menu.categorias) {
    if (!estaciones.has(categoria.estacion)) {
      problemas.push(`La categoría «${categoria.nombre}» va a una estación que no existe.`);
    }
    for (const producto of categoria.productos) {
      problemas.push(...problemasDelProducto(menu, categoria, producto, vistos));
    }
  }
  return problemas;
}

/** La descripción que se ve en el catálogo: el detalle del menú o, en licores, «Copa». */
function descripcionDe(categoria, producto) {
  if (producto.detalle !== undefined) return producto.detalle;
  return categoria.copa === true ? 'Copa' : undefined;
}

/** La entrada de `catalogo.crear_producto` para un producto del menú. */
export function entradaDelProducto(categoria, producto, categoriaId) {
  const descripcion = descripcionDe(categoria, producto);
  const comun = {
    nombre: producto.nombre.trim(),
    ...(descripcion === undefined ? {} : { descripcion }),
    categoriaId,
    costoUnitario: '0',
    estrategiaConsumo: 'receta',
    permiteVentaSinStock: true,
    stockMinimo: '0',
    visibleEnPos: true,
  };
  if (producto.porPeso === undefined) {
    return {
      ...comun,
      precioVenta: pesos(producto.precio),
      tipoVenta: 'precio_fijo',
      unidadVenta: 'pieza',
    };
  }
  return {
    ...comun,
    precioVenta: pesos(producto.precio),
    tipoVenta: 'variable_medida',
    unidadVenta: producto.porPeso.unidad,
    unidadVariable: producto.porPeso.unidad,
    precioVariable: pesos(producto.precio),
  };
}

/**
 * El área de preparación de los productos de una categoría: la de su estación. Sin ella el
 * producto nace en `ninguno` y **no genera comanda**: el mesero lo pide y la cocina no se entera.
 */
export function areaDeLaCategoria(menu, categoria) {
  const area = menu.areaPorEstacion?.[categoria.estacion];
  if (!AREAS_QUE_COMANDAN.has(area)) {
    throw new Error(`La estación «${categoria.estacion}» no tiene área que comande.`);
  }
  return area;
}

/** Los atajos de cantidad de lo que se vende por peso (¼, ½, 1 kg), o `null` si no lleva. */
export function atajosDelProducto(producto) {
  const atajos = producto.porPeso?.presets ?? [];
  return atajos.length === 0 ? null : [...atajos];
}

/**
 * Los grupos de opciones de un producto, como los pide `catalogo.guardar_modificadores`.
 * Una opción de temporada (tercer valor `true`) entra prendida: el dueño la apaga cuando se
 * acaba la temporada, sin borrarla.
 */
export function gruposDelProducto(menu, producto) {
  const porClave = new Map(menu.modificadores.map((g) => [g.clave, g]));
  return (producto.modificadores ?? []).map((clave) => {
    const grupo = porClave.get(clave);
    if (grupo === undefined) throw new Error(`El grupo «${clave}» no existe.`);
    return {
      nombre: grupo.nombre,
      obligatorio: grupo.obligatorio === true,
      tipo: 'unica',
      activo: true,
      opciones: grupo.opciones.map(([nombre, precio]) => ({
        nombre,
        precioExtra: pesos(precio),
        activa: true,
      })),
    };
  });
}

/** Cuántas cosas trae el archivo, para el resumen del guion y del reporte. */
export function resumenDelMenu(menu) {
  const productos = menu.categorias.flatMap((c) => c.productos);
  return {
    estaciones: menu.estaciones.length,
    categorias: menu.categorias.length,
    productos: productos.length,
    porPeso: productos.filter((p) => p.porPeso !== undefined).length,
    conOpciones: productos.filter((p) => (p.modificadores ?? []).length > 0).length,
  };
}
