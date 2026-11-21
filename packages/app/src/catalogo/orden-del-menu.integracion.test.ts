import { randomUUID } from 'node:crypto';

import { obtenerDb } from '@morphiqpos/data';
import { ordenarMenu } from '@morphiqpos/domain/catalogo';
import { beforeAll, describe, expect, it } from 'vitest';
import type { z } from 'zod';

import { comando } from '../produccion.ts';
import { clave } from '../pruebas/negocio-real.ts';
import { payloadDelPortal } from '../portal/consulta.ts';
import { PIMIENTA, mesaConPortal } from '../portal/pruebas/mesa-con-portal.ts';
import {
  entradaGuardarCategoria,
  entradaMoverACategoria,
  entradaUnirCategorias,
  guardarCategoriaDelMenu,
  moverProductosACategoria,
  unirCategoriasDelMenu,
} from './categorias-del-menu.ts';
import {
  entradaMostrarEnMenu,
  entradaOrdenarCategorias,
  entradaOrdenarProductos,
  mostrarProductoEnElMenu,
  ordenarCategoriasDelMenu,
  ordenarProductosDeLaCategoria,
} from './orden-del-menu.ts';

/**
 * DP-24 · 3.1 a 3.4 · EL ORDEN DEL MENÚ Y SUS CATEGORÍAS, contra Postgres.
 *
 * Un solo orden (el del portal QR sale de la base con el mismo criterio que las pantallas), con su
 * auditoría, su conflicto cuando dos personas ordenan a la vez, sus permisos, y unir/mover
 * categorías SIN cambiarle la estación de preparación a ningún platillo.
 */

type Caso = Awaited<ReturnType<typeof mesaConPortal>>;
let caso: Caso;
let org = '';
let cocina = '';
let cantina = '';

const ambitoDelRol = (rol: 'cajero' | 'mesero' | 'dueno') => ({ ...caso.ambito, rol });

async function sembrarCategoria(
  nombre: string,
  orden: number,
  estacionId: string | null,
): Promise<string> {
  const id = randomUUID();
  await obtenerDb()
    .insertInto('categorias')
    .values({
      id,
      organizacion_id: org,
      nombre,
      orden,
      estacion_preparacion_id: estacionId,
    })
    .execute();
  return id;
}

async function sembrarPlatillo(
  nombre: string,
  categoriaId: string,
  area: 'cocina' | 'barra' = 'cocina',
): Promise<string> {
  const id = randomUUID();
  await obtenerDb()
    .insertInto('productos')
    .values({
      id,
      organizacion_id: org,
      nombre,
      categoria_id: categoriaId,
      area_preparacion: area,
      visible_en_menu_digital: true,
      visible_en_pos: true,
      precio_venta_centavos: 5_000n,
    })
    .execute();
  return id;
}

const correr = <E extends z.ZodType>(
  definicion: Parameters<typeof comando>[0],
  entrada: z.input<E>,
  rol: 'cajero' | 'mesero' | 'dueno' = 'dueno',
) =>
  comando(definicion as never, {
    entrada,
    ambito: ambitoDelRol(rol),
    idempotencyKey: clave(),
  }) as Promise<{ ok: boolean; datos?: unknown; error?: { codigo: string; mensaje?: string } }>;

const ordenarCategorias = (entrada: z.input<typeof entradaOrdenarCategorias>) =>
  correr<typeof entradaOrdenarCategorias>(ordenarCategoriasDelMenu as never, entrada);
const ordenarProductos = (entrada: z.input<typeof entradaOrdenarProductos>) =>
  correr<typeof entradaOrdenarProductos>(ordenarProductosDeLaCategoria as never, entrada);

/** Los platillos como los ve el comensal, en el orden en que llegan del servidor. */
async function menuDelPortal(): Promise<readonly string[]> {
  return (await payloadDelPortal(org, caso.qrToken, PIMIENTA)).productos.map((p) => p.nombre);
}
async function categoriasDelPortal(): Promise<readonly string[]> {
  return (await payloadDelPortal(org, caso.qrToken, PIMIENTA)).categorias.map(
    (c) => c.nombre ?? '',
  );
}

const auditorias = async (accion: string) =>
  obtenerDb()
    .selectFrom('auditoria')
    .select('payload')
    .where('organizacion_id', '=', org)
    .where('accion', '=', accion)
    .execute();

