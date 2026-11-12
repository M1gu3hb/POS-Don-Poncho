/**
 * LO QUE PIDE UN GRUPO: de la suerte con semilla y del catálogo que el personal conoce salen las
 * líneas de una ronda (de todos los tipos de producto: por pieza, con opciones obligatorias y
 * múltiples, barbacoa por peso y «sólo presentaciones»), cada una con su importe ESPERADO.
 *
 * El importe lo calcula el bot con `importeEsperado` a partir del precio del catálogo; nunca lo lee
 * de la pantalla que está probando.
 */
import { importeEsperado } from './libro.ts';
import type { GrupoConocido, Mundo, ProductoConocido } from './mundo.ts';
import type { Azar } from './semilla.ts';

export interface OpcionElegida {
  readonly grupo: string;
  readonly opcion: string;
  readonly deltaCentavos: number;
}

export interface LineaPlaneada {
  readonly producto: ProductoConocido;
  /** Piezas, o kilos si el producto se vende por peso. */
  readonly cantidad: number;
  readonly opciones: readonly OpcionElegida[];
  readonly nota: string;
  readonly importeCentavos: number;
}

export const esPorPeso = (p: ProductoConocido): boolean =>
  p.tipoVenta === 'variable_medida' || p.tipoVenta === 'porcion_contenedor';

const NOTAS_CORTAS: readonly string[] = [
  'sin cebolla',
  'poca salsa',
  'bien cocido',
  'sin cilantro',
  'para llevar aparte',
  'con limón',
  'sin hielo',
];

export const NOTA_LARGA =
  'Es para una persona con alergia a los frutos secos y al cacahuate: por favor usen utensilios limpios, ' +
  'no toquen nada con mantequilla ni con salsas de la mesa de al lado, y avísenme si algo lleva nuez, ' +
  'porque la señora de la esquina es muy delicada y no queremos sustos en su cumpleaños.';

/** Elige las opciones de un grupo respetando lo obligatorio, el mínimo y el máximo. */
export function elegirOpciones(azar: Azar, grupo: GrupoConocido): OpcionElegida[] {
  const activas = grupo.opciones.filter((o) => o.activa);
  if (activas.length === 0) return [];
  const minimo = grupo.minimo ?? (grupo.obligatorio ? 1 : 0);
  const tope = Math.min(
    activas.length,
    grupo.tipo === 'unica' ? 1 : (grupo.maximo ?? activas.length),
  );
  if (tope === 0) return [];
  const cuantas =
    grupo.tipo === 'unica'
      ? grupo.obligatorio || azar.probabilidad(0.6)
        ? 1
        : 0
      : azar.entero(Math.min(minimo, tope), tope);
  return azar
    .barajar(activas)
    .slice(0, cuantas)
    .map((o) => ({ grupo: grupo.nombre, opcion: o.nombre, deltaCentavos: o.deltaCentavos }));
}

function kilosDe(azar: Azar, p: ProductoConocido): number {
  if (p.presentaciones.length > 0 && (p.soloPresentaciones || azar.probabilidad(0.6)))
    return azar.elegir(p.presentaciones);
  return azar.elegir([0.35, 0.4, 0.75, 1.25, 1.5, 2]);
}

export function planearLinea(azar: Azar, p: ProductoConocido, conNota: boolean): LineaPlaneada {
  const opciones = p.grupos.flatMap((g) => elegirOpciones(azar, g));
  const cantidad = esPorPeso(p)
    ? kilosDe(azar, p)
    : azar.probabilidad(0.75)
      ? 1
      : azar.entero(2, 3);
  const nota = conNota ? azar.elegir(NOTAS_CORTAS) : '';
  const importeCentavos = importeEsperado(
    p.tipoVenta,
    p.precioCentavos,
    cantidad,
    opciones.map((o) => o.deltaCentavos),
  );
  return { producto: p, cantidad, opciones, nota, importeCentavos };
}

/** Los productos que se pueden pedir hoy: no agotados y con todas las obligatorias elegibles. */
export function pedibles(mundo: Mundo): ProductoConocido[] {
  return mundo.catalogo.filter(
    (p) =>
      !mundo.agotados.has(p.nombre) &&
      !mundo.agotados.has(p.id) &&
      p.grupos.every((g) => !g.obligatorio || g.opciones.some((o) => o.activa)),
  );
}

/**
 * Las líneas de una ronda para `personas` comensales: de 1 a 6, con un reparto que mezcla piezas
 * sencillas, productos con opciones y, de vez en cuando, algo por peso.
 */
export function planearRonda(
  azar: Azar,
  mundo: Mundo,
  personas: number,
  maximoDeLineas = 6,
): LineaPlaneada[] {
  const todos = pedibles(mundo);
  const conOpciones = todos.filter((p) => p.grupos.length > 0);
  const porPeso = todos.filter(esPorPeso);
  const sencillos = todos.filter((p) => p.grupos.length === 0 && !esPorPeso(p));
  const n = Math.max(1, Math.min(maximoDeLineas, personas + azar.entero(0, 2)));
  const lineas: LineaPlaneada[] = [];
  for (let i = 0; i < n; i += 1) {
    const dado = azar.real();
    const lista =
      dado < 0.12 && porPeso.length > 0
        ? porPeso
        : dado < 0.4 && conOpciones.length > 0
          ? conOpciones
          : sencillos;
    const elegible = lista.length > 0 ? lista : todos;
    if (elegible.length === 0) break;
    lineas.push(planearLinea(azar, azar.elegir(elegible), azar.probabilidad(0.18)));
  }
  return lineas;
}

export const totalDe = (lineas: readonly LineaPlaneada[]): number =>
  lineas.reduce((s, l) => s + l.importeCentavos, 0);
