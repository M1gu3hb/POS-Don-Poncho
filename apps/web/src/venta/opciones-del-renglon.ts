import { etiquetaDelPrecio } from '~/restaurante/toma-de-pedido/precio-de-las-opciones';

/**
 * DP-16 · LAS OPCIONES DE UN RENGLÓN, en el papel (precuenta y ticket) y en la Caja.
 *
 * Lee la instantánea que el servidor congela al escribir la línea (`orden_lineas.opciones`, la de
 * `instantaneaDeLasOpciones`): por grupo, con el nombre y el precio que tenía cada opción ese día.
 * Va aparte de la nota: «Extras: Queso (+$15.00)» se lee como lo que se cobró, «sin cebolla» como
 * lo que se pidió.
 */

interface OpcionDeLaInstantanea {
  readonly nombre: string;
  readonly precioCentavos?: string | number | null;
}

interface GrupoDeLaInstantanea {
  readonly grupo: string;
  readonly opciones: readonly OpcionDeLaInstantanea[];
}

function comoArreglo(valor: unknown): readonly unknown[] {
  if (Array.isArray(valor)) return valor;
  if (typeof valor !== 'string' || valor.trim() === '') return [];
  try {
    const leido: unknown = JSON.parse(valor);
    return Array.isArray(leido) ? leido : [];
  } catch {
    return [];
  }
}

function esGrupo(valor: unknown): valor is GrupoDeLaInstantanea {
  if (typeof valor !== 'object' || valor === null) return false;
  const g = valor as { grupo?: unknown; opciones?: unknown };
  return typeof g.grupo === 'string' && Array.isArray(g.opciones);
}

function textoDeLaOpcion(o: OpcionDeLaInstantanea): string {
  const precio = etiquetaDelPrecio(o.precioCentavos);
  return precio === '' ? o.nombre : `${o.nombre} (${precio})`;
}

function gruposDe(instantanea: unknown): readonly GrupoDeLaInstantanea[] {
  return comoArreglo(instantanea)
    .filter(esGrupo)
    .map((g) => ({
      grupo: g.grupo,
      opciones: (g.opciones as readonly unknown[]).filter(
        (o): o is OpcionDeLaInstantanea =>
          typeof o === 'object' &&
          o !== null &&
          typeof (o as { nombre?: unknown }).nombre === 'string',
      ),
    }))
    .filter((g) => g.opciones.length > 0);
}

/** Un renglón por grupo: «Extras: Queso (+$15.00), Sin crema (−$5.00)». */
export function renglonesDeLasOpciones(instantanea: unknown): readonly string[] {
  return gruposDe(instantanea).map(
    (g) => `${g.grupo}: ${g.opciones.map(textoDeLaOpcion).join(', ')}`,
  );
}

const SEPARADOR_DE_LA_NOTA = ' · ';

/**
 * La nota sin el texto plano de las opciones. El mesero (y `/pos`) guardan en la nota
 * «Grupo: a, b · lo que escribió», que es lo que la cocina lee; en el papel las opciones ya
 * salen arriba con su precio, así que de la nota queda sólo lo que se escribió a mano.
 */
export function notaSinLasOpciones(nota: unknown, instantanea: unknown): string {
  const texto = typeof nota === 'string' ? nota.trim() : '';
  const enTexto = new Set(
    gruposDe(instantanea).map((g) => `${g.grupo}: ${g.opciones.map((o) => o.nombre).join(', ')}`),
  );
  if (texto === '' || enTexto.size === 0) return texto;
  return texto
    .split(SEPARADOR_DE_LA_NOTA)
    .filter((parte) => !enTexto.has(parte.trim()))
    .join(SEPARADOR_DE_LA_NOTA)
    .trim();
}
