import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

import { claves } from './claves-de-consulta.ts';

/**
 * DP-18 · NINGUNA PANTALLA INVALIDA UNA LLAVE QUE NADIE LEE.
 *
 * Lo que vio Miguel el 11-11: guardaba «Cómo se ve el menú» en Portal QR → Configuración, la base lo
 * guardaba, y al cambiar de pestaña y volver el formulario se rellenaba con lo de antes. La pestaña
 * invalidaba `['config_remote']`, una llave que ninguna consulta usa; la configuración vive en
 * `['config']` (`ConfigContext.jsx`) y se quedaba vieja hasta el siguiente foco de la ventana.
 *
 * Esta prueba lee el código de las pantallas (`heredado/` y `src/`) y junta dos conjuntos de raíces
 * (el primer elemento de cada llave): las que se LEEN (`queryKey:` de una consulta) y las que se
 * ESCRIBEN desde fuera (invalidar, refrescar, reiniciar, quitar, cancelar o poner datos). Cada raíz
 * escrita tiene que ser una raíz leída. Una llave que no se puede resolver es un error: la prueba no
 * aprueba lo que no entiende.
 */

const WEB = join(import.meta.dirname, '..', '..');
const CARPETAS = ['heredado', 'src'];
const ESCRITURAS = new Set([
  'invalidateQueries',
  'refetchQueries',
  'resetQueries',
  'removeQueries',
  'cancelQueries',
  'setQueryData',
  'setQueriesData',
]);

interface Archivo {
  readonly ruta: string;
  readonly texto: string;
}

function fuentes(dir: string, salida: Archivo[] = []): Archivo[] {
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) {
      if (nombre !== 'node_modules') fuentes(ruta, salida);
    } else if (/\.(jsx?|tsx?)$/.test(nombre) && !/\.test\.|\.spec\./.test(nombre)) {
      salida.push({
        ruta: relative(WEB, ruta).replaceAll('\\', '/'),
        texto: sinComentarios(readFileSync(ruta, 'utf8')),
      });
    }
  }
  return salida;
}

/**
 * Quita comentarios de bloque y de línea (los que empiezan tras espacio o al inicio), dejando sus
 * saltos de línea para que el número de línea que se reporta sea el del archivo.
 */
