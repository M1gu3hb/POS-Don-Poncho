/**
 * EL FOLIO COMO SE LEE (DP-21 · Bloque 6). Puro: sin base, sin servidor, sin React.
 *
 * El número de una cuenta o de un corte sale del consecutivo atómico (`folios`, serie `A` las
 * cuentas y `CC` los cortes de caja) y NO cambia. Lo que cambia es cómo se lee, y lo decide el
 * negocio con un prefijo de 2 a 4 letras:
 *
 *   · cuentas: `<PREFIJO>-<número de al menos 5 dígitos>`      «DP-01001»  (100 000 → «DP-100000»)
 *   · cortes:  `<PREFIJO>C-<número de al menos 4 dígitos>`      «DPC-0101»
 *
 * Sin prefijo, cada sitio dice EXACTAMENTE lo que decía antes: el documento del corte «A-3» y
 * «CC-2» (`corte-heredado/folio-y-mesa.ts`), el ticket y la lista de la Caja el número a secas
 * («3»). Por eso `folioVisible` recibe cómo lo decía el sitio (`comoHoy`). Las demás series (`REM`,
 * `CR`, `LIQ`, `CT`…) no cambian con o sin prefijo.
 *
 * Es la ÚNICA función que arma un folio para leerlo: una prueba de contrato de la web
 * (`folio.contrato.test.ts`) no deja pintar `.folio` crudo.
 */

export const SERIE_DE_CUENTAS = 'A';
export const SERIE_DE_CORTES = 'CC';

/** Cifras mínimas con las que se lee el consecutivo; al pasarlas, el número crece solo. */
export const CIFRAS_DE_CUENTAS = 5;
export const CIFRAS_DE_CORTES = 4;

const PREFIJO_VALIDO = /^[A-Z]{2,4}$/;
const NUMERO = /^\d+$/;
const COMPUESTO = /^([A-Za-z]{1,6})-(\d+)$/;

/** Lo que el documento de configuración sabe de los folios (`configuracion.valores.folios`). */
export interface AjusteDeFolios {
  readonly prefijo?: string | null;
}

/** La configuración tal como llega a una pantalla: lo único que se mira es `folios.prefijo`. */
export interface ConFolios {
  readonly folios?: AjusteDeFolios | null;
}

/** Cómo decía el sitio el folio sin prefijo: el número a secas, o con su serie («A-3»). */
export type ComoHoy = 'numero' | 'con-serie';

export type ResultadoDelPrefijo =
  | { readonly ok: true; readonly prefijo: string | null }
  | { readonly ok: false; readonly mensaje: string };

/**
 * El prefijo que se guarda: de 2 a 4 letras A–Z, en mayúsculas (sin acentos, ñ, espacios ni
 * dígitos). Vacío o nulo es «sin prefijo».
 */
export function prefijoDeFolioValido(texto: string | null | undefined): ResultadoDelPrefijo {
  const limpio = (texto ?? '').trim().toUpperCase();
  if (limpio === '') return { ok: true, prefijo: null };
  if (!PREFIJO_VALIDO.test(limpio)) {
    return {
      ok: false,
      mensaje:
        'El prefijo lleva de 2 a 4 letras, de la A a la Z, sin acentos, espacios ni números.',
    };
  }
  return { ok: true, prefijo: limpio };
}

/** El prefijo vigente de una configuración, o `null` si no hay o no es válido. */
export function prefijoDeLosFolios(configuracion: ConFolios | null | undefined): string | null {
  const prefijo = configuracion?.folios?.prefijo;
  return typeof prefijo === 'string' && PREFIJO_VALIDO.test(prefijo) ? prefijo : null;
}

interface FolioSeparado {
  /** La serie en mayúsculas, o vacía si no se sabe. */
  readonly serie: string;
  /** El consecutivo, sin espacios. Vacío si no hay folio. */
  readonly numero: string;
  /** El folio como llegó, si ya venía armado con su serie («A-3»). */
  readonly compuesto: string | null;
}

function separar(serie: unknown, folio: unknown): FolioSeparado {
  const texto =
    typeof folio === 'string' || typeof folio === 'number' || typeof folio === 'bigint'
      ? String(folio).trim()
      : '';
  const laSerie = typeof serie === 'string' ? serie.trim().toUpperCase() : '';
  if (texto === '') return { serie: laSerie, numero: '', compuesto: null };
  if (laSerie === '') {
    const partes = COMPUESTO.exec(texto);
    if (partes !== null) {
      return { serie: (partes[1] ?? '').toUpperCase(), numero: partes[2] ?? '', compuesto: texto };
    }
  }
  return { serie: laSerie, numero: texto, compuesto: null };
}

