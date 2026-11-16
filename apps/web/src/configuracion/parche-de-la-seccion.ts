/**
 * DP-18 · LO QUE UNA SECCIÓN DE CONFIGURACIÓN MANDA AL GUARDAR: sólo lo que se cambió en ella.
 *
 * La configuración del negocio es UN documento (`configuracion.valores`) que editan varias
 * pantallas: Datos del negocio, Identidad, Colores, Portal QR… Cada una llena su formulario con lo
 * que leyó al entrar. Si guarda TODO su formulario, un campo que no tocó viaja con el valor de
 * cuando lo leyó: si otra pantalla (u otro aparato) lo cambió mientras tanto, lo pisa con lo viejo.
 * Mandando sólo lo que difiere de lo leído, guardar una sección nunca reescribe lo que no tocó.
 *
 * Se compara por valor (`JSON.stringify`, suficiente para textos, números, booleanos y las listas
 * cortas de la configuración). Sin cambios, el parche sale vacío y la pantalla no manda nada.
 */
export type ValoresDeSeccion = Readonly<Record<string, unknown>>;

export function parcheDeLaSeccion(
  formulario: ValoresDeSeccion,
  leido: ValoresDeSeccion,
): Record<string, unknown> {
  const parche: Record<string, unknown> = {};
  for (const [campo, valor] of Object.entries(formulario)) {
    if (JSON.stringify(valor) !== JSON.stringify(leido[campo])) parche[campo] = valor;
  }
  return parche;
}

/**
 * Lo GUARDADO de los campos de una sección (crudo, sin los valores por omisión del formulario): contra
 * esto se compara. Un campo que nunca se guardó viaja la primera vez con lo que diga el formulario
 * (como antes); uno que ya está guardado y no se tocó, no viaja.
 */
export function leidoDe(
  configuracion: Readonly<Record<string, unknown>> | null | undefined,
  campos: readonly string[],
): Record<string, unknown> {
  return Object.fromEntries(campos.map((c) => [c, configuracion?.[c]]));
}

export function hayCambios(parche: Readonly<Record<string, unknown>>): boolean {
  return Object.keys(parche).length > 0;
}

/**
 * DP-21 · Bloque 21 · ¿LA PERSONA CAMBIÓ ALGO EN ESTA TARJETA DESDE QUE SE LLENÓ?
 *
 * Es lo que enciende «Guardar» y lo que hace preguntar «¿Salir sin guardar?». NO es «¿difiere de
 * lo guardado?»: un ajuste que nunca se guardó enseña su valor por omisión, y eso no es un cambio
 * de nadie. (Al guardar sí viaja, con lo demás de la tarjeta: `parcheDeLaSeccion`.)
 */
export function seToco(enPantalla: ValoresDeSeccion, alLlenar: ValoresDeSeccion | null): boolean {
  if (alLlenar === null) return false;
  return Object.keys(enPantalla).some(
    (campo) =>
      campo in alLlenar && JSON.stringify(enPantalla[campo]) !== JSON.stringify(alLlenar[campo]),
  );
}

/**
 * DP-21 · Bloque 21 · AL LLEGAR UNA CONFIGURACIÓN NUEVA, LA TARJETA SE PONE AL DÍA SIN BORRAR LO
 * TECLEADO.
 *
 * Con cada tarjeta guardando lo suyo, guardar una hace que la configuración se relea y que TODAS
 * las tarjetas de la sección se vuelvan a llenar. Llenarlas a secas borraba, sin aviso, lo que la
 * persona había cambiado en otra tarjeta y todavía no guardaba.
 *
 *   · `enPantalla`: el formulario de la tarjeta ahora;
 *   · `alLlenar`: el formulario como quedó la última vez que se llenó (`null` la primera vez);
 *   · `delServidor`: el formulario que sale de la configuración que acaba de llegar.
 *
 * Lo que difiere de `alLlenar` es lo que la persona tocó: eso se queda. Lo demás toma lo nuevo.
 * Sólo existen los campos de `delServidor`.
 */
export function ponerAlDia<T extends ValoresDeSeccion>(
  enPantalla: ValoresDeSeccion,
  alLlenar: ValoresDeSeccion | null,
  delServidor: T,
): T {
  if (alLlenar === null) return delServidor;
  const resultado: Record<string, unknown> = { ...delServidor };
  for (const campo of Object.keys(delServidor)) {
    if (!(campo in enPantalla)) continue;
    const tocado = JSON.stringify(enPantalla[campo]) !== JSON.stringify(alLlenar[campo]);
    if (tocado) resultado[campo] = enPantalla[campo];
  }
  return resultado as T;
}