function sinComentarios(texto: string): string {
  return texto
    .replace(/\/\*[\s\S]*?\*\//g, (bloque) => bloque.replace(/[^\n]/g, ' '))
    .replace(/(^|\s)\/\/.*$/gm, '$1');
}

const LITERAL = /^\s*(['"`])([^'"`]+)\1/;
const IDENTIFICADOR = /^\s*([A-Za-z_$][\w$]*)/;

/** El nombre de la llamada que encierra la posición: `invalidateQueries`, `useQuery`… */
export function llamadaQueEncierra(texto: string, pos: number): string | null {
  let profundidad = 0;
  for (let i = pos - 1; i >= 0; i -= 1) {
    const c = texto[i];
    if (c === ')' || c === ']' || c === '}') profundidad += 1;
    else if (c === '(' || c === '[' || c === '{') {
      if (profundidad > 0) profundidad -= 1;
      // Un `{` o `[` abierto que encierra la posición es el objeto o el arreglo de la llamada.
      else if (c === '(') {
        return /([\w$]+)\s*$/.exec(texto.slice(Math.max(0, i - 80), i))?.[1] ?? null;
      }
    }
  }
  return null;
}

/** Las cadenas de un arreglo literal que empieza en `inicio` (`[`). */
function cadenasDelArreglo(texto: string, inicio: number): string[] {
  let profundidad = 0;
  for (let i = inicio; i < texto.length; i += 1) {
    if (texto[i] === '[') profundidad += 1;
    else if (texto[i] === ']') {
      profundidad -= 1;
      if (profundidad === 0)
        return [...texto.slice(inicio, i).matchAll(/(['"])([^'"]+)\1/g)].map((m) => m[2] ?? '');
    }
  }
  return [];
}

function escapar(nombre: string): string {
  return nombre.replace(/[$]/g, '\\$');
}

/** Raíces de un identificador: variable de un ciclo, constante del archivo o exportada en otro. */
function resolverIdentificador(
  nombre: string,
  archivo: Archivo,
  pos: number,
  todos: readonly Archivo[],
): string[] | null {
  const antes = archivo.texto.slice(0, pos);
  const n = escapar(nombre);
  const forEach = new RegExp(`\\]\\s*\\.forEach\\(\\s*\\(?\\s*${n}\\s*\\)?\\s*=>`, 'g');
  const enCiclo = [...antes.matchAll(forEach)].pop();
  if (enCiclo?.index !== undefined) {
    const cierre = enCiclo.index;
    let profundidad = 0;
    for (let i = cierre; i >= 0; i -= 1) {
      if (antes[i] === ']') profundidad += 1;
      else if (antes[i] === '[' && --profundidad === 0) return cadenasDelArreglo(antes, i);
    }
  }
  const forOf = [
    ...antes.matchAll(new RegExp(`for\\s*\\(\\s*const\\s+${n}\\s+of\\s+([\\w$]+)`, 'g')),
  ].pop();
  if (forOf?.[1] !== undefined) return resolverConstante(forOf[1], archivo, todos, true);
  return resolverConstante(nombre, archivo, todos, false, pos);
}

/** La declaración de `patron` más cercana ANTES de `pos` (el ámbito de quien la usa); si no, la primera. */
function declaracionMasCercana(texto: string, patron: RegExp, pos: number): RegExpExecArray | null {
  const todas = [...texto.matchAll(new RegExp(patron.source, 'g'))];
  return todas.filter((m) => (m.index ?? 0) < pos).pop() ?? todas[0] ?? null;
}

function resolverConstante(
  nombre: string,
  archivo: Archivo,
  todos: readonly Archivo[],
  todas: boolean,
  pos = archivo.texto.length,
): string[] | null {
  const n = escapar(nombre);
  const declaracion = new RegExp(
    `(?:const|let)\\s+${n}\\s*(?::[^=]+)?=\\s*(?:useMemo\\(\\s*\\(\\)\\s*=>\\s*)?`,
  );
  const funcion = new RegExp(`function\\s+${n}\\s*\\([^)]*\\)[^{]*\\{[^]*?return\\s*`);
  for (const donde of [archivo, ...todos.filter((a) => a !== archivo)]) {
    for (const patron of [declaracion, funcion]) {
      const m = declaracionMasCercana(
        donde.texto,
        patron,
        donde === archivo ? pos : donde.texto.length,
      );
      if (m === null) continue;
      if (
        donde !== archivo &&
        !new RegExp(`export\\s+(?:const|function)\\s+${n}\\b`).test(donde.texto)
      )
        continue;
      const despues = m.index + m[0].length;
      const resto = donde.texto.slice(despues);
      // Una constante de texto (`export const CLAVE_DE_X = 'x'`) es su propia raíz.
      const literal = LITERAL.exec(resto);
      if (literal?.[2] !== undefined) return [literal[2]];
      if (resto.startsWith('[')) {
        const cadenas = cadenasDelArreglo(donde.texto, despues);
        return todas ? cadenas : cabezas(donde, despues, todos);
      }
      return cabezas(donde, despues, todos);
    }
  }
  return null;
}

/** Las raíces posibles de la expresión de llave que empieza en `pos`. `null` si no se entiende. */
export function cabezas(archivo: Archivo, pos: number, todos: readonly Archivo[]): string[] | null {
  const resto = archivo.texto.slice(pos);
  const espacio = /^\s*/.exec(resto)?.[0].length ?? 0;
  const inicio = pos + espacio;
  const expr = archivo.texto.slice(inicio, inicio + 200);
  if (expr.startsWith('[')) {
    const dentro = archivo.texto.slice(inicio + 1);
    const literal = LITERAL.exec(dentro);
    if (literal?.[2] !== undefined) return [literal[2]];
    const esparcido = /^\s*\.\.\.\s*([A-Za-z_$][\w$]*)/.exec(dentro);
    if (esparcido?.[1] !== undefined)
      return resolverIdentificador(esparcido[1], archivo, inicio, todos);
    const id = IDENTIFICADOR.exec(dentro);
    return id?.[1] === undefined ? null : resolverIdentificador(id[1], archivo, inicio, todos);
  }
  const deClaves = /^claves\.(\w+)\.(\w+)\(/.exec(expr);
  if (deClaves !== null) {
    const grupo = (
      claves as Record<string, Record<string, (...a: unknown[]) => readonly unknown[]>>
    )[deClaves[1] ?? ''];
    const raiz = grupo?.[deClaves[2] ?? '']?.()[0];
    return typeof raiz === 'string' ? [raiz] : null;
  }
  const llamada = /^([A-Za-z_$][\w$]*)\s*\(/.exec(expr);
  if (llamada?.[1] !== undefined) return resolverConstante(llamada[1], archivo, todos, false);
  const id = IDENTIFICADOR.exec(expr);
  return id?.[1] === undefined ? null : resolverIdentificador(id[1], archivo, inicio, todos);
}

interface Uso {
  readonly ruta: string;
  readonly linea: number;
  readonly raices: readonly string[] | null;
}

export function usosDeLlaves(todos: readonly Archivo[]): { leidas: Uso[]; escritas: Uso[] } {
  const leidas: Uso[] = [];
  const escritas: Uso[] = [];
  for (const archivo of todos) {
    const linea = (i: number) => archivo.texto.slice(0, i).split('\n').length;
    for (const m of archivo.texto.matchAll(/queryKey\s*:/g)) {
      const pos = (m.index ?? 0) + m[0].length;
      // `readonly queryKey: readonly unknown[]` es un tipo, no una llave.
      if (/^\s*(?:readonly\b|unknown\b|QueryKey\b)/.test(archivo.texto.slice(pos, pos + 30)))
        continue;
      const llamada = llamadaQueEncierra(archivo.texto, m.index ?? 0);
      const uso = { ruta: archivo.ruta, linea: linea(pos), raices: cabezas(archivo, pos, todos) };
      (llamada !== null && ESCRITURAS.has(llamada) ? escritas : leidas).push(uso);
    }
    for (const m of archivo.texto.matchAll(/\.(setQueryData|setQueriesData)\(\s*/g)) {
      const pos = (m.index ?? 0) + m[0].length;
      if (archivo.texto.slice(pos).startsWith('{')) continue; // con `queryKey:`, ya contado arriba
      escritas.push({
        ruta: archivo.ruta,
        linea: linea(pos),
        raices: cabezas(archivo, pos, todos),
      });
    }
  }
  return { leidas, escritas };
}

/** El texto del segundo argumento de la llamada que se abrió justo antes de `inicio`. */
function segundoArgumento(texto: string, inicio: number): string {
  let profundidad = 0;
  let coma = -1;
  for (let i = inicio; i < texto.length; i += 1) {
    const c = texto[i];
    if (c === '(' || c === '[' || c === '{') profundidad += 1;
    else if (c === ')' || c === ']' || c === '}') {
      if (profundidad === 0)
        return coma === -1 ? '' : texto.slice(coma + 1, i).replace(/,\s*$/, '');
      profundidad -= 1;
    } else if (c === ',' && profundidad === 0 && coma === -1) coma = i;
  }
  return '';
}

describe('las llaves de consulta de las pantallas', () => {
  const todos = CARPETAS.flatMap((c) => fuentes(join(WEB, c)));
  const { leidas, escritas } = usosDeLlaves(todos);
  const raicesLeidas = new Set(leidas.flatMap((u) => u.raices ?? []));

  it('encuentra las consultas y las invalidaciones (si no, la prueba no mira nada)', () => {
    expect(leidas.length).toBeGreaterThan(100);
    expect(escritas.length).toBeGreaterThan(100);
    expect(raicesLeidas).toContain('config');
  });

  it('entiende cada llave: ninguna se queda sin resolver', () => {
    const sinResolver = [...leidas, ...escritas].filter(
      (u) => u.raices === null || u.raices.length === 0,
    );
    expect(sinResolver.map((u) => `${u.ruta}:${String(u.linea)}`)).toEqual([]);
  });

  it('cada llave que se invalida o se refresca es una que alguna consulta lee', () => {
    const huerfanas = escritas.flatMap((u) =>
      (u.raices ?? [])
        .filter((r) => !raicesLeidas.has(r))
        .map((r) => `${u.ruta}:${String(u.linea)} → ['${r}']`),
    );
    expect(huerfanas).toEqual([]);
  });

  it('cada sección de Configuración guarda sólo su parche, nunca la configuración leída entera', () => {
    const guardados = todos.flatMap((a) =>
      [...a.texto.matchAll(/ConfiguracionNegocio\.update\(/g)].map((m) => ({
        archivo: a,
        linea: a.texto.slice(0, m.index).split('\n').length,
        datos: segundoArgumento(a.texto, (m.index ?? 0) + m[0].length),
      })),
    );
    expect(guardados.length).toBeGreaterThanOrEqual(8);
    // Lo que se manda es el parche: la llamada misma, o una variable que sale de él (sola o
    // esparcida junto al nombre del negocio, la primera vez que no hay configuración todavía).
    const sinParche = guardados.filter(({ archivo, datos }) => {
      if (datos.includes('parcheDeLaSeccion(')) return false;
      const deParche = [
        ...archivo.texto.matchAll(/const\s+([A-Za-z_$][\w$]*)\s*=\s*parcheDeLaSeccion\(/g),
      ].map((m) => m[1] ?? '');
      const sola = /^\s*([A-Za-z_$][\w$]*)\s*$/.exec(datos)?.[1];
      const esparcidas = [...datos.matchAll(/\.\.\.\s*([A-Za-z_$][\w$]*)/g)].map((m) => m[1] ?? '');
      const usadas = sola === undefined ? esparcidas : [sola];
      return usadas.length === 0 || !usadas.every((v) => deParche.includes(v));
    });
    expect(
      sinParche.map((g) => `${g.archivo.ruta}:${String(g.linea)} → ${g.datos.trim()}`),
    ).toEqual([]);
  });
});
