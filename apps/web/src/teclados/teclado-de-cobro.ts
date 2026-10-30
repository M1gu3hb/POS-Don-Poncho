/**
 * EL TECLADO DE COBRO, sin pantalla: lo que cada tecla le hace al texto de «Recibido».
 *
 * La caja de Miguel guarda lo recibido como TEXTO (`montoEfectivo`) y lo lee con `parseFloat` al
 * cobrar; el campo sólo deja pasar dígitos y un punto (`NumericInput`). El teclado de la
 * pantalla edita ese mismo texto y respeta el mismo filtro, así que lo que se teclea con el
 * dedo y lo que se teclea con el teclado físico llegan al cobro igual.
 *
 * Reglas que el dedo espera de una caja registradora:
 *   · el cero de la izquierda no se acumula («0» y luego «5» es «5»);
 *   · el «00» son dos ceros de verdad («5» pasa a «500»);
 *   · el punto no se repite, y sobre un texto vacío empieza en «0.»;
 *   · hasta siete cifras de pesos y dos decimales, como `aCentavos` de la venta;
 *   · el billete FIJA lo recibido: el cliente pone UN billete en la mano, no otro encima.
 */

export type TeclaDeCobro =
  '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '00' | '.' | 'borrar';

/** Los billetes que el cliente pone en la mano, en pesos. */
export const BILLETES_DE_COBRO = [50, 100, 200, 500] as const;

const CIFRAS_DE_PESOS = 7;
const DECIMALES = 2;
const CENTAVOS_POR_PESO = 100;

/** Un importe a medias o completo: «», «0.», «.5», «12.50». Nada más. */
const IMPORTE_A_MEDIAS = /^\d{0,7}(?:\.\d{0,2})?$/;

/** Agrega UN dígito si cabe; si no, el texto queda como estaba. */
function agregarDigito(texto: string, digito: string): string {
  if (texto === '0') return digito;
  const [enteros = '', decimales] = texto.split('.');
  if (decimales !== undefined) {
    return decimales.length >= DECIMALES ? texto : `${texto}${digito}`;
  }
  return enteros.length >= CIFRAS_DE_PESOS ? texto : `${texto}${digito}`;
}

/** Lo que una tecla le hace al texto de «Recibido». */
export function teclearImporte(texto: string, tecla: TeclaDeCobro): string {
  if (tecla === 'borrar') return texto.slice(0, -1);
  if (tecla === '.') {
    if (texto.includes('.')) return texto;
    return texto === '' ? '0.' : `${texto}.`;
  }
  if (tecla === '00') return agregarDigito(agregarDigito(texto, '0'), '0');
  return agregarDigito(texto, tecla);
}

/** El billete, tal cual: lo recibido pasa a ser ese billete, aunque hubiera otro tecleado. */
export function ponerBillete(pesos: number): string {
  return String(pesos);
}

/** «Exacto»: el total en pesos con dos decimales, contando centavos y no multiplicando flotantes. */
export function importeExacto(totalCentavos: number): string {
  const centavos = Math.max(0, Math.trunc(totalCentavos));
  const pesos = Math.trunc(centavos / CENTAVOS_POR_PESO);
  const resto = String(centavos % CENTAVOS_POR_PESO).padStart(DECIMALES, '0');
  return `${String(pesos)}.${resto}`;
}

/**
 * El filtro del campo: la coma es el punto, y todo lo que no sea un importe (letras, dos puntos,
 * una octava cifra, un tercer decimal) se rechaza con `null`, como `NumericInput` rechazaba la
 * tecla. El texto a medias («», «0.», «.5») pasa.
 */
export function limpiarImporte(texto: string): string | null {
  const conPunto = texto.replace(',', '.');
  return IMPORTE_A_MEDIAS.test(conPunto) ? conPunto : null;
}

/** Cualquier número con a lo sumo un punto: lo que el campo del mixto deja pasar. */
const NUMERO_CON_PUNTO = /^\d*(?:\.\d*)?$/;

/**
 * Lo tecleado, en centavos. Un texto que no es un número vale cero, como un campo vacío. El campo
 * del mixto comparte este texto y no limita los decimales, así que se leen los dos primeros.
 */
function centavosDelTexto(texto: string): number {
  if (!NUMERO_CON_PUNTO.test(texto)) return 0;
  const [enteros = '', decimales = ''] = texto.split('.');
  const pesos = Number(enteros === '' ? '0' : enteros);
  return pesos * CENTAVOS_POR_PESO + Number(decimales.slice(0, DECIMALES).padEnd(DECIMALES, '0'));
}

/** El cambio, en centavos: lo recibido menos el total, y cero si no alcanza. */
export function cambioDelCobro(recibido: string, totalCentavos: number): number {
  return Math.max(0, centavosDelTexto(recibido) - totalCentavos);
}
