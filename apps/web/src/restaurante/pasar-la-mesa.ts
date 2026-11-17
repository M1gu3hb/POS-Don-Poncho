import { puedeAjustarLaCuenta } from './ajustes-de-la-cuenta-por-rol.ts';

/**
 * PASAR LA MESA A OTRO MESERO (DP-D156), sin pantalla.
 *
 * `restaurante.relevar_responsable` (F-325) existía sin pantalla: el mesero de mediodía se va, la
 * mesa sigue viva, y nadie podía decir en el sistema «ésta ahora es de Beto». Esta pantalla lo dice
 * para UNA mesa (el comando acepta `ordenId`); el relevo de todo un turno sigue sin pantalla.
 *
 * ── Quién lo ve ─────────────────────────────────────────────────────────────
 * Lo que el comando deja y nada más: gerente, administrador, dueño y cajero. En los nombres de la
 * sesión son `administrador` (los tres primeros) y `caja`, los mismos que ya decide
 * `puedeAjustarLaCuenta`; se reutiliza para que no haya dos listas que se desfasen. El mesero NO:
 * «relevar es una decisión de quien manda el turno, no del que se va» (`relevo.ts`). No se inventa
 * ningún permiso; el servidor sigue siendo el que manda.
 *
 * ── A quién ─────────────────────────────────────────────────────────────────
 * A un mesero activo que no sea quien ya la atiende. El comando sólo exige que esté activo; la
 * pantalla ofrece meseros porque «pasar la mesa» es una frase de sala.
 */

export interface UsuarioLeido {
  readonly id: string;
  readonly nombre: string;
  /** El puesto REAL de la base (`mesero`, `cajero`, `gerente`…), no el de la sesión. */
  readonly rol: string;
  readonly activo: boolean;
}

export interface MeseroElegible {
  readonly id: string;
  readonly nombre: string;
}

/** ¿Se ofrece «Pasar la mesa»? Falla cerrado: sin saber quién la atiende no hay a quién relevar. */
export function puedePasarLaMesa(
  rol: string | null,
  atiendeId: string | null | undefined,
): boolean {
  if (atiendeId === null || atiendeId === undefined || atiendeId === '') return false;
  return puedeAjustarLaCuenta(rol);
}

/** Los meseros activos a quienes se les puede pasar la mesa, por nombre, sin el que ya la atiende. */
export function meserosParaPasar(
  usuarios: readonly UsuarioLeido[],
  atiendeId: string | null | undefined,
): readonly MeseroElegible[] {
  return usuarios
    .filter((u) => u.activo && u.rol === 'mesero' && u.id !== atiendeId)
    .map((u) => ({ id: u.id, nombre: u.nombre }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es-MX', { sensitivity: 'base' }));
}

/** «¿Pasar la mesa 4 de Ana a Beto?» */
export function preguntaDelRelevo(datos: {
  readonly mesa: number;
  readonly sale: string | null;
  readonly entra: string;
}): string {
  const de = datos.sale === null || datos.sale === '' ? '' : ` de ${datos.sale}`;
  return `¿Pasar la mesa ${String(datos.mesa)}${de} a ${datos.entra}?`;
}

/** «La mesa 4 quedó con Beto» */
export function avisoDelRelevo(datos: { readonly mesa: number; readonly entra: string }): string {
  return `La mesa ${String(datos.mesa)} quedó con ${datos.entra}`;
}

/** El cuerpo de `/api/restaurante/relevar` para pasar ESTA cuenta, y sólo ésta. */
export function entradaDelRelevo(datos: {
  readonly ordenId: string;
  readonly saleId: string;
  readonly entraId: string;
}): {
  readonly ordenId: string;
  readonly empleadoSaleId: string;
  readonly empleadoEntraId: string;
} {
  return {
    ordenId: datos.ordenId,
    empleadoSaleId: datos.saleId,
    empleadoEntraId: datos.entraId,
  };
}