/** Rellena con ceros a la izquierda hasta `cifras`; nunca recorta. */
function conCeros(numero: string, cifras: number): string {
  return String(BigInt(numero)).padStart(cifras, '0');
}

/**
 * El folio listo para pintar. Vacío si no hay folio todavía (la cuenta recibe el suyo al
 * cobrarse): quien lo pinta decide qué decir en su lugar.
 *
 * Con prefijo, las cuentas (`A`) y los cortes (`CC`) se leen «DP-01001» y «DPC-0101». Un número
 * sin serie conocida NO se disfraza de cuenta: se queda como viene.
 */
export function folioVisible(
  serie: string | null | undefined,
  folio: string | number | bigint | null | undefined,
  configuracion: ConFolios | null | undefined,
  comoHoy: ComoHoy = 'con-serie',
): string {
  const separado = separar(serie, folio);
  if (separado.numero === '') return '';
  const prefijo = prefijoDeLosFolios(configuracion);
  if (prefijo !== null && NUMERO.test(separado.numero)) {
    if (separado.serie === SERIE_DE_CUENTAS) {
      return `${prefijo}-${conCeros(separado.numero, CIFRAS_DE_CUENTAS)}`;
    }
    if (separado.serie === SERIE_DE_CORTES) {
      return `${prefijo}C-${conCeros(separado.numero, CIFRAS_DE_CORTES)}`;
    }
  }
  if (separado.compuesto !== null) return separado.compuesto;
  if (separado.serie === '') return separado.numero;
  return comoHoy === 'numero' ? separado.numero : `${separado.serie}-${separado.numero}`;
}

/**
 * ¿Lo que se tecleó nombra EXACTAMENTE este folio? Acepta «1001», «01001», «DP-01001» (con o
 * sin guion, en minúsculas) y lo de siempre: «A-3», «CC2». No acepta un trozo («100»): la
 * búsqueda por partes sigue siendo del buscador; esto decide cuál va primero (DP-D118).
 */
export function coincideConElFolio(
  texto: string,
  serie: string | null | undefined,
  folio: string | number | bigint | null | undefined,
  configuracion: ConFolios | null | undefined,
): boolean {
  const buscado = texto.toUpperCase().replace(/[\s-]+/g, '');
  const partes = /^([A-Z]*)(\d+)$/.exec(buscado);
  if (partes === null) return false;
  const separado = separar(serie, folio);
  if (!NUMERO.test(separado.numero)) return false;
  const numero = BigInt(separado.numero);
  if (numero === 0n || BigInt(partes[2] ?? '0') !== numero) return false;
  const letras = partes[1] ?? '';
  if (letras === '' || letras === separado.serie) return true;
  const prefijo = prefijoDeLosFolios(configuracion);
  if (prefijo === null) return false;
  if (separado.serie === SERIE_DE_CUENTAS) return letras === prefijo;
  if (separado.serie === SERIE_DE_CORTES) return letras === `${prefijo}C`;
  return false;
}

export interface FolioEntendido {
  /** La serie interna que nombra lo tecleado (`A`, `CC`…), o `null` si sólo se tecleó el número. */
  readonly serie: string | null;
  /** El consecutivo sin ceros a la izquierda. */
  readonly numero: string;
}

/**
 * Lo que se teclea para buscar o devolver («1001», «01001», «DP-01001», «A-123»), entendido: la
 * serie interna que nombra y el consecutivo. Es la inversa de `folioVisible`: el prefijo del
 * negocio nombra la serie de las cuentas (`A`), y el prefijo con una C, la de los cortes (`CC`).
 * Lo que no termina en un número no es un folio.
 */
export function entenderElFolio(
  texto: string,
  configuracion: ConFolios | null | undefined,
): FolioEntendido | null {
  const partes = /^(?:([A-Z]+)-?)?(\d+)$/.exec(texto.toUpperCase().replace(/\s+/g, ''));
  if (partes === null) return null;
  const numero = String(BigInt(partes[2] ?? '0'));
  const letras = partes[1];
  if (letras === undefined) return { serie: null, numero };
  const prefijo = prefijoDeLosFolios(configuracion);
  if (prefijo !== null && letras === prefijo) return { serie: SERIE_DE_CUENTAS, numero };
  if (prefijo !== null && letras === `${prefijo}C`) return { serie: SERIE_DE_CORTES, numero };
  return { serie: letras, numero };
}
