/**
 * DÍA 0 · LOS 10 PRODUCTOS DE PRUEBA, uno de cada tipo, dados de alta por Recetas → «Nueva receta»:
 * por pieza, por peso con presentaciones, por peso libre, sólo presentaciones, por porción, con
 * opción única obligatoria, con opción múltiple, con foto, sin foto y con fondo, y sin opciones.
 * Las opciones con precio las pone el paso siguiente (Platillos → «Opciones»).
 */
import { consultar, llamar } from '../api-app.ts';
import { crearProducto } from '../pantallas/receta.ts';
import { ir, type Dia0 } from './contexto.ts';
import { PRODUCTOS_DE_PRUEBA } from './datos.ts';

/** Lo que la pantalla debió mandar: sin `unidad_variable` vacío y con `ml_por_porcion`. */
async function crearPorcionPorLaApi(
  d: Dia0,
  p: (typeof PRODUCTOS_DE_PRUEBA)[number],
): Promise<void> {
  const categorias = await consultar<{ id: string; nombre: string }>(d.pagina, 'CategoriaProducto');
  const insumos = await consultar<{ id: string; nombre: string }>(d.pagina, 'Ingrediente');
  const categoria = categorias.find((c) => c.nombre === p.categoria);
  const insumo = insumos.find((i) => i.nombre === p.ingredienteBase);
  if (categoria === undefined || insumo === undefined)
    throw new Error('No encuentro la categoría o el insumo del producto por porción.');
  const ml = p.presentaciones?.[0] ?? 45;
  const r = await llamar(d.pagina, '/api/datos/escribir', {
    entidad: 'ProductoTerminado',
    operacion: 'create',
    datos: {
      nombre: p.nombre,
      categoria_id: categoria.id,
      precio_venta: p.precioPesos,
      visible_en_pos: true,
      activo: true,
      tipo_venta: 'porcion_contenedor',
      ingrediente_base_id: insumo.id,
      capacidad_contenedor_ml: 750,
      porciones_por_contenedor: Math.floor(750 / ml),
      ml_por_porcion: ml,
      nombre_porcion: 'shot',
      precio_por_porcion: p.precioPesos,
      presets_porcion_qr: [],
    },
  });
  if (!r.ok)
    throw new Error(
      `La API tampoco pudo crear el producto por porción: ${String(r.estado)} ${r.mensaje}`,
    );
  d.nota('productos', `${p.nombre} creado por la API (la pantalla de porción falla)`);
}

export async function pasoProductos(d: Dia0): Promise<void> {
  const { pagina } = d;
  const hay = new Set(
    (await consultar<{ nombre: string }>(pagina, 'ProductoTerminado')).map((p) => p.nombre),
  );
  for (const p of PRODUCTOS_DE_PRUEBA) {
    if (hay.has(p.nombre)) {
      d.nota('productos', `${p.nombre} ya estaba`);
      continue;
    }
    await ir(d, '/recetas');
    try {
      await crearProducto(pagina, p);
    } catch (error: unknown) {
      const dicho = String(error);
      if (p.tipo !== 'porcion' || !dicho.includes('500 /api/datos/escribir')) throw error;
      // DEFECTO: la pantalla manda `unidad_variable: ""` (rompe productos_unidad_variable_check) y deja
      // `ml_por_porcion` vacío aunque dice «opcional» (producto_porcion_completo lo exige): 500.
      await d.incidente({
        pantalla: 'Recetas → Nueva receta → Por porción de contenedor',
        hizo: `Creé «${p.nombre}» por porción de contenedor (capacidad 750 ml, 16 porciones, $45 la porción) y toqué «Crear receta»`,
        esperaba: 'El producto se guarda (ml por porción se calcula, como dice «opcional»)',
        paso: dicho.slice(dicho.indexOf('Rechazos:'), dicho.indexOf('Avisos:')).trim(),
        gravedad: 'alto',
        clase: 'ui',
      });
      await ir(d, '/recetas');
      await crearPorcionPorLaApi(d, p);
    }
    d.nota('productos', `creado ${p.nombre} (${p.tipo})`);
  }
  await corregirLaEstrategiaDeConsumo(d);
  await d.foto('productos');
}

/**
 * DEFECTO: Recetas guarda los productos por peso y por porción con su «Ingrediente base» pero sin
 * mandar `estrategia_consumo`, y la base los deja en `sku`: venden y NO descuentan su insumo (el
 * esquema dice que «un producto variable descuenta su insumo base o su receta»). Se registra una vez
 * y se corrige por la API (lo que mandaría la pantalla) para que el inventario de la semana se pueda
 * comparar; sin esto cada día repetiría el mismo faltante.
 */
async function corregirLaEstrategiaDeConsumo(d: Dia0): Promise<void> {
  const insumoBase = new Set(
    PRODUCTOS_DE_PRUEBA.flatMap((p) => (p.ingredienteBase === undefined ? [] : [p.nombre])),
  );
  const filas = await consultar<{ id: string; nombre: string; estrategia_consumo?: string }>(
    d.pagina,
    'ProductoTerminado',
  );
  const mal = filas.filter(
    (f) => insumoBase.has(f.nombre) && f.estrategia_consumo !== 'insumo_base',
  );
  if (mal.length === 0) return;
  await d.incidente({
    pantalla: 'Recetas → Nueva receta → Variable por medida / Por porción',
    hizo: `Creé ${mal.map((m) => `«${m.nombre}»`).join(', ')} con su «Ingrediente base» elegido`,
    esperaba:
      'Los productos por peso y por porción descuentan su ingrediente base al venderse (estrategia «insumo_base»)',
    paso: `Quedaron con estrategia_consumo = ${[...new Set(mal.map((m) => m.estrategia_consumo ?? '?'))].join(', ')}: la venta no baja la existencia del insumo`,
    gravedad: 'alto',
    clase: 'inventario',
  });
  for (const m of mal) {
    const r = await llamar(d.pagina, '/api/datos/escribir', {
      entidad: 'ProductoTerminado',
      operacion: 'update',
      id: m.id,
      datos: { estrategia_consumo: 'insumo_base' },
    });
    if (!r.ok)
      throw new Error(
        `No se pudo corregir la estrategia de ${m.nombre}: ${String(r.estado)} ${r.mensaje}`,
      );
    d.nota(
      'productos',
      `${m.nombre}: estrategia de consumo → insumo_base (por la API: la pantalla no la manda)`,
    );
  }
}
