/**
 * TEXTO CON RESPALDO, como la pantalla de siempre lo leía.
 *
 * `''` cuenta como «no hay»: un platillo con el nombre en blanco se llama «—», no queda vacío. Es
 * lo que hacía `valor || respaldo` en `Mesero.jsx`, y que `??` no hace (un texto vacío sí es un
 * valor). Dos funciones y no un `||` suelto, porque el lint de TypeScript con razón desconfía de
 * `||` sobre textos y aquí lo que se quiere es justo esa regla, dicha una vez.
 */

/** El primer texto que no está vacío, o `''`. */
export function primeroConTexto(...valores: readonly unknown[]): string {
  const hallado = valores.find(
    (valor): valor is string => typeof valor === 'string' && valor !== '',
  );
  return hallado ?? '';
}

/** El valor si es un texto no vacío; si no, el respaldo. */
export function textoDe(valor: unknown, respaldo: string): string {
  return typeof valor === 'string' && valor !== '' ? valor : respaldo;
}
