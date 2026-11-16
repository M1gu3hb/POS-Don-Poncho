/**
 * MODO COMPATIBLE (DP-20.1) · leer valores de CSS sin un analizador entero.
 *
 * Lo justo para el plugin: partir por un separador sólo fuera de paréntesis y encontrar una
 * llamada (`color-mix(…)`) con sus paréntesis balanceados. Los valores que salen de Tailwind no
 * traen cadenas con paréntesis dentro, así que no hace falta más.
 */

/** Parte `texto` por `separador` (un carácter) sólo en el nivel cero de paréntesis. */
export function partirAlNivelCero(texto, separador) {
  const partes = [];
  let nivel = 0;
  let desde = 0;
  for (let i = 0; i < texto.length; i += 1) {
    const c = texto[i];
    if (c === '(') nivel += 1;
    else if (c === ')') nivel -= 1;
    else if (c === separador && nivel === 0) {
      partes.push(texto.slice(desde, i));
      desde = i + 1;
    }
  }
  partes.push(texto.slice(desde));
  return partes.map((p) => p.trim()).filter((p) => p !== '');
}

/**
 * Cada `nombre(…)` de `texto`, con sus paréntesis balanceados.
 * @returns {{ inicio: number, fin: number, dentro: string }[]} `fin` es el índice tras el `)`.
 */
export function llamadas(texto, nombre) {
  const halladas = [];
  const aguja = `${nombre}(`;
  let desde = 0;
  for (;;) {
    const inicio = texto.indexOf(aguja, desde);
    if (inicio === -1) return halladas;
    let nivel = 0;
    let fin = -1;
    for (let i = inicio + nombre.length; i < texto.length; i += 1) {
      if (texto[i] === '(') nivel += 1;
      else if (texto[i] === ')') {
        nivel -= 1;
        if (nivel === 0) {
          fin = i + 1;
          break;
        }
      }
    }
    if (fin === -1) return halladas;
    halladas.push({ inicio, fin, dentro: texto.slice(inicio + aguja.length, fin - 1) });
    desde = fin;
  }
}

/** Sustituye cada `nombre(…)` por lo que devuelva `cambiar(dentro)`; `null` si alguna devuelve null. */
export function sustituirLlamadas(texto, nombre, cambiar) {
  let salida = '';
  let desde = 0;
  for (const llamada of llamadas(texto, nombre)) {
    const nuevo = cambiar(llamada.dentro);
    if (nuevo === null) return null;
    salida += texto.slice(desde, llamada.inicio) + nuevo;
    desde = llamada.fin;
  }
  return salida + texto.slice(desde);
}

/** Sin espacios de más: para comparar valores y condiciones que el minificador reescribe. */
export function compacto(texto) {
  return texto.replace(/\s+/g, '').toLowerCase();
}

/** ¿El nodo vive dentro de un `@keyframes`? */
export function dentroDeFotogramas(nodo) {
  for (let p = nodo.parent; p !== undefined && p.type !== 'root'; p = p.parent) {
    if (p.type === 'atrule' && /keyframes$/i.test(p.name)) return true;
  }
  return false;
}

/** ¿Lo que sigue a `nodo` ya es su bloque `@supports <condicion>` con ese mismo selector o nombre? */
export function yaTieneGemela(nodo, condicion) {
  const sigue = nodo.next();
  if (sigue?.type !== 'atrule' || sigue.name !== 'supports' || compacto(sigue.params) !== condicion)
    return false;
  return (sigue.nodes ?? []).some((dentro) =>
    nodo.type === 'rule'
      ? dentro.type === 'rule' && dentro.selector === nodo.selector
      : dentro.type === 'atrule' && dentro.name === nodo.name && dentro.params === nodo.params,
  );
}

/** ¿El nodo vive dentro de un `@supports` cuya condición (compacta) es `condicion`? */
export function dentroDeSoporte(nodo, condicion) {
  for (let p = nodo.parent; p !== undefined && p.type !== 'root'; p = p.parent) {
    if (p.type === 'atrule' && p.name === 'supports' && compacto(p.params) === condicion)
      return true;
  }
  return false;
}