beforeAll(async () => {
  caso = await mesaConPortal();
  org = caso.negocio.organizacionId;
  // El taco y el agua del caso ya existen; se esconden del menú para que cada prueba controle el suyo.
  await obtenerDb()
    .updateTable('productos')
    .set({ visible_en_menu_digital: false })
    .where('organizacion_id', '=', org)
    .execute();
  cocina = randomUUID();
  cantina = randomUUID();
  await obtenerDb()
    .insertInto('estaciones_preparacion')
    .values([
      { id: cocina, organizacion_id: org, nombre: 'Cocina', es_general: true, orden: 1 },
      { id: cantina, organizacion_id: org, nombre: 'Cantina', es_general: false, orden: 2 },
    ])
    .execute();
});

describe('DP-24 · un solo orden para el portal y las pantallas', () => {
  let sopas = '';
  let empezar = '';
  const ids: Record<string, string> = {};

  beforeAll(async () => {
    sopas = await sembrarCategoria('Las sopas', 1, cocina);
    empezar = await sembrarCategoria('Para empezar', 2, cocina);
    for (const n of ['Tamal', 'Guacamole', 'Aguacate']) ids[n] = await sembrarPlatillo(n, empezar);
    for (const n of ['Arroz', 'Consomé']) ids[n] = await sembrarPlatillo(n, sopas);
  });

  it('mientras nadie ordena, el portal sigue por nombre dentro de cada categoría', async () => {
    expect(await menuDelPortal()).toEqual(['Arroz', 'Consomé', 'Aguacate', 'Guacamole', 'Tamal']);
  });

  it('ordenar los productos cambia el portal, y lo que no se ordenó va al final por nombre', async () => {
    const r = await ordenarProductos({
      categoriaId: empezar,
      productoIds: [ids['Tamal'] ?? '', ids['Aguacate'] ?? '', ids['Guacamole'] ?? ''],
    });
    expect(r.ok).toBe(true);
    expect(await menuDelPortal()).toEqual(['Arroz', 'Consomé', 'Tamal', 'Aguacate', 'Guacamole']);

    const nuevo = await sembrarPlatillo('Barbacoa', empezar);
    expect(nuevo).toBeDefined();
    expect(await menuDelPortal()).toEqual([
      'Arroz',
      'Consomé',
      'Tamal',
      'Aguacate',
      'Guacamole',
      'Barbacoa',
    ]);
  });

  it('las pantallas (ordenarMenu) y el portal dan el MISMO orden', async () => {
    const productos = await obtenerDb()
      .selectFrom('productos')
      .select(['id', 'nombre', 'categoria_id', 'orden_en_categoria'])
      .where('organizacion_id', '=', org)
      .where('visible_en_menu_digital', '=', true)
      .execute();
    const categorias = await obtenerDb()
      .selectFrom('categorias')
      .select(['id', 'nombre', 'orden'])
      .where('organizacion_id', '=', org)
      .execute();
    expect(ordenarMenu(productos, categorias).map((p) => p.nombre)).toEqual(await menuDelPortal());
  });

  it('ordenar las categorías cambia el orden de las secciones y de los platillos', async () => {
    const antes = [sopas, empezar];
    const r = await ordenarCategorias({ categoriaIds: [empezar, sopas], antes });
    expect(r.ok).toBe(true);
    expect(await categoriasDelPortal()).toEqual(['Para empezar', 'Las sopas']);
    expect((await menuDelPortal()).slice(0, 3)).toEqual(['Tamal', 'Aguacate', 'Guacamole']);
  });

  it('deja su rastro en la auditoría; repetir lo mismo no deja otro', async () => {
    const antesDeRepetir = (await auditorias('catalogo.ordenar_categorias')).length;
    expect(antesDeRepetir).toBeGreaterThan(0);
    const repetido = await ordenarCategorias({ categoriaIds: [empezar, sopas] });
    expect(repetido.ok).toBe(true);
    expect((await auditorias('catalogo.ordenar_categorias')).length).toBe(antesDeRepetir);
    const [ultimo] = await auditorias('catalogo.ordenar_productos');
    expect(ultimo?.payload).toBeDefined();
  });

  it('si otra persona ordenó mientras tanto, se rechaza con conflicto y no se pisa', async () => {
    const visto = [empezar, sopas];
    await ordenarCategorias({ categoriaIds: [sopas, empezar], antes: visto });
    const tarde = await ordenarCategorias({ categoriaIds: [empezar, sopas], antes: visto });
    expect(tarde.ok).toBe(false);
    expect(await categoriasDelPortal()).toEqual(['Las sopas', 'Para empezar']);
  });

  it('un orden que no trae exactamente todas, una sola vez, se rechaza', async () => {
    const faltan = await ordenarCategorias({ categoriaIds: [sopas] });
    const repetidas = await ordenarCategorias({ categoriaIds: [sopas, sopas] });
    const ajena = await ordenarCategorias({ categoriaIds: [sopas, empezar, randomUUID()] });
    expect([faltan.ok, repetidas.ok, ajena.ok]).toEqual([false, false, false]);
    expect(await categoriasDelPortal()).toEqual(['Las sopas', 'Para empezar']);
  });

  it('un producto que cambia de categoría (aunque sea por un UPDATE a mano) pierde su lugar', async () => {
    const otra = await sembrarCategoria('Antojitos t', 8, cocina);
    const idTamal = ids['Tamal'] ?? '';
    const antes = await obtenerDb()
      .selectFrom('productos')
      .select('orden_en_categoria')
      .where('id', '=', idTamal)
      .executeTakeFirstOrThrow();
    expect(antes.orden_en_categoria).not.toBeNull();
    await obtenerDb()
      .updateTable('productos')
      .set({ categoria_id: otra })
      .where('id', '=', idTamal)
      .execute();
    const despues = await obtenerDb()
      .selectFrom('productos')
      .select('orden_en_categoria')
      .where('id', '=', idTamal)
      .executeTakeFirstOrThrow();
    expect(despues.orden_en_categoria).toBeNull();
    await obtenerDb()
      .updateTable('productos')
      .set({ categoria_id: empezar })
      .where('id', '=', idTamal)
      .execute();
    // La categoría de apoyo se apaga para no estorbar a las pruebas que siguen.
    await obtenerDb()
      .updateTable('categorias')
      .set({ activa: false })
      .where('id', '=', otra)
      .execute();
  });

  it('un producto de otra categoría no se cuela en el orden', async () => {
    const mezclado = await ordenarProductos({
      categoriaId: empezar,
      productoIds: [ids['Arroz'] ?? '', ids['Tamal'] ?? ''],
    });
    expect(mezclado.ok).toBe(false);
  });

  it('el mesero y la cajera no ordenan el menú', async () => {
    for (const rol of ['mesero', 'cajero'] as const) {
      const r = await correr<typeof entradaOrdenarCategorias>(
        ordenarCategoriasDelMenu as never,
        { categoriaIds: [empezar, sopas] },
        rol,
      );
      expect(r.ok).toBe(false);
      expect(r.error?.codigo).toBe('SIN_PERMISO');
    }
    expect(await categoriasDelPortal()).toEqual(['Las sopas', 'Para empezar']);
  });
});

