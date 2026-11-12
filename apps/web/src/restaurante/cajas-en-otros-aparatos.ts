/**
 * DP-18 · Cómo se dice una caja abierta en otro aparato (la pantalla, sin React, para probarlo).
 */
export interface CajaEnOtroAparato {
  readonly sesionCajaId: string;
  readonly terminalNombre: string | null;
  readonly abiertaPor: string | null;
  readonly abiertaEn: string;
  readonly puedoTraerla: boolean;
}

const ZONA = 'America/Mexico_City';

/** «Caja 2» o «Otro aparato» si nadie le puso nombre. */
export function dondeEsta(caja: Pick<CajaEnOtroAparato, 'terminalNombre'>): string {
  const nombre = (caja.terminalNombre ?? '').trim();
  return nombre === '' ? 'Otro aparato' : `«${nombre}»`;
}

const fechaEnCdmx = (d: Date) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);

/** «abierta por Ana desde las 10:14» (hoy) o «… desde el 10 nov. a las 22:05» (otro día). */
export function abiertaDesde(
  caja: Pick<CajaEnOtroAparato, 'abiertaPor' | 'abiertaEn'>,
  ahora: Date = new Date(),
): string {
  const desde = new Date(caja.abiertaEn);
  const hora = new Intl.DateTimeFormat('es-MX', {
    timeZone: ZONA,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(desde);
  const quien = (caja.abiertaPor ?? '').trim();
  const por = quien === '' ? 'abierta' : `abierta por ${quien}`;
  if (fechaEnCdmx(desde) === fechaEnCdmx(ahora)) return `${por} desde las ${hora}`;
  const dia = new Intl.DateTimeFormat('es-MX', {
    timeZone: ZONA,
    day: 'numeric',
    month: 'short',
  }).format(desde);
  return `${por} desde el ${dia} a las ${hora}`;
}

/** Lo que dice el cupo cuando este aparato no tiene caja. */
export function textoDelCupo(c: {
  readonly puedoAbrir: boolean;
  readonly cupo: number;
  readonly abiertas: number;
}): string {
  const plural = (n: number) => (n === 1 ? 'caja abierta' : 'cajas abiertas');
  if (c.puedoAbrir) {
    return `Hay ${String(c.abiertas)} ${plural(c.abiertas)} y caben ${String(c.cupo)}: puedes abrir otra aquí o trasladar una.`;
  }
  return `Ya hay ${String(c.abiertas)} ${plural(c.abiertas)} de ${String(c.cupo)}: trasládala aquí o ciérrala en su aparato.`;
}
