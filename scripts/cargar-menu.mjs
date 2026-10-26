#!/usr/bin/env node
/**
 * Carga el menú de un restaurante POR LOS COMANDOS DE LA APLICACIÓN (DP-5).
 *
 *   node --conditions=react-server scripts/cargar-menu.mjs --org don-poncho \
 *     --persona "Miguel · Morphiq" [--menu docs/cliente/menu-don-poncho.json] [--ensayo]
 *
 * Nada de SQL suelto: cada estación, categoría, producto y grupo de opciones entra por su
 * comando —`restaurante.crear_estacion`, `puente.escribir`, `catalogo.crear_producto`,
 * `catalogo.guardar_modificadores`— con su rol, su transacción y su renglón de auditoría,
 * firmado por el dueño que se nombra con `--persona`.
 *
 * IDEMPOTENTE, por dos caminos: lo que ya existe con ese nombre no se toca (ni se pisa lo
 * que el dueño haya editado después), y cada escritura lleva una clave de idempotencia
 * estable —versión del menú, negocio, tipo y nombre—, así que dos corridas dejan lo mismo
 * que una. `--ensayo` lee y dice qué haría, sin escribir.
 *
 * Sólo corre contra Don Poncho o un restaurante de prueba, por ID: un negocio ajeno de la
 * base compartida se rechaza antes de tocar nada.
 */
import { existsSync, readFileSync } from 'node:fs';

import {
  areaDeLaCategoria,
  atajosDelProducto,
  entradaDelProducto,
  gruposDelProducto,
  resumenDelMenu,
  validarMenu,
} from './lib/menu.mjs';

