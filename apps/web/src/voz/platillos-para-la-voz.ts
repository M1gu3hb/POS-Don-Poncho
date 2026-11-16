import { opcionesDelServidor, separarOpcionesYNota } from '~/cocina/opciones-y-nota';
import { esPorPeso } from '~/restaurante/peso';

import {
  cantidadEnPalabras,
  medidasEnPalabras,
  nombreEnPlural,
  numeroSinCeros,
  pesoEnPalabras,
} from './palabras';

/**
 * DP-21 · Bloque 8 · LOS PLATILLOS DE UNA COMANDA, COMO LOS DICE LA VOZ DE COCINA.
 *
 * Los renglones iguales —mismo platillo, mismas opciones y misma nota— se juntan ANTES de hablar:
 * tres toques de «+» sobre un platillo con opciones son tres renglones, y la voz repetía el nombre
 * tres veces sin decir cuántos. La cantidad va primero y en palabras: «tres Consomés de carnero,
 * dos Mixiotes». Lo que va por peso dice su peso: «medio kilo de Barbacoa de horno».
 */

/** Lo que la voz lee de un renglón; sale del puente (`PedidoPreparacion.items`) o del teléfono. */
export interface PlatilloParaLaVoz {
  readonly producto_id?: string | null | undefined;
  readonly producto_nombre?: string | null | undefined;
  readonly cantidad?: number | string | null | undefined;
  readonly notas?: string | null | undefined;
  /** Grupo y nombres elegidos: arreglo, o su texto JSON como lo sirve el puente. */
  readonly opciones?: unknown;
  readonly tipo_venta?: string | null | undefined;
  readonly unidad_variable?: string | null | undefined;
  readonly cantidad_variable?: number | string | null | undefined;
}

/** Cuántos platillos distintos se leen; el resto se cuenta («y dos más»), no se calla. */
export const MAXIMO_DE_PLATILLOS_HABLADOS = 8;

interface Grupo {
  readonly nombre: string;
  readonly detalles: readonly string[];
  readonly peso: { readonly valor: number; readonly unidad: string } | null;
  cantidad: number;
}

function aNumero(valor: number | string | null | undefined): number {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
}

function sinEspaciosDeMas(texto: string): string {
  return texto.trim().replace(/\s+/g, ' ');
}

function detallesDe(item: PlatilloParaLaVoz): readonly string[] {
  const { opciones, nota } = separarOpcionesYNota(item.notas, opcionesDelServidor(item.opciones));
  const dichas = opciones.flatMap((grupo) => grupo.opciones);
  const notaLimpia = sinEspaciosDeMas(nota);
  return notaLimpia === '' ? dichas : [...dichas, notaLimpia];
}

function pesoDe(item: PlatilloParaLaVoz): Grupo['peso'] {
  if (!esPorPeso(item)) return null;
  const valor = aNumero(item.cantidad_variable ?? item.cantidad);
  if (valor <= 0) return null;
  const unidad = (item.unidad_variable ?? '').trim();
  return { valor, unidad: unidad === '' ? 'kg' : unidad };
}

/** Lo que hace «el mismo renglón»: platillo, peso, opciones y nota, sin mayúsculas ni espacios de más. */
function llaveDe(nombre: string, item: PlatilloParaLaVoz, detalles: readonly string[]): string {
  const platillo = item.producto_id ?? nombre.toLowerCase();
  const peso = pesoDe(item);
  const sello = peso === null ? '' : `${numeroSinCeros(peso.valor)}${peso.unidad}`;
  const dichos = [...detalles].map((d) => d.toLowerCase()).join('|');
  return [platillo, sello, dichos].join('\u0000');
}

/** Junta los renglones iguales, en el orden en que aparece cada uno por primera vez. */
function agrupar(items: readonly PlatilloParaLaVoz[]): readonly Grupo[] {
  const porLlave = new Map<string, Grupo>();
  for (const item of items) {
    const nombre = sinEspaciosDeMas(item.producto_nombre ?? '');
    if (nombre === '') continue;
    const detalles = detallesDe(item);
    const llave = llaveDe(nombre, item, detalles);
    const peso = pesoDe(item);
    const piezas = peso === null ? aNumero(item.cantidad) || 1 : 1;
    const existente = porLlave.get(llave);
    if (existente === undefined) porLlave.set(llave, { nombre, detalles, peso, cantidad: piezas });
    else existente.cantidad += piezas;
  }
  return [...porLlave.values()];
}

/** «tres Consomés de carnero», «dos de Pulque natural» o «Taco de barbacoa» (una pieza, sin cantidad). */
function frasePorPiezas(nombre: string, cantidad: number): string {
  if (cantidad === 1) return nombre;
  const palabra = cantidadEnPalabras(cantidad);
  const plural = nombreEnPlural(nombre);
  return plural === null ? `${palabra} de ${nombre}` : `${palabra} ${plural}`;
}

/** «medio kilo de Barbacoa de horno»; repetido: «dos de medio kilo de Barbacoa de horno». */
function frasePorPeso(
  nombre: string,
  peso: NonNullable<Grupo['peso']>,
  repeticiones: number,
): string {
  const dicho = `${pesoEnPalabras(peso.valor, peso.unidad)} de ${nombre}`;
  return repeticiones === 1 ? dicho : `${cantidadEnPalabras(repeticiones)} de ${dicho}`;
}

function fraseDelGrupo(grupo: Grupo): string {
  const cabeza =
    grupo.peso === null
      ? frasePorPiezas(grupo.nombre, grupo.cantidad)
      : frasePorPeso(grupo.nombre, grupo.peso, grupo.cantidad);
  return medidasEnPalabras([cabeza, ...grupo.detalles].join(', '));
}

/**
 * Los platillos de una comanda, dichos: vacío si no hay ninguno que leer. Se separan con coma; si
 * alguno lleva opciones o nota (que también van con coma), con punto y coma, para que se oiga
 * dónde acaba uno y empieza otro.
 */
export function frasePlatillos(items: readonly PlatilloParaLaVoz[]): string {
  const grupos = agrupar(items);
  const leidos = grupos.slice(0, MAXIMO_DE_PLATILLOS_HABLADOS);
  const separador = leidos.some((g) => g.detalles.length > 0) ? '; ' : ', ';
  const dicho = leidos.map(fraseDelGrupo).join(separador);
  const sinLeer = grupos.length - leidos.length;
  if (sinLeer === 0) return dicho;
  return `${dicho} y ${sinLeer === 1 ? 'uno' : cantidadEnPalabras(sinLeer)} más`;
}
