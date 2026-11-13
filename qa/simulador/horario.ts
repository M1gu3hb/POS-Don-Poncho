/**
 * EL HORARIO DE LLEGADAS DEL DÍA: qué grupos llegan, a qué hora simulada y qué hacen, todo a
 * partir de la semilla y del perfil del día. Misma semilla y mismo perfil, mismo día.
 *
 * `Llegada.horaSim` son MINUTOS DESDE LA MEDIANOCHE de la hora simulada de CDMX (8:00 = 480). Los
 * picos van de 13:30 a 16:30, como en Don Poncho.
 */
import type { Llegada } from './mundo.ts';
import type { Azar } from './semilla.ts';

export const APERTURA_MIN = 8 * 60;
export const CIERRE_MIN = 19 * 60;
/** Lo menos que dura un grupo en la mesa. */
export const ESTANCIA_MINIMA_MIN = 35;
/** Cuánto aguanta un grupo esperando mesa antes de irse (minutos simulados). */
export const ESPERA_MAXIMA_MIN = 45;
/** Desde qué minuto ya no se sienta a nadie: los que siguen esperando se van. */
export const ULTIMA_MESA_MIN = CIERRE_MIN - 15;

export interface PerfilDelDia {
  /** Cuentas de mesa del día (grupos que se sientan). */
  readonly cuentas: number;
  /** Parte de ellas que usa el portal del QR (0–1). */
  readonly proporcionQr: number;
  /** Probabilidad de que el grupo celebre algo. */
  readonly celebracion: number;
}

export const PERFIL_NORMAL: PerfilDelDia = { cuentas: 130, proporcionQr: 0.56, celebracion: 0.07 };

/**
 * El peso de cada tramo de media hora (empieza en las 8:00): lo que pesa llegar a esa hora.
 *
 * Calibrado con el día 1: 20 mesas con estancias de ~66 min sientan ~16 grupos por hora. El primer
 * reparto metía el 60 % entre 13:00 y 17:00 y casi nada en la mañana: en el pico la fila llegaba a
 * 17 grupos, al cierre quedaban sin sentar y el día no alcanzaba las 120 cuentas de mesa. Ahora la
 * tercera parte llega antes de la una, el pico de 13:30 a 16:30 sigue (≥ 40 %, las 20 mesas
 * llenas) y nadie llega después de las 18:30 (antes esos tramos se recortaban a las 18:15 y se
 * amontonaban ahí).
 */
const PESO_DE_CADA_MEDIA_HORA: readonly number[] = [
  0.5, 0.8, 1.1, 1.4, 1.7, 2.0, 2.2, 2.4, 2.6, 2.8, 3.0, 3.6, 3.8, 3.8, 3.8, 3.6, 3.4, 2.7, 2.3,
  1.8, 1.2, 0, 0,
];

/**
 * Los grupos que ya llegaron y se cansan de esperar mesa: llevan más de `ESPERA_MAXIMA_MIN` en
 * la fila, o siguen en ella a las 18:45. En la quinta corrida del día 1 la fila llegó a 20 grupos y
 * a las 20:30 aún esperaban 6: la gente de verdad se va, y el día tiene que poder terminar.
 */
export function quienesSeVan(llegadas: readonly Llegada[], minuto: number): readonly Llegada[] {
  return llegadas.filter(
    (l) =>
      l.horaSim <= minuto && (minuto - l.horaSim > ESPERA_MAXIMA_MIN || minuto >= ULTIMA_MESA_MIN),
  );
}

/**
 * Cuánto se queda en la mesa un grupo que se sienta a `minuto`: lo suyo, pero sin pasar de las
 * 19:00 (salvo los 35 min mínimos de quien se sienta tarde). En la quinta corrida del día 1 los
 * grupos sentados a las 18:00 con estancias de 95 min dejaron 19 mesas ocupadas a las 19:00, y el
 * día llegó al tope con 12 abiertas y las cajas sin poder cerrar.
 */
export function estanciaAlSentarse(
  llegada: Pick<Llegada, 'minutosEnLaMesa'>,
  minuto: number,
): number {
  return Math.min(llegada.minutosEnLaMesa, Math.max(ESTANCIA_MINIMA_MIN, CIERRE_MIN - minuto));
}

/** Minutos desde la medianoche de la hora simulada (zona de CDMX). */
export function minutoDelDia(fecha: Date): number {
  const partes = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Mexico_City',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(fecha);
  const dato = (tipo: string): number => Number(partes.find((p) => p.type === tipo)?.value ?? '0');
  return (dato('hour') % 24) * 60 + dato('minute');
}

export function horaDicha(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function elegirTramo(azar: Azar): number {
  const total = PESO_DE_CADA_MEDIA_HORA.reduce((s, p) => s + p, 0);
  let punto = azar.real() * total;
  for (let i = 0; i < PESO_DE_CADA_MEDIA_HORA.length; i += 1) {
    punto -= PESO_DE_CADA_MEDIA_HORA[i] ?? 0;
    if (punto <= 0) return i;
  }
  return PESO_DE_CADA_MEDIA_HORA.length - 1;
}

/** Cuántas personas: casi siempre 2–4, a veces solo y a veces familia grande. */
function personasDeUnGrupo(azar: Azar): number {
  const p = azar.real();
  if (p < 0.08) return 1;
  if (p < 0.5) return 2;
  if (p < 0.72) return 3;
  if (p < 0.88) return 4;
  return azar.entero(5, 6);
}

export function generarHorario(
  azar: Azar,
  perfil: PerfilDelDia = PERFIL_NORMAL,
  prefijo = 'L',
): Llegada[] {
  const llegadas: Llegada[] = [];
  for (let i = 0; i < perfil.cuentas; i += 1) {
    const tramo = elegirTramo(azar);
    const minuto = Math.min(CIERRE_MIN - 45, APERTURA_MIN + tramo * 30 + azar.entero(0, 29));
    const usaQr = azar.probabilidad(perfil.proporcionQr);
    llegadas.push({
      id: '',
      horaSim: minuto,
      personas: personasDeUnGrupo(azar),
      usaQr,
      telefonos: usaQr ? azar.entero(2, 4) : 0,
      minutosEnLaMesa: azar.entero(ESTANCIA_MINIMA_MIN, 95),
      rondas: azar.entero(1, 3),
      celebracion: azar.probabilidad(perfil.celebracion),
    });
  }
  return llegadas
    .sort((a, b) => a.horaSim - b.horaSim)
    .map((l, i) => ({ ...l, id: `${prefijo}${String(i + 1).padStart(3, '0')}` }));
}

/** Un horario corto para el ensayo: `n` grupos en la primera hora, sin celebraciones al azar. */
export function horarioDeEnsayo(
  azar: Azar,
  desdeMin: number,
  grupos: number,
  conQr: number,
): Llegada[] {
  const salida: Llegada[] = [];
  for (let i = 0; i < grupos; i += 1) {
    const usaQr = i % 2 === 1 && (i - 1) / 2 < conQr;
    salida.push({
      id: `E${String(i + 1).padStart(2, '0')}`,
      horaSim: desdeMin + i * 6,
      personas: azar.entero(2, 4),
      usaQr,
      telefonos: usaQr ? 2 : 0,
      minutosEnLaMesa: azar.entero(20, 30),
      rondas: azar.entero(1, 2),
      celebracion: i === 0,
    });
  }
  return salida;
}
