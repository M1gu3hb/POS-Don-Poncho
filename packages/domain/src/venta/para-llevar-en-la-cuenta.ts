/**
 * LO QUE VA «PARA LLEVAR» DENTRO DE LA CUENTA DE UNA MESA (DP-24). Puro.
 *
 * La mesa pide en la caja, ya con la cuenta en la mano, «y dos tamales para llevar». Eso se agrega
 * a SU cuenta (se cobra junto) pero la cocina tiene que empacarlo: el platillo va MARCADO. La marca
 * es el principio de la nota del platillo —«PARA LLEVAR» o «PARA LLEVAR · sin cebolla»—, que es lo
 * que ya leen la pantalla de cocina, la comanda impresa, el ticket y la tarjeta de cobro: no hay
 * que enseñarle una columna nueva a cada papel, y un platillo marcado no se puede quedar sin que
 * alguno lo diga.
 */

export const MARCA_PARA_LLEVAR = 'PARA LLEVAR';

/** El mismo separador con el que la nota junta las opciones y lo que escribe el mesero. */
const SEPARADOR = ' · ';

/** ¿Este platillo va para llevar? */
export function esParaLlevar(nota: string | null | undefined): boolean {
  const limpia = (nota ?? '').trim();
  return limpia === MARCA_PARA_LLEVAR || limpia.startsWith(`${MARCA_PARA_LLEVAR}${SEPARADOR}`);
}

/** La nota con su marca delante. Marcar dos veces no la repite. */
export function notaParaLlevar(nota: string | null | undefined): string {
  const limpia = (nota ?? '').trim();
  if (esParaLlevar(limpia)) return limpia;
  return limpia === '' ? MARCA_PARA_LLEVAR : `${MARCA_PARA_LLEVAR}${SEPARADOR}${limpia}`;
}
