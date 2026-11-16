import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * DP-21 · NADA DE APP INSTALABLE.
 *
 * El personal usa las apps de Morphiq (.exe y .apk) y los comensales, sólo el navegador. Si el sitio
 * trae manifiesto, modo app de iPhone o un service worker, Chrome ofrece «Instalar» (en `/qr/<token>`
 * y en `/n/<slug>/…` también) y el iPhone lo deja en el inicio con una sesión aparte. Este contrato
 * lee el código real; los íconos de pestaña y el `apple-touch-icon` SE QUEDAN.
 */

const RAIZ_WEB = process.cwd().endsWith('web') ? process.cwd() : join(process.cwd(), 'apps', 'web');
const ruta = (...partes: string[]) => join(RAIZ_WEB, ...partes);

/** Los archivos de código de una carpeta, a cualquier profundidad (sin pruebas ni dependencias). */
function codigoDe(carpeta: string): string[] {
  if (!existsSync(carpeta)) return [];
  const salida: string[] = [];
  for (const e of readdirSync(carpeta, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.next') continue;
    const completa = join(carpeta, e.name);
    if (e.isDirectory()) salida.push(...codigoDe(completa));
    else if (/\.(tsx?|jsx?|mjs|html)$/.test(e.name) && !/\.test\.[jt]sx?$/.test(e.name)) {
      salida.push(completa);
    }
  }
  return salida;
}

/** Todos los archivos de una carpeta, de cualquier tipo. */
function archivosDe(carpeta: string): string[] {
  if (!existsSync(carpeta)) return [];
  return readdirSync(carpeta, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? archivosDe(join(carpeta, e.name)) : [join(carpeta, e.name)],
  );
}

const FUENTES = ['app', 'src', 'heredado'].flatMap((c) => codigoDe(ruta(c)));

/** Cada rastro de «instalable» que no debe aparecer en el código que se sirve. */
const RASTROS: readonly (readonly [string, RegExp])[] = [
  ['metadata.manifest', /\bmanifest\s*:/],
  ['rel="manifest"', /rel\s*=\s*["']manifest["']/],
  ['appleWebApp', /appleWebApp/],
  ['apple-mobile-web-app-capable', /apple-mobile-web-app-capable/],
  ['mobile-web-app-capable', /(?<![-\w])mobile-web-app-capable/],
  ['serviceWorker.register', /serviceWorker\s*\.\s*register/],
  ['navigator.serviceWorker', /navigator\s*\.\s*serviceWorker/],
  ['workbox', /workbox/i],
  ['sw.js', /\bsw\.js\b/],
  ['beforeinstallprompt', /beforeinstallprompt/],
];

describe('DP-21 · el sitio no es instalable', { timeout: 30_000 }, () => {
  it('no existe `app/manifest.*` ni ruta que sirva el manifiesto', () => {
    const carpeta = ruta('app');
    const manifiestos = readdirSync(carpeta).filter((n) => /^manifest\./i.test(n));
    expect(manifiestos).toEqual([]);
    expect(existsSync(ruta('app', 'manifest.webmanifest'))).toBe(false);
    expect(existsSync(ruta('app', 'manifest.json'))).toBe(false);
  });

  it('`public/` no trae manifest.json, *.webmanifest ni service worker', () => {
    const prohibidos = archivosDe(ruta('public')).filter((n) =>
      /(^|[\\/])(manifest\.json|[^\\/]*\.webmanifest|sw\.js|service-worker\.js|workbox[^\\/]*\.js)$/i.test(
        n,
      ),
    );
    expect(prohibidos).toEqual([]);
  });

  it.each(RASTROS)('ningún archivo de app/, src/ ni heredado/ declara %s', (_nombre, patron) => {
    const culpables = FUENTES.filter((f) => patron.test(readFileSync(f, 'utf8'))).map((f) =>
      f.slice(RAIZ_WEB.length + 1),
    );
    expect(culpables).toEqual([]);
  });

  it('los íconos de la pestaña y el apple-touch-icon se quedan', () => {
    const layout = readFileSync(ruta('app', 'layout.tsx'), 'utf8').replace(/\s+/g, '');
    expect(layout).toContain("apple:{url:'/iconos/apple-touch-icon.png',sizes:'180x180'}");
    expect(layout).toContain("url:'/iconos/favicon-32.png'");
    expect(existsSync(ruta('public', 'iconos', 'apple-touch-icon.png'))).toBe(true);
  });
});
