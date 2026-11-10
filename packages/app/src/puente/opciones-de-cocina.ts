/**
 * DP-16 · 2.2 · LAS OPCIONES ELEGIDAS, COMO LAS LEE LA COCINA.
 *
 * `orden_lineas.opciones` es la instantánea de la elección (por grupo, con ids y nombres; con el
 * tiempo puede llevar también lo que la cobra). La cocina sólo necesita QUÉ se eligió: el grupo y
 * los nombres. Se reduce aquí, en el servidor, para que ningún dato de dinero —ni de nadie— viaje
 * a la pantalla de cocina por llegar en el mismo json.
 */

export interface OpcionesParaCocina {
  readonly grupo: string;
  readonly opciones: readonly string[];
}

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function nombreDe(opcion: unknown): string | null {
  const nombre = esObjeto(opcion) ? opcion['nombre'] : opcion;
  return typeof nombre === 'string' && nombre.trim() !== '' ? nombre.trim() : null;
}

/** Null si no hay nada que mostrar; nunca lanza (una instantánea rara no tumba la lectura). */
export function opcionesParaCocina(valor: unknown): readonly OpcionesParaCocina[] | null {
  let lista: unknown = valor;
  if (typeof valor === 'string') {
    try {
      lista = JSON.parse(valor) as unknown;
    } catch {
      return null;
    }
  }
  if (!Array.isArray(lista)) return null;
  const salida: OpcionesParaCocina[] = [];
  for (const grupo of lista as unknown[]) {
    if (!esObjeto(grupo)) continue;
    const nombreDelGrupo = grupo['grupo'];
    const opciones = grupo['opciones'];
    if (typeof nombreDelGrupo !== 'string' || !Array.isArray(opciones)) continue;
    const nombres = (opciones as unknown[]).map(nombreDe).filter((n): n is string => n !== null);
    if (nombres.length > 0) salida.push({ grupo: nombreDelGrupo, opciones: nombres });
  }
  return salida.length > 0 ? salida : null;
}
