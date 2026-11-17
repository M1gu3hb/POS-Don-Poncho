/**
 * LO EXPLICADO: errores de consola y respuestas 4xx/5xx que NO son un hallazgo, cada uno con su razón.
 *
 * Una corrida sin errores sin explicar es la regla. Lo que sí pasa a propósito (un 401 antes de
 * entrar, el PIN equivocado que una prueba teclea para ver el aviso, la red que la prueba cortó) se
 * escribe aquí o se pasa a `revisarPantalla` con su razón, y sale en el informe como «explicado».
 * Lo que no tiene razón es un hallazgo.
 */

export interface Explicacion {
  readonly patron: RegExp;
  readonly razon: string;
}

/** Sobre `error <texto>` de cada mensaje de la consola. */
export const CONSOLA_EXPLICADA: readonly Explicacion[] = [];

/** Sobre `<método> <estado> <url>` de cada respuesta. */
export const RESPUESTAS_EXPLICADAS: readonly Explicacion[] = [
  {
    patron: /^GET 40[13] \S*\/api\/catalogo\/sesion\b/,
    razon:
      'La app pregunta si hay sesión antes de entrar: sin sesión contesta 401/403 a propósito.',
  },
];
