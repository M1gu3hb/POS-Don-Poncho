import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

/**
 * EMPAQUETA EL ARNÉS (DP-20). El ticket y el camino de impresión son código de la app
 * (`apps/web`), con sus alias (`@` → `heredado`, `~` → `src`) y su JSX: para cargarlos en una
 * página en blanco hay que empaquetarlos. Se usa el Vite que ya trae Vitest —la misma versión que
 * transforma las pruebas unitarias—, sin agregar una dependencia para una sola prueba.
 */

const RAIZ = process.cwd();
const WEB = join(RAIZ, 'apps', 'web');

interface Vite {
  build(opciones: Record<string, unknown>): Promise<unknown>;
}

function vite(): Vite {
  const desdeVitest = createRequire(
    createRequire(join(RAIZ, 'package.json')).resolve('vitest/package.json'),
  );
  return desdeVitest('vite') as Vite;
}

/** Un módulo como lo resuelve la app (pnpm no lo deja a la vista de la raíz). */
function desdeLaWeb(modulo: string): string {
  return createRequire(join(WEB, 'package.json')).resolve(modulo).replaceAll('\\', '/');
}

function codigoDe(salida: unknown): string {
  const paquetes = Array.isArray(salida) ? salida : [salida];
  for (const paquete of paquetes) {
    const trozos = (paquete as { output?: readonly { type?: string; code?: string }[] }).output;
    const trozo = trozos?.find((t) => t.type === 'chunk' && typeof t.code === 'string');
    if (trozo?.code !== undefined) return trozo.code;
  }
  throw new Error('El empaquetado del arnés no dejó ningún guion.');
}

/** Dónde queda el guion ya empaquetado: se arma UNA vez por corrida (`preparar.ts`). */
export const GUION_DEL_ARNES = join(RAIZ, 'pruebas', 'impresion', '.arnes', 'arnes.js');

export async function guardarArnes(): Promise<void> {
  mkdirSync(dirname(GUION_DEL_ARNES), { recursive: true });
  writeFileSync(GUION_DEL_ARNES, await empaquetarArnes());
}

export function leerArnes(): string {
  return readFileSync(GUION_DEL_ARNES, 'utf8');
}

/** El guion del arnés, listo para `page.addScriptTag({ content })`. Define `window.arnes`. */
export async function empaquetarArnes(): Promise<string> {
  const salida = await vite().build({
    configFile: false,
    root: WEB,
    logLevel: 'error',
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    resolve: {
      // El arnés vive fuera de `apps/web`: React es el de la app, uno solo.
      dedupe: ['react', 'react-dom'],
      alias: [
        { find: /^react$/, replacement: desdeLaWeb('react') },
        { find: /^react\/jsx-runtime$/, replacement: desdeLaWeb('react/jsx-runtime') },
        { find: /^react-dom$/, replacement: desdeLaWeb('react-dom') },
        { find: /^react-dom\/client$/, replacement: desdeLaWeb('react-dom/client') },
        { find: /^@\//, replacement: `${join(WEB, 'heredado').replaceAll('\\', '/')}/` },
        { find: /^~\//, replacement: `${join(WEB, 'src').replaceAll('\\', '/')}/` },
      ],
    },
    build: {
      write: false,
      minify: false,
      lib: {
        entry: join(RAIZ, 'pruebas', 'impresion', 'arnes.jsx'),
        formats: ['iife'],
        name: 'arnesDelTicket',
      },
    },
  });
  return codigoDe(salida);
}
