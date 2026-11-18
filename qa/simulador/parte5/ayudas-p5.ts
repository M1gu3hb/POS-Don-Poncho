/**
 * LO QUE COMPARTEN LOS PASOS DE LA PARTE 5 (DP-22): la foto de las existencias leída en SÓLO LECTURA
 * (el árbitro), el libro independiente de cada paso (lo que la receta × lo vendido DICE que debe
 * moverse, calculado desde los datos del día 0 y no desde el sistema) y el informe de cada punto
 * («esperado» contra «obtenido», al gramo y al centavo).
 */
import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

import type { Page } from '@playwright/test';

import { leerSql, ORGANIZACION } from '../arbitro/base.ts';
import { INSUMOS } from '../dia0/datos.ts';
import { consumoPorUnidad } from '../arbitro/inventario.ts';
import type { LineaPlaneada } from '../pedido.ts';
import type { ProductoConocido } from '../mundo.ts';
import { importeEsperado } from '../libro.ts';

export type Foto = ReadonlyMap<string, number>;

/** La existencia de cada insumo de prueba, sumada en todos los almacenes (gramos, mililitros, piezas). */
export async function fotoDeExistencias(baseUrl: string): Promise<Foto> {
  const filas = await leerSql<{ nombre: string; cantidad: string }>(
    baseUrl,
    `select i.nombre, coalesce(sum(e.cantidad), 0)::text as cantidad
       from insumos i left join existencias e on e.insumo_id = i.id
      where i.organizacion_id = ${ORGANIZACION} and i.nombre = any($1::text[]) group by i.nombre`,
    [INSUMOS.map((i) => i.nombre)],
  );
  return new Map(filas.map((f) => [f.nombre, Number(f.cantidad)]));
}

/** Lo que el kardex dice que valen los movimientos de un tipo desde `desde` (centavos, con signo). */
export async function importeDelKardex(
  baseUrl: string,
  tipo: string,
  desde: string,
): Promise<number> {
  const [fila] = await leerSql<{ importe: string }>(
    baseUrl,
    `select coalesce(sum(k.importe_centavos), 0)::text as importe
       from kardex k join insumos i on i.id = k.insumo_id
      where i.organizacion_id = ${ORGANIZACION} and k.tipo = $1 and k.created_at >= $2::timestamptz
        and i.nombre = any($3::text[])`,
    [tipo, desde, INSUMOS.map((i) => i.nombre)],
  );
  return Number(fila?.importe ?? 0);
}

/** El cambio entre dos fotos, por insumo (sólo los que se movieron). */
export function cambio(antes: Foto, despues: Foto): Map<string, number> {
  const salida = new Map<string, number>();
  for (const [nombre, valor] of despues) {
    const d = Math.round((valor - (antes.get(nombre) ?? 0)) * 10_000) / 10_000;
    if (d !== 0) salida.set(nombre, d);
  }
  return salida;
}

/** Lo que el LIBRO espera que se mueva por lo vendido: cada línea × la receta de su producto (signo negativo). */
export function esperadoPorVentas(
  lineas: readonly { readonly producto: string; readonly cantidad: number }[],
): Map<string, number> {
  const salida = new Map<string, number>();
  for (const l of lineas)
    for (const [insumo, porUnidad] of Object.entries(consumoPorUnidad(l.producto)))
      salida.set(
        insumo,
        Math.round(((salida.get(insumo) ?? 0) - porUnidad * l.cantidad) * 10_000) / 10_000,
      );
  return salida;
}

export interface Punto {
  readonly paso: string;
  readonly punto: string;
  readonly esperado: string;
  readonly obtenido: string;
  readonly cuadra: boolean;
  readonly captura?: string;
}

export interface Informe {
  punto(
    paso: string,
    punto: string,
    esperado: unknown,
    obtenido: unknown,
    captura?: string,
  ): boolean;
  /** Un hallazgo o una nota que no es una comparación. */
  nota(paso: string, texto: string): void;
  puntos(): readonly Punto[];
}

export function abrirInforme(salida: string): Informe {
  mkdirSync(salida, { recursive: true });
  const lista: Punto[] = [];
  return {
    punto(paso, punto, esperado, obtenido, captura) {
      const e = JSON.stringify(esperado);
      const o = JSON.stringify(obtenido);
      const cuadra = e === o;
      const fila: Punto = {
        paso,
        punto,
        esperado: e,
        obtenido: o,
        cuadra,
        ...(captura === undefined ? {} : { captura }),
      };
      lista.push(fila);
      appendFileSync(join(salida, 'puntos.jsonl'), `${JSON.stringify(fila)}\n`);
      process.stdout.write(
        `${cuadra ? 'CUADRA ' : 'NO-CUADRA'} [${paso}] ${punto}: esperado ${e} · obtenido ${o}\n`,
      );
      return cuadra;
    },
    nota(paso, texto) {
      appendFileSync(join(salida, 'notas.txt'), `[${paso}] ${texto}\n`);
      process.stdout.write(`NOTA [${paso}] ${texto}\n`);
    },
    puntos: () => lista,
  };
}

/** Una captura con nombre de paso (la que se MIRA con Read). */
export async function captura(pagina: Page, salida: string, nombre: string): Promise<string> {
  const ruta = join(salida, `${nombre}.png`);
  await pagina.screenshot({ path: ruta }).catch(() => undefined);
  return ruta;
}

/** Una línea planeada de un producto del catálogo, con su importe esperado por el libro. */
export function lineaDe(
  catalogo: readonly ProductoConocido[],
  nombre: string,
  cantidad: number,
  opciones: readonly { grupo: string; opcion: string }[] = [],
): LineaPlaneada {
  const producto = catalogo.find((p) => p.nombre === nombre);
  if (producto === undefined) throw new Error(`El catálogo no trae «${nombre}».`);
  const elegidas = opciones.map((o) => {
    const grupo = producto.grupos.find((g) => g.nombre === o.grupo);
    const op = grupo?.opciones.find((x) => x.nombre === o.opcion);
    if (op === undefined) throw new Error(`«${nombre}» no trae la opción ${o.grupo}/${o.opcion}.`);
    return { grupo: o.grupo, opcion: o.opcion, deltaCentavos: op.deltaCentavos };
  });
  return {
    producto,
    cantidad,
    opciones: elegidas,
    nota: '',
    importeCentavos: importeEsperado(
      producto.tipoVenta,
      producto.precioCentavos,
      cantidad,
      elegidas.map((o) => o.deltaCentavos),
    ),
  };
}

/** El texto de «ahora» en la base (hora simulada), para acotar el kardex del paso. */
export async function ahoraDeLaBase(baseUrl: string): Promise<string> {
  const [f] = await leerSql<{ ahora: string }>(baseUrl, 'select now()::text as ahora');
  return f?.ahora ?? new Date().toISOString();
}
