import type { Rol } from '@morphiqpos/contracts';

/**
 * CUÁNTO VIVE UNA SESIÓN, POR PUESTO (DP-21 · Bloque 2 · M14, O10 y A18).
 *
 * Antes: 8 horas para todos y cookie persistente. Dos problemas con una sola constante: al
 * reabrir la app el administrador entraba sin PIN (O10), y la jornada de Don Poncho, de 8:00 a
 * 19:00, le pedía el PIN a todos a media tarde (A18).
 *
 * | Puesto | Cookie | En el servidor |
 * | --- | --- | --- |
 * | Dueño, administrador, gerente | de sesión (se va al cerrar) | 30 min que se renuevan con el uso; tope de 12 h |
 * | Cajero y almacén | de sesión | la jornada: 12 h desde el PIN, sin renovar |
 * | Mesero y cocina | recordada | 12 h que se renuevan con el uso |
 *
 * **La vigencia que manda es la del servidor** (`sesiones.expira_en`): la cookie y el `exp` del
 * token sólo ponen el tope. Si la app estuvo cerrada más que la vigencia, la sesión ya no existe
 * y la siguiente petición recibe 401, tenga la cookie que tenga.
 *
 * El almacén va con el cajero y no con las estaciones: registra compras (que pueden salir del
 * cajón) y mermas. Un rol que no esté en la tabla cae en la clase más estricta.
 */

export type ClaseDeSesion = 'mando' | 'caja' | 'estacion';

export interface PoliticaDeSesion {
  readonly clase: ClaseDeSesion;
  /** `true`: la cookie lleva `Max-Age` y sobrevive a cerrar la app. `false`: cookie de sesión. */
  readonly cookieRecordada: boolean;
  /** Lo que vive la fila de `sesiones` desde el PIN o desde el último uso. */
  readonly vigenciaSegundos: number;
  /** `true`: cada uso corre el vencimiento. `false`: vence a su hora, se use o no. */
  readonly seRenueva: boolean;
  /** El `exp` del token y el `Max-Age` de la cookie recordada: nada vive más que esto. */
  readonly topeSegundos: number;
}

const MINUTO = 60;
const HORA = 60 * MINUTO;
const DIA = 24 * HORA;

const POLITICAS: Readonly<Record<ClaseDeSesion, PoliticaDeSesion>> = {
  mando: {
    clase: 'mando',
    cookieRecordada: false,
    vigenciaSegundos: 30 * MINUTO,
    seRenueva: true,
    topeSegundos: 12 * HORA,
  },
  caja: {
    clase: 'caja',
    cookieRecordada: false,
    vigenciaSegundos: 12 * HORA,
    seRenueva: false,
    topeSegundos: 12 * HORA,
  },
  estacion: {
    clase: 'estacion',
    cookieRecordada: true,
    vigenciaSegundos: 12 * HORA,
    seRenueva: true,
    // Una semana de tope para la cookie y el token; lo que decide es la fila del servidor, que
    // se vence a las 12 h sin uso (de un día para otro, siempre).
    topeSegundos: 7 * DIA,
  },
};

const CLASES: Readonly<Partial<Record<Rol, ClaseDeSesion>>> = {
  dueno: 'mando',
  administrador: 'mando',
  gerente: 'mando',
  cajero: 'caja',
  almacen: 'caja',
  mesero: 'estacion',
  cocina: 'estacion',
};

export function claseDeSesion(rol: Rol): ClaseDeSesion {
  return CLASES[rol] ?? 'mando';
}

export function politicaDeSesion(rol: Rol): PoliticaDeSesion {
  return POLITICAS[claseDeSesion(rol)];
}

/**
 * La renovación no escribe en cada petición (las pantallas sondean cada pocos segundos): sólo
 * cuando correría el vencimiento más de este margen.
 */
export const MARGEN_DE_RENOVACION_SEGUNDOS = 60;

/**
 * El vencimiento nuevo de una sesión que se acaba de usar, o `null` si no hay nada que escribir.
 *
 * Nunca acorta (una sesión de antes de este cambio, de 8 h, se queda con las suyas) y nunca pasa
 * del tope del token.
 */
export function nuevaExpiracion(datos: {
  readonly rol: Rol;
  readonly ahora: Date;
  readonly expiraEn: Date;
  readonly topeDelToken: Date;
}): Date | null {
  const politica = politicaDeSesion(datos.rol);
  if (!politica.seRenueva) return null;
  const deseada = datos.ahora.getTime() + politica.vigenciaSegundos * 1000;
  const nueva = Math.min(deseada, datos.topeDelToken.getTime());
  if (nueva - datos.expiraEn.getTime() < MARGEN_DE_RENOVACION_SEGUNDOS * 1000) return null;
  return new Date(nueva);
}
