/**
 * EL CATÁLOGO QUE «SABE» EL PERSONAL: se lee UNA vez al empezar el día, en SÓLO LECTURA sobre la
 * copia (una transacción `read only` que siempre se cierra con `rollback`), y llena `mundo.catalogo`
 * y `mundo.mesas`. De aquí salen los precios esperados de cada línea (`importeEsperado`): los bots
 * nunca le preguntan el precio a la pantalla que están probando.
 *
 * Pasa antes por el candado: la base tiene que ser local y empezar con `qa_`.
 */
import { createRequire } from 'node:module';

import { exigirCopiaLocal } from './candado.ts';
import type { GrupoConocido, MesaConocida, Mundo, ProductoConocido } from './mundo.ts';

const SLUG = 'don-poncho';

export interface Cliente {
  // El tipo de las filas lo pide quien consulta, como en el `Client` de `pg`.
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  query<T = Record<string, unknown>>(texto: string, valores?: unknown[]): Promise<{ rows: T[] }>;
  connect(): Promise<void>;
  end(): Promise<void>;
}

interface FilaDeProducto {
  id: string;
  nombre: string;
  categoria: string;
  estacion: string | null;
  tipo_venta: string;
  precio: string;
  por_porcion: string | null;
  presets: unknown;
  solo_presets: boolean;
}

interface FilaDeGrupo {
  producto_id: string;
  id: string;
  nombre: string;
  tipo: string;
  obligatorio: boolean;
  minimo: number | null;
  maximo: number | null;
  opcion_id: string | null;
  opcion: string | null;
  delta: string | null;
  activa: boolean | null;
}

type ConstructorDeCliente = new (o: { connectionString: string }) => Cliente;

/** Busca el módulo `pg` en este árbol y, si es un worktree sin instalar, en los de arriba (el checkout principal). */
function cargarPg(): { Client: ConstructorDeCliente } {
  let raiz = new URL('../../', import.meta.url);
  for (let nivel = 0; nivel < 6; nivel += 1) {
    try {
      return createRequire(new URL('packages/data/package.json', raiz))('pg') as {
        Client: ConstructorDeCliente;
      };
    } catch (error: unknown) {
      if ((error as { code?: string }).code !== 'MODULE_NOT_FOUND') throw error;
      raiz = new URL('../', raiz);
    }
  }
  throw new Error('No se encontró el módulo pg (instala las dependencias).');
}

export function abrirCliente(cadena: string): Cliente {
  return new (cargarPg().Client)({ connectionString: cadena });
}

const SQL_PRODUCTOS = `
  select p.id, p.nombre, c.nombre as categoria,
         coalesce(e.nombre, c.estacion_nombre) as estacion, p.tipo_venta,
         (case when p.tipo_venta = 'variable_medida'
               then coalesce(p.precio_por_unidad_variable_centavos, p.precio_venta_centavos)
               else p.precio_venta_centavos end)::text as precio,
         p.precio_por_porcion_centavos::text as por_porcion,
         p.presets_variable as presets, coalesce(p.solo_presets_variable, false) as solo_presets
    from productos p
    join categorias c on c.id = p.categoria_id
    left join estaciones_preparacion e on e.id = c.estacion_preparacion_id
   where p.organizacion_id = (select id from organizaciones where slug = $1)
     and p.activo and p.visible_en_pos
   order by p.nombre`;

const SQL_GRUPOS = `
  select pm.producto_id, m.id, m.nombre, m.tipo, m.obligatorio,
         m.minimo_elecciones as minimo, m.maximo_elecciones as maximo,
         o.id as opcion_id, o.nombre as opcion,
         (case when coalesce(o.delta_precio_centavos, 0) <> 0 then o.delta_precio_centavos
               else coalesce(o.precio_extra_centavos, 0) end)::text as delta, o.activa
    from producto_modificadores pm
    join modificadores m on m.id = pm.modificador_id and m.activo
    left join modificador_opciones o on o.modificador_id = m.id
   where pm.organizacion_id = (select id from organizaciones where slug = $1)
   order by pm.producto_id, pm.orden, m.nombre, o.orden, o.nombre`;

