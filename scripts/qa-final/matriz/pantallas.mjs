/**
 * DP-22 · EL MAPA TOTAL · las pantallas: cada ruta de `apps/web/app`, el código que la pinta y sus
 * diálogos y paneles, sacados del código (la cadena de importaciones de cada página).
 */
import { existsSync, statSync } from 'node:fs';
import { join, posix } from 'node:path';

import { RAIZ, leer, limpio, listar } from './fuentes.mjs';

const EXTENSIONES = [
  '',
  '.tsx',
  '.ts',
  '.jsx',
  '.js',
  '/index.tsx',
  '/index.ts',
  '/index.jsx',
  '/index.js',
];
const esArchivo = (ruta) => existsSync(join(RAIZ, ruta)) && statSync(join(RAIZ, ruta)).isFile();

/** A qué archivo del repo apunta una importación hecha desde `desde` (sólo dentro de `apps/web`). */
export function resolver(desde, especificador) {
  let base;
  if (especificador === '@/lib/packageConfig') base = 'apps/web/src/cliente/package-config.ts';
  else if (especificador.startsWith('@/')) base = `apps/web/heredado/${especificador.slice(2)}`;
  else if (especificador.startsWith('~/')) base = `apps/web/src/${especificador.slice(2)}`;
  else if (especificador.startsWith('.')) base = posix.join(posix.dirname(desde), especificador);
  else return null;
  for (const extension of EXTENSIONES) if (esArchivo(base + extension)) return base + extension;
  return null;
}

const IMPORTACIONES = /(?:from\s*|import\s*\(\s*|import\s+)["']([^"'\n]+)["']/gu;

const directas = new Map();
function importaDirecto(archivo) {
  if (!directas.has(archivo)) {
    const salida = new Set();
    for (const [, especificador] of limpio(archivo).matchAll(IMPORTACIONES)) {
      const destino = resolver(archivo, especificador);
      if (destino !== null && /\.[jt]sx?$/u.test(destino)) salida.add(destino);
    }
    directas.set(archivo, [...salida]);
  }
  return directas.get(archivo);
}

/** Todo lo que una página termina cargando, siguiendo importaciones dentro de `apps/web`. */
export function cierreDe(entradas) {
  const vistos = new Set(entradas);
  const cola = [...entradas];
  while (cola.length > 0) {
    for (const siguiente of importaDirecto(cola.pop())) {
      if (vistos.has(siguiente)) continue;
      vistos.add(siguiente);
      cola.push(siguiente);
    }
  }
  return vistos;
}

const VENTANAS = [
  { tipo: 'diálogo', patron: /<DialogContent\b/u, titulo: /<DialogTitle[^>]*>\s*([^<{]+?)\s*</u },
  {
    tipo: 'confirmación',
    patron: /<AlertDialogContent\b/u,
    titulo: /<AlertDialogTitle[^>]*>\s*([^<{]+?)\s*</u,
  },
  {
    tipo: 'panel',
    patron: /<(?:Sheet|Drawer)Content\b/u,
    titulo: /<(?:Sheet|Drawer)Title[^>]*>\s*([^<{]+?)\s*</u,
  },
  {
    tipo: 'diálogo propio',
    patron: /role=["'](?:alert)?dialog["']/u,
    titulo: /aria-label=["']([^"']+)["']/u,
  },
];

const nombreDe = (archivo) => posix.basename(archivo).replace(/\.[jt]sx?$/u, '');

/** Las ventanas que un archivo pinta: tipo, quién la pinta y su título si está escrito tal cual. */
export function ventanasDe(archivo) {
  const texto = limpio(archivo);
  const salida = [];
  for (const { tipo, patron, titulo } of VENTANAS) {
    if (!patron.test(texto)) continue;
    const escrito = titulo.exec(texto)?.[1]?.trim();
    salida.push({ tipo, componente: nombreDe(archivo), archivo, titulo: escrito ?? null });
  }
  return salida;
}

const aRuta = (pagina) => {
  const resto = pagina
    .replace(/^apps\/web\/app\//u, '')
    .replace(/(^|\/)page\.tsx$/u, '')
    .split('/')
    .filter((trozo) => trozo !== '' && !/^\(.+\)$/u.test(trozo));
  return `/${resto.join('/')}`;
};

const grupoDe = (pagina) => /\/\(([^)]+)\)\//u.exec(`/${pagina}`)?.[1] ?? 'público';

/** Los armazones (lo que comparten todas las pantallas de un grupo): sus ventanas van aparte. */
function armazones() {
  const disenos = listar('apps/web/app', (ruta) => /(^|\/)layout\.tsx$/u.test(ruta));
  return cierreDe(disenos);
}

export function pantallas() {
  const compartido = armazones();
  const paginas = listar('apps/web/app', (ruta) => /(^|\/)page\.tsx$/u.test(ruta));
  const salida = paginas.map((pagina) => {
    const cierre = cierreDe([pagina]);
    const propios = [...cierre].filter((archivo) => !compartido.has(archivo)).sort();
    // La pantalla, no su envoltura: `RestrictedRoute` sólo decide si se pinta.
    const directos = importaDirecto(pagina).filter((a) => !a.endsWith('/RestrictedRoute.jsx'));
    const principal = directos.find((a) => a.includes('/heredado/pages/')) ?? directos[0] ?? pagina;
    return {
      ruta: aRuta(pagina),
      grupo: grupoDe(pagina),
      pagina,
      principal,
      archivos: propios,
      ventanas: propios.flatMap(ventanasDe),
      lineas: propios.reduce((suma, archivo) => suma + leer(archivo).split('\n').length, 0),
    };
  });
  const delArmazon = [...compartido].sort().flatMap(ventanasDe);
  return { pantallas: salida.sort((a, b) => a.ruta.localeCompare(b.ruta, 'es')), delArmazon };
}
