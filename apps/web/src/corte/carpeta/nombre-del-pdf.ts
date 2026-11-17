import {
  diaDelNegocioDe,
  diaDelNegocioDeUnValor,
  hoyDelNegocio,
} from '../../cliente/dia-del-negocio.ts';

/**
 * LO QUE LA PÁGINA LE DA A LA APP PARA ARMAR EL NOMBRE (DP-D153). Puro.
 *
 * La página NO da nombre ni ruta: da el folio y el día. La app los valida con expresiones estrictas
 * (folio: letras y números, hasta 3 tramos con guion, 24 caracteres; fecha: AAAA-MM-DD real) y arma
 * `Corte-<folio>-<AAAA-MM-DD>.pdf` dentro de `Cortes\AAAA-MM\`.
 */
const LARGO_MAXIMO = 24;
const TRAMOS_MAXIMOS = 3;
const NOMBRES_RESERVADOS = /^(?:CON|PRN|AUX|NUL|COM[0-9]|LPT[0-9])$/iu;
const CIFRAS_DEL_RESPALDO = 8;

/** Un folio de respaldo que la app SIEMPRE acepta, con el comienzo del id de la sesión. */
function folioDeRespaldo(respaldo: string): string {
  const cola = respaldo
    .replace(/[^A-Za-z0-9]/gu, '')
    .slice(0, CIFRAS_DEL_RESPALDO)
    .toUpperCase();
  return cola === '' ? 'SF' : `SF-${cola}`;
}

/**
 * El folio como se lee (`DPC-0102`, `CC-2`) en la forma que la app acepta. Sin folio («sin folio»),
 * sin ningún número, demasiado largo o con demasiados tramos: el de respaldo (`SF-<id>`), para que
 * guardar nunca falle por un folio.
 */
export function folioParaElArchivo(folio: string | null | undefined, respaldo: string): string {
  const limpio = (folio ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/gu, '')
    .replace(/[^A-Za-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '');
  const tramos = limpio.split('-');
  const sirve =
    limpio !== '' &&
    limpio.length <= LARGO_MAXIMO &&
    tramos.length <= TRAMOS_MAXIMOS &&
    /[0-9]/u.test(limpio) &&
    !NOMBRES_RESERVADOS.test(limpio);
  return sirve ? limpio : folioDeRespaldo(respaldo);
}

/** El día del corte (`AAAA-MM-DD`) en la zona del NEGOCIO (DP-D152); si no se entiende, hoy. */
export function fechaParaElArchivo(valor: unknown, ahora: Date = new Date()): string {
  const dia = valor instanceof Date ? diaDelNegocioDe(valor) : diaDelNegocioDeUnValor(valor);
  return dia === '' ? hoyDelNegocio(ahora) : dia;
}