const SQL_MESAS = `
  select m.numero, coalesce(z.nombre, '') as zona, m.qr_token
    from mesas m left join zonas z on z.id = m.zona_id
   where m.organizacion_id = (select id from organizaciones where slug = $1)
     and m.activa and m.qr_token is not null
   order by m.numero`;

interface GrupoEnArmado {
  base: Omit<GrupoConocido, 'opciones'>;
  opciones: GrupoConocido['opciones'][number][];
}

export function gruposDe(filas: readonly FilaDeGrupo[]): Map<string, GrupoConocido[]> {
  const por = new Map<string, Map<string, GrupoEnArmado>>();
  for (const f of filas) {
    const grupos = por.get(f.producto_id) ?? new Map<string, GrupoEnArmado>();
    const g = grupos.get(f.id) ?? {
      base: {
        id: f.id,
        nombre: f.nombre,
        tipo: f.tipo === 'multiple' ? ('multiple' as const) : ('unica' as const),
        obligatorio: f.obligatorio,
        minimo: f.minimo,
        maximo: f.maximo,
      },
      opciones: [] as GrupoConocido['opciones'][number][],
    };
    if (f.opcion_id !== null && f.opcion !== null) {
      g.opciones.push({
        id: f.opcion_id,
        nombre: f.opcion,
        deltaCentavos: Number(f.delta ?? 0),
        activa: f.activa !== false,
      });
    }
    grupos.set(f.id, g);
    por.set(f.producto_id, grupos);
  }
  const salida = new Map<string, GrupoConocido[]>();
  for (const [producto, grupos] of por) {
    salida.set(
      producto,
      [...grupos.values()].map((g) => ({ ...g.base, opciones: g.opciones })),
    );
  }
  return salida;
}

export function armarCatalogo(
  productos: readonly FilaDeProducto[],
  grupos: Map<string, GrupoConocido[]>,
): ProductoConocido[] {
  return productos.map((p) => {
    const presets = Array.isArray(p.presets)
      ? p.presets.map(Number).filter((n) => Number.isFinite(n) && n > 0)
      : [];
    return {
      id: p.id,
      nombre: p.nombre,
      categoria: p.categoria,
      estacion: p.estacion ?? 'Cocina',
      tipoVenta: p.tipo_venta,
      precioCentavos: Number(
        p.tipo_venta === 'porcion_contenedor' ? (p.por_porcion ?? p.precio) : p.precio,
      ),
      presentaciones: presets,
      soloPresentaciones: p.solo_presets,
      grupos: grupos.get(p.id) ?? [],
    };
  });
}

/** Lee el catálogo y las mesas de la copia y los pone en el mundo. Devuelve cuántos productos y mesas. */
export async function leerCatalogo(
  mundo: Mundo,
  baseUrl: string,
): Promise<{ productos: number; mesas: number }> {
  exigirCopiaLocal({ databaseUrl: baseUrl, entorno: process.env });
  const cliente = abrirCliente(baseUrl);
  await cliente.connect();
  try {
    await cliente.query('begin read only');
    try {
      const productos = await cliente.query<FilaDeProducto>(SQL_PRODUCTOS, [SLUG]);
      const grupos = await cliente.query<FilaDeGrupo>(SQL_GRUPOS, [SLUG]);
      const mesas = await cliente.query<{ numero: number; zona: string; qr_token: string }>(
        SQL_MESAS,
        [SLUG],
      );
      mundo.catalogo = armarCatalogo(productos.rows, gruposDe(grupos.rows));
      mundo.mesas = mesas.rows.map((m): MesaConocida => ({
        numero: m.numero,
        zona: m.zona,
        qrToken: m.qr_token,
      }));
    } finally {
      await cliente.query('rollback');
    }
  } finally {
    await cliente.end();
  }
  return { productos: mundo.catalogo.length, mesas: mundo.mesas.length };
}
