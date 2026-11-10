import { centavosDeLasOpciones } from '~/restaurante/toma-de-pedido/precio-de-las-opciones';

/**
 * DP-16 · ELEGIR LAS OPCIONES DE UN PLATILLO, DESDE EL TELÉFONO DEL COMENSAL.
 *
 * Las mismas reglas que el mesero (`SeleccionModificadoresDialog`) y que el servidor
 * (`opciones-de-la-linea.ts`): obligatorio, mínimo y máximo de un grupo de varias, y el precio de
 * cada opción (por unidad en una pieza; una vez por renglón en lo que va por peso). Aquí sólo se
 * ENSEÑA y se avisa: el precio que cuenta lo pone el servidor al escribir la línea.
 */

export interface OpcionParaElegir {
  readonly id: string;
  readonly nombre: string;
  /** Centavos con signo, como texto; ausente si el negocio no enseña precios. */
  readonly precioCentavos?: string;
}

export interface GrupoParaElegir {
  readonly nombre: string;
  readonly tipo: 'unica' | 'multiple';
  readonly obligatorio: boolean;
  readonly minimo?: number | null;
  readonly maximo?: number | null;
  readonly opciones: readonly OpcionParaElegir[];
}

export type Seleccion = Readonly<Record<string, ReadonlySet<string>>>;

export interface GrupoElegido {
  readonly grupo_nombre: string;
  readonly tipo: 'unica' | 'multiple';
  readonly opciones: readonly { id: string; nombre: string; precioCentavos: string }[];
}

/** Cuántas hay que elegir como mínimo (nunca más de las que hay). */
function minimoDe(grupo: GrupoParaElegir): number {
  const pedido = grupo.tipo === 'multiple' ? (grupo.minimo ?? 0) : 0;
  const base = Math.max(pedido, grupo.obligatorio ? 1 : 0);
  return Math.min(base, grupo.opciones.length);
}

/** Lo que falta para poder agregar el platillo, o `null` si el grupo está bien. */
export function faltaEnElGrupo(
  grupo: GrupoParaElegir,
  elegidas: ReadonlySet<string>,
): string | null {
  const minimo = minimoDe(grupo);
  // Un grupo opcional se puede dejar vacío; si se empieza a elegir, cuenta su mínimo.
  if (elegidas.size === 0 && !grupo.obligatorio) return null;
  if (elegidas.size >= minimo) return null;
  return minimo <= 1
    ? `Elige una opción en ${grupo.nombre}`
    : `Elige al menos ${String(minimo)} en ${grupo.nombre}`;
}

/** ¿Se puede tocar una opción más que no está elegida? (el tope de un grupo de varias). */
export function puedeElegirOtra(grupo: GrupoParaElegir, elegidas: ReadonlySet<string>): boolean {
  if (grupo.tipo !== 'multiple') return true;
  const maximo = grupo.maximo ?? null;
  return maximo === null || elegidas.size < maximo;
}

/** «Obligatorio · de 2 a 3», «Opcional · hasta 2». */
export function avisoDelGrupo(grupo: GrupoParaElegir): string {
  const base = grupo.obligatorio ? 'Obligatorio' : 'Opcional';
  if (grupo.tipo !== 'multiple') return base;
  const minimo = grupo.minimo ?? null;
  const maximo = grupo.maximo ?? null;
  if (minimo !== null && minimo > 1 && maximo !== null) {
    return `${base} · de ${String(minimo)} a ${String(maximo)}`;
  }
  if (minimo !== null && minimo > 1) return `${base} · al menos ${String(minimo)}`;
  if (maximo !== null) return `${base} · hasta ${String(maximo)}`;
  return `${base} · varias`;
}

/** Lo elegido, por grupo y en el orden del grupo, con el precio de cada opción. */
export function elegidasConPrecio(
  grupos: readonly GrupoParaElegir[],
  seleccion: Seleccion,
): readonly GrupoElegido[] {
  return grupos
    .map((g) => {
      const elegidas = seleccion[g.nombre] ?? new Set<string>();
      return {
        grupo_nombre: g.nombre,
        tipo: g.tipo,
        opciones: g.opciones
          .filter((o) => elegidas.has(o.id))
          .map((o) => ({ id: o.id, nombre: o.nombre, precioCentavos: o.precioCentavos ?? '0' })),
      };
    })
    .filter((g) => g.opciones.length > 0);
}

/**
 * Lo que se enseña en «Agregar · $…», en pesos. En una pieza: (precio + opciones) × cantidad.
 * En lo que va por peso (`precioPorPeso`, el importe de lo pesado): + las opciones una vez.
 */
export function totalDeLaLinea(p: {
  readonly precio: number;
  readonly cantidad: number;
  readonly elegidas: readonly GrupoElegido[];
  readonly precioPorPeso?: number;
}): number {
  const opciones = centavosDeLasOpciones(p.elegidas);
  const centavos =
    p.precioPorPeso === undefined
      ? (Math.round(p.precio * 100) + opciones) * p.cantidad
      : Math.round(p.precioPorPeso * 100) + opciones;
  return Math.max(0, centavos) / 100;
}
