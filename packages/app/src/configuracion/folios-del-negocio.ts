import { z } from 'zod';

/**
 * LOS FOLIOS DEL NEGOCIO (DP-21 · Bloque 6): `configuracion.valores.folios` y `operacion_desde`.
 *
 * Un solo lector para cada clave, como `impuestoEn`. Sin escribir nada, el negocio lee sus folios
 * como siempre: sin prefijo y empezando en 1.
 *
 *   · `folios.prefijo`: de 2 a 4 letras (para Don Poncho, «DP»). Sólo cambia cómo se LEE el folio
 *     (`@morphiqpos/domain/venta`, `folioVisible`); el consecutivo es el de siempre.
 *   · `folios.primerFolioDeCuentas` y `primerFolioDeCortes`: con qué número empieza cada serie
 *     (1001 las cuentas, 101 los cortes). Sólo se cambian con los folios en cero.
 *   · `operacion_desde`: cuándo empezó a operar de verdad el negocio (ISO 8601 con zona). Con ella,
 *     lo cobrado ya no se borra (`mantenimiento/operacion-real.ts`).
 *
 * Sin dependencias del servidor: lo usan el puente que sirve a las pantallas, los comandos que lo
 * guardan y los que lo consultan.
 */

export const CLAVE_DE_FOLIOS = 'folios';
export const CLAVE_DE_OPERACION_DESDE = 'operacion_desde';

/** Un tope razonable: ocho cifras. Más allá, un teclazo de más sería un folio absurdo. */
export const PRIMER_FOLIO_MAXIMO = 99_999_999;

export interface FoliosDelNegocio {
  /** De 2 a 4 letras A–Z en mayúsculas, o `null`: el folio se lee como siempre. */
  readonly prefijo: string | null;
  readonly primerFolioDeCuentas: number;
  readonly primerFolioDeCortes: number;
}

/** Con lo que nace un negocio y con lo que opera el que nunca lo tocó: sin prefijo, desde 1. */
export const FOLIOS_DE_UN_NEGOCIO_NUEVO: FoliosDelNegocio = {
  prefijo: null,
  primerFolioDeCuentas: 1,
  primerFolioDeCortes: 1,
};

const primerFolio = z.number().int().min(1).max(PRIMER_FOLIO_MAXIMO);

/**
 * Lo que se acepta al GUARDAR (el prefijo se valida y se pasa a mayúsculas en el comando, que es
 * quien puede decir por qué no).
 */
export const esquemaDeFolios = z.strictObject({
  prefijo: z.string().max(40).nullable(),
  primerFolioDeCuentas: primerFolio,
  primerFolioDeCortes: primerFolio,
});

/** Al LEER, cada campo por separado y tolerante: el que no se entiende vale lo de siempre. */
const prefijoGuardado = z
  .string()
  .regex(/^[A-Z]{2,4}$/)
  .nullable();

function esDocumento(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

/**
 * Los folios que dice el documento. Lo que falte o esté dañado se completa con lo de un negocio
 * nuevo, campo por campo: un JSON malformado NO tumba el cobro (se lee sin prefijo).
 */
export function foliosEn(valores: unknown): FoliosDelNegocio {
  if (!esDocumento(valores)) return FOLIOS_DE_UN_NEGOCIO_NUEVO;
  const crudo = valores[CLAVE_DE_FOLIOS];
  if (!esDocumento(crudo)) return FOLIOS_DE_UN_NEGOCIO_NUEVO;
  const campo = <T>(esquema: z.ZodType<T>, valor: unknown, defecto: T): T => {
    const leido = esquema.safeParse(valor);
    return leido.success ? leido.data : defecto;
  };
  return {
    prefijo: campo(prefijoGuardado, crudo['prefijo'], null),
    primerFolioDeCuentas: campo(primerFolio, crudo['primerFolioDeCuentas'], 1),
    primerFolioDeCortes: campo(primerFolio, crudo['primerFolioDeCortes'], 1),
  };
}

export function foliosIguales(a: FoliosDelNegocio, b: FoliosDelNegocio): boolean {
  return (
    a.prefijo === b.prefijo &&
    a.primerFolioDeCuentas === b.primerFolioDeCuentas &&
    a.primerFolioDeCortes === b.primerFolioDeCortes
  );
}

/** Una fecha ISO 8601 con zona («2026-11-16T15:04:05.123Z» o con `-06:00`). */
const FECHA_CON_ZONA = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

/**
 * Desde cuándo opera de verdad el negocio, o `null` (sin bloqueo: la clave no está).
 *
 * Falla CERRADA: si la clave está pero no se entiende, el bloqueo vale desde el principio de los
 * tiempos (cualquier cuenta lo activa) y se quita, como siempre, con su comando. Un valor dañado
 * no puede ser la manera de dejar borrar lo cobrado.
 */
export function operacionDesdeEn(valores: unknown): Date | null {
  if (!esDocumento(valores)) return null;
  const crudo = valores[CLAVE_DE_OPERACION_DESDE];
  if (crudo === undefined || crudo === null) return null;
  if (typeof crudo !== 'string' || !FECHA_CON_ZONA.test(crudo)) return new Date(0);
  const fecha = new Date(crudo);
  return Number.isNaN(fecha.getTime()) ? new Date(0) : fecha;
}
