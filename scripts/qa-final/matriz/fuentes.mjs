/**
 * DP-22 · EL MAPA TOTAL · las fuentes: qué archivos hay, su texto sin comentarios y quién nombra qué.
 *
 * Todo lo que el mapa dice sale de aquí: nada se escribe a mano. Los comentarios se quitan antes de
 * buscar (un nombre citado en un comentario no es un lector) conservando los saltos de línea, para
 * que `archivo:línea` siga apuntando al renglón de verdad.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

export const RAIZ = (
  process.env['MORPHIQPOS_RAIZ_DEL_MAPA'] ??
  dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url)))))
).replaceAll('\\', '/');

const IGNORADAS = new Set(['node_modules', '.next', '.turbo', 'dist', 'coverage', '.resultados']);
const DE_CODIGO = /\.(?:[cm]?[jt]sx?)$/u;
const DE_PRUEBA = /\.(?:test|spec)\.[jt]sx?$|(?:^|\/)pruebas\/|(?:^|\/)qa\//u;

/** Ruta relativa a la raíz, siempre con `/`. */
export const relativa = (ruta) => relative(RAIZ, ruta).replaceAll('\\', '/');

export function listar(carpeta, filtro = () => true) {
  const salida = [];
  const andar = (dir) => {
    let nombres;
    try {
      nombres = readdirSync(dir);
    } catch (error) {
      if (error?.code === 'ENOENT') return;
      throw error;
    }
    for (const nombre of nombres.sort()) {
      if (IGNORADAS.has(nombre)) continue;
      const ruta = join(dir, nombre);
      if (statSync(ruta).isDirectory()) andar(ruta);
      else if (filtro(relativa(ruta))) salida.push(relativa(ruta));
    }
  };
  andar(join(RAIZ, carpeta));
  return salida;
}

const textos = new Map();
export function leer(ruta) {
  if (!textos.has(ruta)) textos.set(ruta, readFileSync(join(RAIZ, ruta), 'utf8'));
  return textos.get(ruta);
}

/** Quita los comentarios de bloque y de renglón sin mover los renglones. No toca `://`. */
export function sinComentarios(texto) {
  const enBlanco = (trozo) => trozo.replace(/[^\n]/gu, ' ');
  return texto
    .replace(/\/\*[\s\S]*?\*\//gu, enBlanco)
    .replace(
      /(^|[^:'"`\\])\/\/[^\n]*/gu,
      (todo, antes) => antes + enBlanco(todo.slice(antes.length)),
    );
}

const limpios = new Map();
export function limpio(ruta) {
  if (!limpios.has(ruta)) limpios.set(ruta, sinComentarios(leer(ruta)));
  return limpios.get(ruta);
}

export const esDePrueba = (ruta) => DE_PRUEBA.test(ruta);

/** El código de la app (pantallas y servidor), sin pruebas. */
export function fuentesDeLaApp() {
  const deCodigo = (ruta) => DE_CODIGO.test(ruta) && !esDePrueba(ruta);
  return [
    ...listar('apps/web/app', deCodigo),
    ...listar('apps/web/heredado', deCodigo),
    ...listar('apps/web/src', deCodigo),
    ...listar('packages/app/src', deCodigo),
    ...listar('packages/domain/src', deCodigo),
    ...listar('packages/ui/src', deCodigo),
  ];
}

/** Las pruebas: unitarias, de integración, e2e, de impresión y el simulador. */
export function fuentesDePrueba() {
  const dePrueba = (ruta) => DE_CODIGO.test(ruta) && esDePrueba(ruta);
  const deCodigo = (ruta) => DE_CODIGO.test(ruta);
  return [
    ...listar('apps/web', dePrueba),
    ...listar('packages', dePrueba),
    ...listar('pruebas', deCodigo),
    ...listar('qa', deCodigo),
  ];
}

const escapar = (palabra) => palabra.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');

/** Dónde aparece una palabra entera (o un texto literal) en esos archivos: `archivo:línea`. */
export function apariciones(archivos, palabra, { literal = false, conComentarios = false } = {}) {
  const patron = literal
    ? new RegExp(escapar(palabra), 'u')
    : new RegExp(`(?<![\\w-])${escapar(palabra)}(?![\\w-])`, 'u');
  const salida = [];
  for (const archivo of archivos) {
    const texto = conComentarios ? leer(archivo) : limpio(archivo);
    if (!patron.test(texto)) continue;
    const renglones = texto.split('\n');
    for (let i = 0; i < renglones.length; i += 1) {
      if (patron.test(renglones[i])) salida.push({ archivo, linea: i + 1 });
    }
  }
  return salida;
}

export const comoCita = ({ archivo, linea }) => `${archivo}:${String(linea)}`;