for (const linea of (existsSync('.env') ? readFileSync('.env', 'utf8') : '').split('\n')) {
  const encontrado = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(linea.trim());
  if (encontrado !== null && process.env[encontrado[1]] === undefined) {
    process.env[encontrado[1]] = encontrado[2].replace(/^["']|["']$/g, '');
  }
}
process.env['MORPHIQPOS_DB_POOL_MAX'] ??= '3';

function argumento(nombre, porOmision = null) {
  const i = process.argv.indexOf(`--${nombre}`);
  return i === -1 ? porOmision : (process.argv[i + 1] ?? porOmision);
}

const slug = argumento('org');
const persona = argumento('persona');
const rutaDelMenu = argumento('menu', 'docs/cliente/menu-don-poncho.json');
const ensayo = process.argv.includes('--ensayo');
if (slug === null || persona === null) {
  console.error('Uso: cargar-menu.mjs --org <slug> --persona "<dueño>" [--menu <json>] [--ensayo]');
  process.exit(2);
}

const menu = JSON.parse(readFileSync(rutaDelMenu, 'utf8'));
const problemas = validarMenu(menu);
if (problemas.length > 0) {
  console.error(`✗ El menú no se carga:\n  · ${problemas.join('\n  · ')}`);
  process.exit(1);
}

const { NEGOCIOS_REALES, NEGOCIOS_DE_PRUEBA, negocioAjeno } =
  await import('../packages/contracts/src/negocios/index.ts');
const { obtenerDb } = await import('../packages/data/src/cliente.ts');
const { comando } = await import('../packages/app/src/produccion.ts');
const { crearProducto, guardarModificadores } =
  await import('../packages/app/src/catalogo/index.ts');
const { crearEstacion } = await import('../packages/app/src/restaurante/index.ts');
const { escribirDatos } = await import('../packages/app/src/puente/comandos.ts');

const permitido = [...NEGOCIOS_REALES, ...NEGOCIOS_DE_PRUEBA].find((n) => n.slug === slug);
if (negocioAjeno(slug) !== null || permitido === undefined) {
  console.error(`✗ «${slug}» no es Don Poncho ni un restaurante de prueba: no se toca.`);
  process.exit(1);
}

const db = obtenerDb();
const org = await db
  .selectFrom('organizaciones')
  .select(['id', 'slug'])
  .where('id', '=', permitido.id)
  .where('slug', '=', slug)
  .executeTakeFirst();
if (org === undefined) {
  console.error(`✗ «${slug}» no está dado de alta en esta base (\`db:alta-negocio\`).`);
  process.exit(1);
}

const actor = await db
  .selectFrom('empleos')
  .innerJoin('personas', 'personas.id', 'empleos.persona_id')
  .innerJoin('identidades', 'identidades.persona_id', 'personas.id')
  .select(['empleos.id as empleoId', 'identidades.id as identidadId', 'empleos.sucursal_id'])
  .where('empleos.organizacion_id', '=', org.id)
  .where('empleos.rol', '=', 'dueno')
  .where('empleos.activo', '=', true)
  .where('personas.nombre', '=', persona)
  .executeTakeFirst();
const sucursal = await db
  .selectFrom('sucursales')
  .select('id')
  .where('organizacion_id', '=', org.id)
  .orderBy('created_at', 'asc')
  .executeTakeFirst();
if (actor === undefined || sucursal === undefined) {
  console.error(
    `✗ «${persona}» no es un dueño activo de «${slug}», o el negocio no tiene sucursal.`,
  );
  process.exit(1);
}

const ambito = {
  organizacionId: org.id,
  sucursalId: sucursal.id,
  terminalId: null,
  identidadId: actor.identidadId,
  empleoId: actor.empleoId,
  rol: 'dueno',
};
const cuenta = { creadas: 0, existian: 0, completados: 0 };

/** Corre un comando con clave estable; lanza con el código si el comando lo rechaza. */
async function ejecutar(definicion, entrada, clave) {
  const resultado = await comando(definicion, {
    ambito,
    entrada,
    idempotencyKey: `cargar-menu:v${String(menu.version)}:${slug}:${clave}`,
  });
  if (!resultado.ok) {
    throw new Error(`${clave}: ${resultado.error.codigo} · ${resultado.error.mensaje ?? ''}`);
  }
  return resultado.datos;
}

async function idsPorNombre(tabla, extra = (q) => q) {
  const filas = await extra(
    db.selectFrom(tabla).select(['id', 'nombre']).where('organizacion_id', '=', org.id),
  ).execute();
  return new Map(filas.map((f) => [f.nombre, f.id]));
}

async function asegurar(existentes, nombre, crear) {
  if (existentes.has(nombre)) {
    cuenta.existian += 1;
    return { id: existentes.get(nombre), nueva: false };
  }
  cuenta.creadas += 1;
  if (ensayo) return { id: null, nueva: true };
  const id = await crear();
  existentes.set(nombre, id);
  return { id, nueva: true };
}

const estaciones = await idsPorNombre('estaciones_preparacion');
for (const [orden, nombre] of menu.estaciones.entries()) {
  await asegurar(estaciones, nombre, async () => {
    const creada = await ejecutar(crearEstacion, { nombre, orden }, `estacion:${nombre}`);
    // `restaurante.crear_estacion` contesta `estacionId`, no `id`.
    return creada.estacionId;
  });
}

const categorias = await idsPorNombre('categorias', (q) => q.where('tipo', '=', 'producto'));
const productos = await idsPorNombre('productos');
for (const [orden, categoria] of menu.categorias.entries()) {
  const { id: categoriaId } = await asegurar(categorias, categoria.nombre, async () => {
    const datos = {
      nombre: categoria.nombre,
      orden,
      estacion_preparacion_id: estaciones.get(categoria.estacion),
    };
    const creada = await ejecutar(
      escribirDatos,
      { entidad: 'CategoriaProducto', operacion: 'create', datos },
      `categoria:${categoria.nombre}`,
    );
    return creada.id;
  });
  if (categoriaId !== null) await ligarEstacion(categoriaId, categoria);

  for (const producto of categoria.productos) {
    const { id } = await asegurar(productos, producto.nombre, async () => {
      const entrada = entradaDelProducto(categoria, producto, categoriaId);
      const creado = await ejecutar(crearProducto, entrada, `producto:${producto.nombre}`);
      return creado.id;
    });
    if (id !== null) await completar(id, producto, categoria);
  }
}

/**
 * La estación de una categoría que quedó sin ella (una corrida cortada a medias). Con estación,
 * aunque sea otra, no se toca: la eligió el dueño.
 */
async function ligarEstacion(categoriaId, categoria) {
  const actual = await db
    .selectFrom('categorias')
    .select('estacion_preparacion_id')
    .where('id', '=', categoriaId)
    .where('organizacion_id', '=', org.id)
    .executeTakeFirst();
  if ((actual?.estacion_preparacion_id ?? null) !== null) return;
  cuenta.completados += 1;
  await ejecutar(
    escribirDatos,
    {
      entidad: 'CategoriaProducto',
      operacion: 'update',
      id: categoriaId,
      datos: { estacion_preparacion_id: estaciones.get(categoria.estacion) },
    },
    `estacion-de:${categoria.nombre}`,
  );
}

/**
 * El área, los atajos de peso y las opciones, SÓLO si le faltan. Va aparte del alta para que una corrida
 * cortada a medias —el producto se creó y lo siguiente falló— se complete en la siguiente, y para
 * no pisar nunca lo que el dueño ya editó: con atajos o con opciones, no se toca.
 */
async function completar(id, producto, categoria) {
  const atajos = atajosDelProducto(producto);
  const actual = await db
    .selectFrom('productos')
    .select(['presets_variable', 'area_preparacion'])
    .where('id', '=', id)
    .where('organizacion_id', '=', org.id)
    .executeTakeFirst();
  // El área decide si hay comanda (`areasDe`): un producto nace en `ninguno` y así no llegaría a
  // cocina ni a barra. Se pone la de su estación sólo mientras siga en `ninguno`.
  if ((actual?.area_preparacion ?? 'ninguno') === 'ninguno') {
    cuenta.completados += 1;
    await ejecutar(
      escribirDatos,
      {
        entidad: 'ProductoTerminado',
        operacion: 'update',
        id,
        datos: { area_preparacion: areaDeLaCategoria(menu, categoria) },
      },
      `area:${producto.nombre}`,
    );
  }
  if (atajos !== null && (actual?.presets_variable ?? null) === null) {
    cuenta.completados += 1;
    await ejecutar(
      escribirDatos,
      {
        entidad: 'ProductoTerminado',
        operacion: 'update',
        id,
        datos: { presets_variable_qr: atajos },
      },
      `atajos:${producto.nombre}`,
    );
  }
  const grupos = gruposDelProducto(menu, producto);
  const conOpciones = await db
    .selectFrom('producto_modificadores')
    .select('modificador_id')
    .where('producto_id', '=', id)
    .where('organizacion_id', '=', org.id)
    .executeTakeFirst();
  if (grupos.length > 0 && conOpciones === undefined) {
    cuenta.completados += 1;
    await ejecutar(guardarModificadores, { productoId: id, grupos }, `opciones:${producto.nombre}`);
  }
}

const r = resumenDelMenu(menu);
console.log(
  `${ensayo ? '◦ Ensayo' : '✓ Menú'} v${String(menu.version)} en «${slug}»: ${String(r.estaciones)} estaciones, ` +
    `${String(r.categorias)} categorías, ${String(r.productos)} productos (${String(r.porPeso)} por peso, ` +
    `${String(r.conOpciones)} con opciones). ${ensayo ? 'Se crearían' : 'Creadas'}: ${String(cuenta.creadas)}; ` +
    `ya existían: ${String(cuenta.existian)}; estaciones, áreas, atajos u opciones completados: ${String(cuenta.completados)}.`,
);
await db.destroy();
