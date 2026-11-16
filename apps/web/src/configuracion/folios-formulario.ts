import { folioVisible, prefijoDeFolioValido } from '@morphiqpos/domain/venta';

/**
 * «PREFIJO DEL FOLIO» Y «PRIMER FOLIO» DE LA CONFIGURACIÓN (DP-21 · Bloque 6). Puro.
 *
 * Viven en `configuracion.valores.folios`; los guarda el dueño con `configuracion.fijar_folios`.
 * Aquí se lee lo guardado, se valida lo tecleado y se arma la vista previa («DP-01001»).
 */

export interface FoliosEditables {
  readonly prefijo: string;
  readonly primerFolioDeCuentas: string;
  readonly primerFolioDeCortes: string;
}

export interface EntradaDeFolios {
  readonly prefijo: string | null;
  readonly primerFolioDeCuentas: number;
  readonly primerFolioDeCortes: number;
}

/** La llave de la consulta: cuelga de `configuracion`, que se refresca al guardar. */
export const CLAVE_DE_LOS_FOLIOS = ['configuracion', 'folios'] as const;

const TOPE = 99_999_999;

/** Lo que dice la configuración; lo que falte, lo de un negocio nuevo (sin prefijo, desde 1). */
export function foliosLeidos(
  configuracion:
    { readonly folios?: unknown; readonly operacion_desde?: unknown } | undefined | null,
): FoliosEditables & { readonly operaDesde: string | null } {
  const crudo = configuracion?.folios;
  const f = typeof crudo === 'object' && crudo !== null ? (crudo as Record<string, unknown>) : {};
  const numero = (v: unknown): string =>
    typeof v === 'number' && Number.isInteger(v) && v >= 1 ? String(v) : '1';
  const desde = configuracion?.operacion_desde;
  return {
    prefijo: typeof f['prefijo'] === 'string' ? f['prefijo'] : '',
    primerFolioDeCuentas: numero(f['primerFolioDeCuentas']),
    primerFolioDeCortes: numero(f['primerFolioDeCortes']),
    operaDesde: typeof desde === 'string' && desde !== '' ? desde : null,
  };
}

/** Sólo letras A–Z, en mayúsculas y hasta cuatro: lo demás no entra al campo. */
export function prefijoTecleado(texto: string): string {
  return texto
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 4);
}

/** Sólo dígitos. */
export function numeroTecleado(texto: string): string {
  return texto.replace(/\D/g, '').slice(0, 8);
}

export function foliosIgualesEnPantalla(a: FoliosEditables, b: FoliosEditables): boolean {
  return (
    a.prefijo === b.prefijo &&
    a.primerFolioDeCuentas === b.primerFolioDeCuentas &&
    a.primerFolioDeCortes === b.primerFolioDeCortes
  );
}

/** Lo que viaja al comando, o el motivo por el que todavía no se puede guardar. */
export function entradaDeLosFolios(
  f: FoliosEditables,
):
  | { readonly ok: true; readonly entrada: EntradaDeFolios }
  | { readonly ok: false; readonly mensaje: string } {
  const prefijo = prefijoDeFolioValido(f.prefijo);
  if (!prefijo.ok) return { ok: false, mensaje: prefijo.mensaje };
  const cuentas = Number(f.primerFolioDeCuentas);
  const cortes = Number(f.primerFolioDeCortes);
  for (const n of [cuentas, cortes]) {
    if (!Number.isInteger(n) || n < 1 || n > TOPE) {
      return { ok: false, mensaje: 'El primer folio es un número de 1 a 99 999 999.' };
    }
  }
  return {
    ok: true,
    entrada: {
      prefijo: prefijo.prefijo,
      primerFolioDeCuentas: cuentas,
      primerFolioDeCortes: cortes,
    },
  };
}

/** «Así se verá: DP-01001 · corte DPC-0101». */
export function vistaPreviaDeLosFolios(f: FoliosEditables): string {
  const prefijo = prefijoDeFolioValido(f.prefijo);
  const configuracion = { folios: { prefijo: prefijo.ok ? prefijo.prefijo : null } };
  const cuenta = folioVisible('A', Number(f.primerFolioDeCuentas) || 1, configuracion, 'numero');
  const corte = folioVisible('CC', Number(f.primerFolioDeCortes) || 1, configuracion);
  return `Así se verá: ${cuenta} · corte ${corte}`;
}

/** Por qué el primer folio no se puede cambiar ahora, o `null` si se puede. */
export function porQueNoSeCambiaElPrimerFolio(
  operaDesde: string | null,
  hayFolios: boolean,
): string | null {
  if (operaDesde !== null) return 'El negocio ya opera: lo cobrado ya no se renumera.';
  if (hayFolios)
    return 'Ya hay cuentas o cortes con folio: el primer folio sólo se cambia con los folios en cero.';
  return null;
}
