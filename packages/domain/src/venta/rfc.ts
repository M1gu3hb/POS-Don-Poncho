/**
 * EL RFC DEL NEGOCIO (DP-21 · Bloque 20). Puro.
 *
 * El corte imprime «RFC: …» si el negocio lo tiene. Persona moral: 12 caracteres (3 letras, fecha
 * AAMMDD y homoclave de 3); persona física: 13 (4 letras). Mayúsculas, con Ñ y & como letras.
 */
const FORMA_DEL_RFC = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/;

export function esRfcValido(texto: string): boolean {
  return FORMA_DEL_RFC.test(texto);
}

/** Lo que se teclea, listo para validar: sin espacios y en mayúsculas. */
export function normalizarRfc(texto: string): string {
  return texto.replace(/\s+/g, '').toUpperCase();
}
