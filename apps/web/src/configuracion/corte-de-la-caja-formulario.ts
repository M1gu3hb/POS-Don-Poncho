/**
 * «COSTOS AL CAJERO» Y «COMISIÓN DE LA TERMINAL» EN LA PANTALLA (DP-21 · Bloque 20). Puro.
 *
 * Viven en `configuracion.valores` (`mostrar_costos_a_caja`, `comision_terminal_bp`); los guarda el
 * dueño o el administrador con `caja.fijar_ajustes_del_corte`. La comisión se TECLEA en porcentaje
 * («3.6») y viaja en puntos base (360, de 0 a 1000).
 */

export interface AjustesDelCorteEditables {
  readonly mostrarCostosACaja: boolean;
  /** Lo tecleado: «3.6», o vacío si no hay tasa. */
  readonly comision: string;
}

export interface EntradaDeAjustesDelCorte {
  readonly mostrarCostosACaja: boolean;
  readonly comisionTerminalBp: number | null;
}

/** La llave de la consulta: cuelga de `configuracion`, que se refresca al guardar. */
export const CLAVE_DE_LOS_AJUSTES_DEL_CORTE = ['configuracion', 'ajustes_del_corte'] as const;

const TOPE_EN_PUNTOS_BASE = 1_000;

/** 360 puntos base → «3.6»; sin tasa → vacío. */
export function comisionEnTexto(puntosBase: number | null): string {
  if (puntosBase === null) return '';
  const enteros = Math.trunc(puntosBase / 100);
  const resto = puntosBase % 100;
  if (resto === 0) return String(enteros);
  const decimales = String(resto).padStart(2, '0').replace(/0$/, '');
  return `${String(enteros)}.${decimales}`;
}

/** Lo que dice la configuración; lo que falte o no se entienda: el cajero no ve costos y no hay tasa. */
export function ajustesDelCorteLeidos(
  configuracion:
    | { readonly mostrar_costos_a_caja?: unknown; readonly comision_terminal_bp?: unknown }
    | undefined
    | null,
): AjustesDelCorteEditables {
  const tasa = configuracion?.comision_terminal_bp;
  const valida =
    typeof tasa === 'number' && Number.isInteger(tasa) && tasa >= 0 && tasa <= TOPE_EN_PUNTOS_BASE;
  return {
    mostrarCostosACaja: configuracion?.mostrar_costos_a_caja === true,
    comision: comisionEnTexto(valida ? tasa : null),
  };
}

/** Sólo dígitos y un punto con hasta dos decimales: lo demás no entra al campo. */
export function comisionTecleada(texto: string): string {
  const limpio = texto.replace(',', '.').replace(/[^0-9.]/g, '');
  const [enteros = '', ...resto] = limpio.split('.');
  const decimales = resto.join('').slice(0, 2);
  const conEnteros = enteros.slice(0, 2);
  return resto.length === 0 ? conEnteros : `${conEnteros}.${decimales}`;
}

export function ajustesDelCorteIguales(
  a: AjustesDelCorteEditables,
  b: AjustesDelCorteEditables,
): boolean {
  return a.mostrarCostosACaja === b.mostrarCostosACaja && a.comision === b.comision;
}

/** Lo que viaja al comando, o el motivo por el que todavía no se puede guardar. */
export function entradaDeLosAjustesDelCorte(
  a: AjustesDelCorteEditables,
):
  | { readonly ok: true; readonly entrada: EntradaDeAjustesDelCorte }
  | { readonly ok: false; readonly mensaje: string } {
  const texto = a.comision.trim();
  if (texto === '') {
    return {
      ok: true,
      entrada: { mostrarCostosACaja: a.mostrarCostosACaja, comisionTerminalBp: null },
    };
  }
  if (!/^\d+(\.\d{1,2})?$/.test(texto)) {
    return { ok: false, mensaje: 'La comisión es un porcentaje, como 3.6.' };
  }
  const puntosBase = Math.round(Number(texto) * 100);
  if (puntosBase > TOPE_EN_PUNTOS_BASE) {
    return { ok: false, mensaje: 'La comisión de la terminal va de 0 % a 10 %.' };
  }
  return {
    ok: true,
    entrada: { mostrarCostosACaja: a.mostrarCostosACaja, comisionTerminalBp: puntosBase },
  };
}
