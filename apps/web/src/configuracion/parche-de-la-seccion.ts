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

export function hayCambios(parche: Readonly<Record<string, unknown>>): boolean {
  return Object.keys(parche).length > 0;
}
