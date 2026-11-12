/**
 * EL ÁRBITRO DEL INVENTARIO, al gramo: por cada insumo, la existencia que el libro dice
 * (compras − mermas − lo que descuentan las recetas por lo cobrado) contra la existencia del
 * sistema, y lo mismo para lo que el sistema registró como salida por venta. Más lo que el libro
 * cree que se gastó y se compró contra las tablas de compras y gastos.
 */
import { PRODUCTOS_DE_PRUEBA, INSUMOS } from '../dia0/datos.ts';
import type { AsientoFechado } from '../libro.ts';
import { leerSql, num, ORGANIZACION, type Comparador } from './base.ts';

const EXISTENCIAS = `
select i.nombre, coalesce(sum(e.cantidad), 0)::text as cantidad
  from insumos i left join existencias e on e.insumo_id = i.id
 where i.organizacion_id = ${ORGANIZACION} and i.nombre = any($1::text[]) group by i.nombre`;

const SALIDAS = `
select i.nombre, abs(coalesce(sum(m.cantidad), 0))::text as cantidad
  from movimientos_stock m join insumos i on i.id = m.insumo_id
 where m.organizacion_id = ${ORGANIZACION} and m.tipo = 'salida_venta' and m.created_at >= $2::timestamptz and i.nombre = any($1::text[])
 group by i.nombre`;

const COMPRAS_Y_GASTOS = `
select (select coalesce(sum(total_centavos), 0) from compras where organizacion_id = ${ORGANIZACION} and created_at >= $1::timestamptz)::text as compras,
       (select coalesce(sum(monto_centavos), 0) from gastos where organizacion_id = ${ORGANIZACION} and created_at >= $1::timestamptz)::text as gastos`;

/** Cuánto insumo gasta UNA unidad vendida de un producto de prueba (en unidad base). */
export function consumoPorUnidad(producto: string): Readonly<Record<string, number>> {
  const p = PRODUCTOS_DE_PRUEBA.find((x) => x.nombre === producto);
  if (p === undefined) return {};
  if (p.ingredienteBase !== undefined && p.tipo !== 'porcion') return { [p.ingredienteBase]: 1000 };
  return p.receta ?? {};
}

/** Lo que el libro dice que debe haber por insumo: compras − mermas − consumo de lo cobrado. */
export function existenciaEsperada(libro: readonly AsientoFechado[]): {
  existencia: Map<string, number>;
  consumo: Map<string, number>;
} {
  const cobradas = new Set(
    libro.flatMap((f) => (f.asiento.tipo === 'cobro' ? [f.asiento.cuenta] : [])),
  );
  const existencia = new Map<string, number>();
  const consumo = new Map<string, number>();
  const mover = (m: Map<string, number>, nombre: string, delta: number) =>
    m.set(nombre, (m.get(nombre) ?? 0) + delta);
  for (const { asiento } of libro) {
    if (asiento.tipo === 'compra') mover(existencia, asiento.insumo, asiento.cantidad);
    if (asiento.tipo === 'merma') mover(existencia, asiento.insumo, -asiento.cantidad);
    if (asiento.tipo === 'linea' && cobradas.has(asiento.cuenta)) {
      for (const [insumo, cantidad] of Object.entries(consumoPorUnidad(asiento.producto))) {
        mover(existencia, insumo, -cantidad * asiento.cantidad);
        mover(consumo, insumo, cantidad * asiento.cantidad);
      }
    }
  }
  return { existencia, consumo };
}

const redondeo = (n: number): number => Math.round(n * 10_000) / 10_000;

export async function arbitrarInventario(
  baseUrl: string,
  libro: readonly AsientoFechado[],
  desde: string,
  c: Comparador,
): Promise<void> {
  const nombres = INSUMOS.map((i) => i.nombre);
  const { existencia, consumo } = existenciaEsperada(libro);
  const reales = new Map(
    (await leerSql<{ nombre: string; cantidad: string }>(baseUrl, EXISTENCIAS, [nombres])).map(
      (f) => [f.nombre, num(f.cantidad)],
    ),
  );
  const salidas = new Map(
    (await leerSql<{ nombre: string; cantidad: string }>(baseUrl, SALIDAS, [nombres, desde])).map(
      (f) => [f.nombre, num(f.cantidad)],
    ),
  );
  for (const i of INSUMOS) {
    const unidad = i.base;
    c.comparar(
      'inventario',
      `${i.nombre}: existencia final (${unidad})`,
      redondeo(existencia.get(i.nombre) ?? 0),
      redondeo(reales.get(i.nombre) ?? 0),
      'inventario',
      'alto',
    );
    c.comparar(
      'inventario',
      `${i.nombre}: salida por venta (${unidad})`,
      redondeo(consumo.get(i.nombre) ?? 0),
      redondeo(salidas.get(i.nombre) ?? 0),
      'inventario',
      'alto',
    );
  }
  const [fila] = await leerSql<{ compras: string; gastos: string }>(baseUrl, COMPRAS_Y_GASTOS, [
    desde,
  ]);
  // Las compras y los gastos se comparan en la MISMA ventana que la base (desde el inicio del día):
  // el libro trae todos los días (el inventario sí es acumulado) y sumaba también los del día 0.
  const desdeIso = new Date(desde).toISOString();
  const sumaDe = (tipo: 'compra' | 'gasto', campo: 'costoCentavos' | 'centavos') =>
    libro.reduce(
      (s, f) =>
        f.horaSim >= desdeIso && f.asiento.tipo === tipo && campo in f.asiento
          ? s + ((f.asiento as unknown as Record<string, number | undefined>)[campo] ?? 0)
          : s,
      0,
    );
  c.comparar(
    'compras y gastos',
    'Total de compras registradas',
    sumaDe('compra', 'costoCentavos'),
    num(fila?.compras),
    'dinero',
    'alto',
  );
  c.comparar(
    'compras y gastos',
    'Total de gastos operativos registrados',
    sumaDe('gasto', 'centavos'),
    num(fila?.gastos),
    'dinero',
    'alto',
  );
}
