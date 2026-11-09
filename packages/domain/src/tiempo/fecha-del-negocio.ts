/**
 * LA HORA DEL RESTAURANTE EN UN ARCHIVO (DP-15 · F2).
 *
 * Los instantes viajan en UTC; el dueño los lee en la hora del negocio (America/Mexico_City en
 * Don Poncho, la `organizaciones.zona_horaria`). Un CSV que corta el ISO en UTC dice 18:06 para
 * una venta de las 12:06. Puro: sin reloj, sin red.
 */

export const ZONA_DEL_NEGOCIO = 'America/Mexico_City';

const SOLO_DIA = /^\d{4}-\d{2}-\d{2}$/;
const INSTANTE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})$/;

const formateadores = new Map<string, Intl.DateTimeFormat>();

function formateadorDe(zona: string): Intl.DateTimeFormat {
  const guardado = formateadores.get(zona);
  if (guardado !== undefined) return guardado;
  const nuevo = new Intl.DateTimeFormat('en-CA', {
    timeZone: zona,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  formateadores.set(zona, nuevo);
  return nuevo;
}

/** ¿Es un instante ISO con zona («…T18:06:13.000Z»)? Lo demás no es una hora que convertir. */
export function esInstanteIso(valor: string): boolean {
  return INSTANTE.test(valor);
}

/**
 * «2026-11-08 12:06:13» en la zona del negocio. Un día sin hora («2026-11-08») se devuelve tal
 * cual: moverlo de zona lo pasaría al día anterior. Vacío o ilegible: cadena vacía.
 */
export function fechaYHoraDelNegocio(
  valor: string | Date | null | undefined,
  zona: string = ZONA_DEL_NEGOCIO,
): string {
  if (valor === null || valor === undefined || valor === '') return '';
  if (typeof valor === 'string' && SOLO_DIA.test(valor)) return valor;
  const fecha = valor instanceof Date ? valor : new Date(valor);
  if (Number.isNaN(fecha.getTime())) return '';
  const partes = new Map(
    formateadorDe(zona)
      .formatToParts(fecha)
      .map((p) => [p.type, p.value]),
  );
  const p = (tipo: Intl.DateTimeFormatPartTypes): string => partes.get(tipo) ?? '00';
  return `${p('year')}-${p('month')}-${p('day')} ${p('hour')}:${p('minute')}:${p('second')}`;
}
