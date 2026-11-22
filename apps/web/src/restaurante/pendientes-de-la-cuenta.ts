import type { PlatilloDelAviso } from './avisos-de-listo.ts';

/**
 * DP-25 · Parte 2 · Lo que el servidor contesta cuando se pide la cuenta y a la mesa todavía le
 * faltan platillos por entregar (`restaurante.solicitar_cuenta`, regla `CUENTA_CON_PENDIENTES`).
 *
 * La lista viaja como texto JSON en `datos.pendientes` (los datos de un error sólo llevan
 * escalares). Se lee con cuidado: una lista mal formada devuelve `null` y NO abre el aviso, para
 * que el mesero no vea una pantalla vacía ni se pierda el mensaje de otro rechazo.
 */

export interface GrupoPendiente {
  /** La estación como esté configurada; `null` si la comanda no guardó el nombre. */
  readonly estacion: string | null;
  readonly platillos: readonly PlatilloDelAviso[];
}

export interface PendientesDeLaCuenta {
  readonly sinPreparar: readonly GrupoPendiente[];
  readonly listos: readonly GrupoPendiente[];
}

export const REGLA_CUENTA_CON_PENDIENTES = 'CUENTA_CON_PENDIENTES';

type Registro = Readonly<Record<string, unknown>>;

const esRegistro = (valor: unknown): valor is Registro =>
  typeof valor === 'object' && valor !== null && !Array.isArray(valor);

const textoONulo = (valor: unknown): string | null | undefined =>
  valor === null || typeof valor === 'string' ? valor : undefined;

function leerPlatillo(valor: unknown): PlatilloDelAviso | null {
  if (!esRegistro(valor)) return null;
  const tipoVenta = textoONulo(valor['tipoVenta']);
  const unidadVariable = textoONulo(valor['unidadVariable']);
  const { id, nombre, cantidad } = valor;
  if (typeof id !== 'string' || id === '') return null;
  if (typeof nombre !== 'string' || typeof cantidad !== 'string') return null;
  if (tipoVenta === undefined || unidadVariable === undefined) return null;
  return { id, nombre, cantidad, tipoVenta, unidadVariable };
}

function leerGrupos(valor: unknown): readonly GrupoPendiente[] | null {
  if (!Array.isArray(valor)) return null;
  const grupos: GrupoPendiente[] = [];
  for (const crudo of valor as readonly unknown[]) {
    if (!esRegistro(crudo) || !Array.isArray(crudo['platillos'])) return null;
    const estacion = textoONulo(crudo['estacion']);
    const platillos = (crudo['platillos'] as readonly unknown[]).map(leerPlatillo);
    if (estacion === undefined || platillos.length === 0) return null;
    if (platillos.some((p) => p === null)) return null;
    grupos.push({ estacion, platillos: platillos as readonly PlatilloDelAviso[] });
  }
  return grupos;
}

/** La lista de pendientes de un rechazo, o `null` si no es este rechazo o viene mal formada. */
export function pendientesDelRechazo(
  datos: Readonly<Record<string, unknown>> | null | undefined,
): PendientesDeLaCuenta | null {
  if (datos?.['regla'] !== REGLA_CUENTA_CON_PENDIENTES) return null;
  const crudo = datos['pendientes'];
  if (typeof crudo !== 'string') return null;
  let leido: unknown;
  try {
    leido = JSON.parse(crudo);
  } catch {
    return null;
  }
  if (!esRegistro(leido)) return null;
  const sinPreparar = leerGrupos(leido['sinPreparar']);
  const listos = leerGrupos(leido['listos']);
  if (sinPreparar === null || listos === null) return null;
  if (sinPreparar.length === 0 && listos.length === 0) return null;
  return { sinPreparar, listos };
}
