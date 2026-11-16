/**
 * EL PIN DE ESTA EJECUCIÓN (DP-21 · Bloque 2 · M14 y O10).
 *
 * Miguel reabría la app y el administrador entraba sin PIN. La regla nueva, por puesto:
 *
 * | Puesto | Al abrir la app | Sin tocar la pantalla |
 * | --- | --- | --- |
 * | Dueño, administrador y gerente | siempre PIN | candado con PIN a los 10 min (de 5 a 30) |
 * | Cajero y almacén | siempre PIN | sin candado propio («Pedir PIN al despertar», si está) |
 * | Mesero y cocina | entra directo mientras la sesión viva | sin candado |
 *
 * El servidor ya hace su parte (`sesion/politica.ts`: cookie de sesión y vigencia corta para el
 * mando). Esto es la parte de la pantalla: una marca en `sessionStorage`, que dura lo que dura
 * ESTA ejecución de la app (se va al cerrarla), dice que quien tiene la sesión ya tecleó su PIN
 * aquí. Una pantalla nueva sin la marca arranca con el candado, aunque la cookie siga viva.
 *
 * La marca no es un secreto ni da acceso a nada: la sesión sigue en la cookie `HttpOnly`. Sólo
 * guarda de quién es (el id del empleo), para que la de otra persona no cuente.
 */
export const CLAVE_DEL_PIN_DE_ESTA_EJECUCION = 'morphiqpos.pin-de-esta-ejecucion';

interface Almacen {
  getItem(clave: string): string | null;
  setItem(clave: string, valor: string): void;
  removeItem(clave: string): void;
}

export type ClaseDelPuesto = 'mando' | 'caja' | 'estacion';

/**
 * La clase del puesto, con el rol que la pantalla conoce (el vocabulario de la sesión: dueño,
 * administrador y gerente llegan los tres como «administrador»; el cajero, como «caja»).
 * Lo que no se reconoce cae en la más estricta. Es el espejo de `claseDeSesion` del servidor.
 */
export function claseDelPuesto(rol: string | null | undefined): ClaseDelPuesto {
  switch (rol) {
    case 'mesero':
    case 'cocina':
      return 'estacion';
    case 'caja':
    case 'cajero':
    case 'almacen':
      return 'caja';
    default:
      return 'mando';
  }
}

/** ¿Este puesto teclea su PIN cada vez que se abre la app? Todos menos las estaciones. */
export function pidePinAlAbrir(clase: ClaseDelPuesto): boolean {
  return clase !== 'estacion';
}

/** ¿Este puesto se cierra solo si nadie toca la pantalla? Sólo el mando. */
export function seCierraSinUso(clase: ClaseDelPuesto): boolean {
  return clase === 'mando';
}

/** El almacén de ESTA ejecución; `null` si el navegador no lo deja usar. */
export function almacenDeLaEjecucion(): Almacen | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

/** ¿Quien tiene la sesión ya tecleó su PIN en esta ejecución? La marca de otra persona no cuenta. */
export function tecleoSuPin(almacen: Almacen | null, empleoId: string): boolean {
  try {
    return almacen?.getItem(CLAVE_DEL_PIN_DE_ESTA_EJECUCION) === empleoId;
  } catch {
    // Sin almacén no hay marca que leer: se pide el PIN (falla cerrado).
    return false;
  }
}

const oyentes = new Set<() => void>();

function avisar(): void {
  for (const oyente of oyentes) oyente();
}

/** Para que el candado se entere en el momento (el `sessionStorage` no avisa en su misma pestaña). */
export function suscribirAlPin(oyente: () => void): () => void {
  oyentes.add(oyente);
  return () => {
    oyentes.delete(oyente);
  };
}

/** El servidor acaba de aceptar el PIN de este empleo: esta ejecución ya no lo pide. */
export function marcarPin(almacen: Almacen | null, empleoId: string): void {
  try {
    almacen?.setItem(CLAVE_DEL_PIN_DE_ESTA_EJECUCION, empleoId);
  } catch {
    // Sin almacén la marca no se guarda: la próxima pantalla volverá a pedir el PIN.
  }
  avisar();
}

/** Salir, cambiar de persona o el candado por falta de uso: se vuelve a pedir el PIN. */
export function olvidarPin(almacen: Almacen | null): void {
  try {
    almacen?.removeItem(CLAVE_DEL_PIN_DE_ESTA_EJECUCION);
  } catch {
    // Sin almacén no había marca guardada.
  }
  avisar();
}

/** Los minutos sin tocar la pantalla tras los que el mando se cierra: de 5 a 30, 10 por omisión. */
export const MINUTOS_DEL_CANDADO = { minimo: 5, maximo: 30, porOmision: 10 } as const;

/** Las opciones que ofrece la Configuración. */
export const OPCIONES_DEL_CANDADO: readonly number[] = [5, 10, 15, 20, 30];

/** Lo que diga la configuración, si es un entero de 5 a 30; si no, 10. */
export function minutosDelCandado(valor: unknown): number {
  return typeof valor === 'number' &&
    Number.isInteger(valor) &&
    valor >= MINUTOS_DEL_CANDADO.minimo &&
    valor <= MINUTOS_DEL_CANDADO.maximo
    ? valor
    : MINUTOS_DEL_CANDADO.porOmision;
}

/** ¿Ya pasó el tiempo sin tocar la pantalla? */
export function venceElCandado(ultimoToqueMs: number, ahoraMs: number, minutos: number): boolean {
  return ahoraMs - ultimoToqueMs >= minutos * 60_000;
}
