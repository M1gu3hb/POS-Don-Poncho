/**
 * EL DÍA DE HOY, EL DEL NEGOCIO (DP-22 · hallazgo 1).
 *
 * `new Date().toISOString().slice(0, 10)` da el día en UTC. En México eso es «mañana» desde las
 * 18:00: a esa hora «Registrar gasto» y «Registrar compra» proponían la fecha del día siguiente, y
 * un gasto en efectivo con esa fecha lo rechazaba el servidor (el cajón es el de HOY). El
 * restaurante cierra a las 19:00: pasaba todos los días, en la última hora.
 *
 * El día se toma en la zona del NEGOCIO, no en UTC ni en la del aparato (una tableta con el huso
 * mal puesto no cambia de día antes que la caja). El servidor hace lo mismo con la zona de la
 * organización (`reportes/dia.ts`); aquí vale la de Don Poncho, como en `espera/reloj.ts`.
 *
 * Puro: sin React ni navegador, para probarse a cualquier hora y en cualquier huso.
 */
export const ZONA_DEL_NEGOCIO = 'America/Mexico_City';

const formateadores = new Map<string, Intl.DateTimeFormat>();

function formateadorDe(zona: string): Intl.DateTimeFormat {
  const guardado = formateadores.get(zona);
  if (guardado !== undefined) return guardado;
  const nuevo = new Intl.DateTimeFormat('en-CA', {
    timeZone: zona,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  formateadores.set(zona, nuevo);
  return nuevo;
}

/** El día (`AAAA-MM-DD`) en que cae un instante, en la zona del negocio. */
export function diaDelNegocioDe(instante: Date, zona: string = ZONA_DEL_NEGOCIO): string {
  if (Number.isNaN(instante.getTime())) return '';
  const partes = formateadorDe(zona).formatToParts(instante);
  const parte = (tipo: Intl.DateTimeFormatPartTypes): string =>
    partes.find((p) => p.type === tipo)?.value ?? '';
  return `${parte('year')}-${parte('month')}-${parte('day')}`;
}

/** El día de HOY del negocio (`AAAA-MM-DD`). */
export function hoyDelNegocio(ahora: Date = new Date(), zona: string = ZONA_DEL_NEGOCIO): string {
  return diaDelNegocioDe(ahora, zona);
}

const SOLO_DIA = /^\d{4}-\d{2}-\d{2}$/u;

/**
 * El día del negocio de un valor que viene del servidor: un día suelto (`2026-11-16`) se queda
 * como está; un instante (`2026-11-17T01:30:00Z`) cae en el día del negocio en que pasó. Lo que
 * no se entiende da cadena vacía (no coincide con ningún día).
 */
export function diaDelNegocioDeUnValor(valor: unknown, zona: string = ZONA_DEL_NEGOCIO): string {
  if (typeof valor !== 'string' || valor === '') return '';
  if (SOLO_DIA.test(valor)) return valor;
  return diaDelNegocioDe(new Date(valor), zona);
}
