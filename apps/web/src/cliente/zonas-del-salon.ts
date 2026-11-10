/**
 * DP-15 · CREAR Y RENOMBRAR ZONAS DESDE LA PANTALLA (informativo QA2-B3 de `docs/qa/HALLAZGOS.md`).
 *
 * No había pantalla para dar de alta una zona («Terraza», «Jardín») y el puente deja repetir el
 * nombre. La regla, una sola vez: el nombre no va vacío, cabe en 40 letras y no repite el de otra
 * zona activa (sin importar mayúsculas ni espacios de más). Las mesas guardan la zona por su id, así
 * que renombrarla cambia el nombre en todas a la vez.
 *
 * DP-15.1 · Una zona también se puede DESACTIVAR (y reactivar). La regla de qué pasa con sus mesas
 * la decide el servidor (`restaurante.fijar_zona_activa`): con mesas ocupadas, con cuenta abierta o
 * unidas no se deja y dice cuáles; con las mesas libres, las apaga con la zona y al reactivarla
 * vuelven las mismas. Aquí sólo se pide y se separan las zonas en servicio de las apagadas.
 */

import { invocarComando } from './api.ts';

export interface ZonaParaValidar {
  readonly id: string;
  readonly nombre?: string | null;
  readonly activo?: boolean | null;
  readonly orden?: number | null;
}

export const LARGO_MAXIMO_DE_ZONA = 40;

const comparable = (texto: string) => texto.trim().replace(/\s+/g, ' ').toLocaleLowerCase('es-MX');

/** El motivo para no guardar ese nombre, o nulo si se puede. */
export function problemaDelNombreDeZona(
  nombre: string,
  zonas: readonly ZonaParaValidar[],
  idQueSeEdita: string | null,
): string | null {
  const limpio = nombre.trim().replace(/\s+/g, ' ');
  if (limpio === '') return 'Escribe el nombre de la zona.';
  if (limpio.length > LARGO_MAXIMO_DE_ZONA) {
    return `El nombre cabe en ${String(LARGO_MAXIMO_DE_ZONA)} letras.`;
  }
  const repetida = zonas.some(
    (z) =>
      z.id !== idQueSeEdita &&
      z.activo !== false &&
      typeof z.nombre === 'string' &&
      comparable(z.nombre) === comparable(limpio),
  );
  return repetida ? `Ya hay una zona «${limpio}».` : null;
}

/** El orden de una zona nueva: después de la última. */
export function ordenDeLaZonaNueva(zonas: readonly ZonaParaValidar[]): number {
  return zonas.reduce((mayor, z) => Math.max(mayor, Number(z.orden) || 0), 0) + 1;
}

const porOrden = <Z extends ZonaParaValidar>(zonas: readonly Z[]): Z[] =>
  [...zonas].sort(
    (a, b) =>
      (Number(a.orden) || 0) - (Number(b.orden) || 0) ||
      (a.nombre ?? '').localeCompare(b.nombre ?? '', 'es-MX'),
  );

/** Las zonas en servicio (las que el plano del mesero y el editor ofrecen). */
export const zonasEnServicio = <Z extends ZonaParaValidar>(zonas: readonly Z[]): Z[] =>
  porOrden(zonas.filter((z) => z.activo !== false));

/** Las zonas apagadas: se listan aparte para poder reactivarlas. */
export const zonasApagadas = <Z extends ZonaParaValidar>(zonas: readonly Z[]): Z[] =>
  porOrden(zonas.filter((z) => z.activo === false));

export interface ResultadoDeZonaActiva {
  readonly zonaId: string;
  readonly activa: boolean;
  readonly mesasAfectadas: number;
  /** DP-16 · Al reactivar: lo que no se pudo volver, dicho. `null` si todo cuadró. */
  readonly aviso?: string | null;
}

/** Desactiva o reactiva una zona; el servidor rechaza con el motivo si no se puede. */
export function fijarZonaActiva(zonaId: string, activa: boolean): Promise<ResultadoDeZonaActiva> {
  return invocarComando<ResultadoDeZonaActiva>('/api/restaurante/fijar-zona-activa', {
    zonaId,
    activa,
  });
}
