/**
 * DP-18 · Cómo se dice una caja abierta en otro aparato (la pantalla, sin React, para probarlo).
 *
 * DP-21 · Bloque 5: la caja ya no es el aparato. Cada caja es un LUGAR de la sucursal con su
 * nombre («Caja principal», «Caja 2») y el aparato sólo la tiene abierta: «Caja principal · abierta
 * en «iMin mostrador»», «Traer Caja principal a este aparato», «Abrir Caja 2 aquí».
 */
export interface CajaEnOtroAparato {
  readonly sesionCajaId: string;
  readonly terminalNombre: string | null;
  readonly abiertaPor: string | null;
  readonly abiertaEn: string;
  readonly puedoTraerla: boolean;
  /** El lugar de la caja (1, 2…). Una sesión de antes de DP-21 no lo tiene. */
  readonly lugar?: number | null;
  /** «Caja principal»: el nombre que le puso el dueño al lugar, o «Caja N». */
  readonly nombreDeLaCaja?: string | null;
}

/** Un lugar de caja sin abrir, como lo manda `caja.estado`. */
export interface LugarLibre {
  readonly lugar: number;
  readonly nombre: string;
}

const ZONA = 'America/Mexico_City';

/** El aparato: ««iMin mostrador»» u «otro aparato» si nadie le puso nombre. */
export function dondeEsta(caja: Pick<CajaEnOtroAparato, 'terminalNombre'>): string {
  const nombre = (caja.terminalNombre ?? '').trim();
  return nombre === '' ? 'Otro aparato' : `«${nombre}»`;
}

/** La caja, por su nombre. Con una sesión de antes (sin lugar), «La caja». */
export function cualCaja(caja: Pick<CajaEnOtroAparato, 'lugar' | 'nombreDeLaCaja'>): string {
  const nombre = (caja.nombreDeLaCaja ?? '').trim();
  if (caja.lugar === null || caja.lugar === undefined || nombre === '') return 'La caja';
  return nombre;
}

/** «Caja principal · abierta en «iMin mostrador»». */
export function cajaYDonde(
  caja: Pick<CajaEnOtroAparato, 'lugar' | 'nombreDeLaCaja' | 'terminalNombre'>,
): string {
  const aparato = dondeEsta(caja);
  return `${cualCaja(caja)} · abierta en ${aparato === 'Otro aparato' ? 'otro aparato' : aparato}`;
}

/** «Traer Caja principal a este aparato». */
export function textoDeTraer(caja: Pick<CajaEnOtroAparato, 'lugar' | 'nombreDeLaCaja'>): string {
  const cual = cualCaja(caja);
  return `Traer ${cual === 'La caja' ? 'la caja' : cual} a este aparato`;
}

/** «Abrir Caja 2 aquí». */
export function textoDeAbrir(lugar: Pick<LugarLibre, 'nombre'>): string {
  return `Abrir ${lugar.nombre} aquí`;
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

/** «por Ana desde las 10:14»: lo de `abiertaDesde` sin repetir «abierta» tras «abierta en…». */
export function porQuienYDesde(
  caja: Pick<CajaEnOtroAparato, 'abiertaPor' | 'abiertaEn'>,
  ahora: Date = new Date(),
): string {
  return abiertaDesde(caja, ahora).replace(/^abierta\s+/, '');
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