describe('DP-24 · mostrar u ocultar un producto del menú digital', () => {
  it('oculto no sale en el portal; al mostrarlo vuelve; con auditoría y sin repetirla', async () => {
    const categoria = await sembrarCategoria('Visibles', 9, cocina);
    const flan = await sembrarPlatillo('Flan', categoria);
    const mostrar = (visible: boolean, rol: 'dueno' | 'cajero' = 'dueno') =>
      correr<typeof entradaMostrarEnMenu>(
        mostrarProductoEnElMenu as never,
        { productoId: flan, visible },
        rol,
      );
    expect(await menuDelPortal()).toContain('Flan');
    expect((await mostrar(false)).ok).toBe(true);
    expect(await menuDelPortal()).not.toContain('Flan');
    expect((await mostrar(true)).ok).toBe(true);
    expect(await menuDelPortal()).toContain('Flan');
    const antes = (await auditorias('catalogo.mostrar_en_menu')).length;
    expect(antes).toBe(2);
    expect((await mostrar(true)).ok).toBe(true);
    expect((await auditorias('catalogo.mostrar_en_menu')).length).toBe(antes);
    expect((await mostrar(false, 'cajero')).error?.codigo).toBe('SIN_PERMISO');
  });
});

describe('DP-24 · renombrar, colorear, unir y mover categorías', () => {
  const guardar = (entrada: z.input<typeof entradaGuardarCategoria>) =>
    correr<typeof entradaGuardarCategoria>(guardarCategoriaDelMenu as never, entrada);
  const unir = (entrada: z.input<typeof entradaUnirCategorias>) =>
    correr<typeof entradaUnirCategorias>(unirCategoriasDelMenu as never, entrada);
  const mover = (entrada: z.input<typeof entradaMoverACategoria>) =>
    correr<typeof entradaMoverACategoria>(moverProductosACategoria as never, entrada);
  const deCategoria = async (id: string) =>
    (
      await obtenerDb()
        .selectFrom('productos')
        .select('nombre')
        .where('categoria_id', '=', id)
        .orderBy('nombre')
        .execute()
    ).map((p) => p.nombre);

  it('renombra y pone color de la paleta; un color suelto o un nombre repetido se rechazan', async () => {
    const a = await sembrarCategoria('Pa’ empezar x', 20, cocina);
    await sembrarCategoria('Otra cosa', 21, cocina);
    expect((await guardar({ categoriaId: a, nombre: 'Para empezar x', color: 'cat-3' })).ok).toBe(
      true,
    );
    const fila = await obtenerDb()
      .selectFrom('categorias')
      .select(['nombre', 'color'])
      .where('id', '=', a)
      .executeTakeFirstOrThrow();
    expect(fila).toEqual({ nombre: 'Para empezar x', color: 'cat-3' });
    expect((await guardar({ categoriaId: a, color: '#ff0000' })).ok).toBe(false);
    expect((await guardar({ categoriaId: a, nombre: 'otra COSA' })).ok).toBe(false);
    const n = (await auditorias('catalogo.guardar_categoria')).length;
    expect((await guardar({ categoriaId: a, nombre: 'Para empezar x', color: 'cat-3' })).ok).toBe(
      true,
    );
    expect((await auditorias('catalogo.guardar_categoria')).length).toBe(n);
  });

  it('une dos categorías de la MISMA estación: mueve los platillos y APAGA la que sobra', async () => {
    const ron = await sembrarCategoria('Ron u', 30, cantina);
    const brandy = await sembrarCategoria('Brandy u', 31, cantina);
    await sembrarPlatillo('Bacardí u', ron, 'barra');
    await sembrarPlatillo('Torres u', brandy, 'barra');
    const r = await unir({ categoriaQueSobraId: brandy, categoriaQueRecibeId: ron });
    expect(r.ok).toBe(true);
    expect(await deCategoria(ron)).toEqual(['Bacardí u', 'Torres u']);
    const sobra = await obtenerDb()
      .selectFrom('categorias')
      .select('activa')
      .where('id', '=', brandy)
      .executeTakeFirstOrThrow();
    expect(sobra.activa).toBe(false);
    // Repetirlo no hace nada ni deja otro rastro.
    const n = (await auditorias('catalogo.unir_categorias')).length;
    expect((await unir({ categoriaQueSobraId: brandy, categoriaQueRecibeId: ron })).ok).toBe(true);
    expect((await auditorias('catalogo.unir_categorias')).length).toBe(n);
  });

  it('NO une ni mueve si el platillo cambiaría de estación: no se mueve nada', async () => {
    const comida = await sembrarCategoria('Comida e', 40, cocina);
    const bebida = await sembrarCategoria('Bebida e', 41, cantina);
    const sopa = await sembrarPlatillo('Sopa e', comida);
    await sembrarPlatillo('Jugo e', bebida, 'barra');
    const unirMal = await unir({ categoriaQueSobraId: bebida, categoriaQueRecibeId: comida });
    expect(unirMal.ok).toBe(false);
    const moverMal = await mover({ productoIds: [sopa], categoriaId: bebida });
    expect(moverMal.ok).toBe(false);
    expect(await deCategoria(comida)).toEqual(['Sopa e']);
    expect(await deCategoria(bebida)).toEqual(['Jugo e']);
  });

  it('mover un platillo entre categorías de la misma estación lo cambia y lo manda al final', async () => {
    const enfriar = await sembrarCategoria('Enfriar m', 50, cantina);
    const preparadas = await sembrarCategoria('Preparadas m', 51, cantina);
    const naranjada = await sembrarPlatillo('Naranjada m', enfriar, 'barra');
    expect((await mover({ productoIds: [naranjada], categoriaId: preparadas })).ok).toBe(true);
    expect(await deCategoria(preparadas)).toEqual(['Naranjada m']);
    const fila = await obtenerDb()
      .selectFrom('productos')
      .select(['area_preparacion', 'orden_en_categoria'])
      .where('id', '=', naranjada)
      .executeTakeFirstOrThrow();
    expect(fila).toEqual({ area_preparacion: 'barra', orden_en_categoria: null });
    expect((await mover({ productoIds: [naranjada], categoriaId: preparadas })).ok).toBe(true);
  });

  it('el mesero no renombra ni une categorías', async () => {
    const a = await sembrarCategoria('Intocable', 60, cocina);
    const r = await correr<typeof entradaGuardarCategoria>(
      guardarCategoriaDelMenu as never,
      { categoriaId: a, nombre: 'Tocada' },
      'mesero',
    );
    expect(r.error?.codigo).toBe('SIN_PERMISO');
  });
});
