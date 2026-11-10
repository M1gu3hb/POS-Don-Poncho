import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * DP-16 (1.3) · LAS VENTANAS CRECEN DE DONDE SE TOCÓ, TODAS CON LA MISMA PIEZA.
 *
 * Los diálogos entraban «desde la izquierda» (`slide-in-from-left-1/2`) y el panel lateral tardaba
 * 500 ms. Ahora los diálogos, las alertas y los paneles usan `ventana-emergente` / `ventana-panel`
 * (hoja `ventanas.css`) y fijan su origen con `refConOrigenDeVentana`. Este contrato impide
 * volver atrás: ni en las primitivas ni en ninguna pantalla.
 */

const RAIZ = process.cwd().endsWith('web') ? join(process.cwd(), '..', '..') : process.cwd();
const leer = (...ruta: string[]): string => readFileSync(join(RAIZ, ...ruta), 'utf8');

const PRIMITIVAS: readonly string[] = [
  'packages/ui/src/primitivas/dialog.tsx',
  'packages/ui/src/primitivas/alert-dialog.tsx',
  'packages/ui/src/primitivas/sheet.tsx',
  'apps/web/heredado/components/ui/dialog.jsx',
  'apps/web/heredado/components/ui/alert-dialog.jsx',
  'apps/web/heredado/components/ui/sheet.jsx',
];

function archivosDeCodigo(dir: string, acumulado: string[] = []): string[] {
  for (const nombre of readdirSync(dir)) {
    if (nombre === 'node_modules' || nombre === '.next') continue;
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) archivosDeCodigo(ruta, acumulado);
    else if (/\.(jsx|tsx)$/.test(nombre)) acumulado.push(ruta);
  }
  return acumulado;
}

describe('DP-16 · las ventanas usan una sola pieza compartida', () => {
  it.each(PRIMITIVAS)('%s no desliza ni usa las animaciones sueltas de Tailwind', (ruta) => {
    const fuente = leer(...ruta.split('/'));
    expect(fuente).not.toMatch(/slide-(in-from|out-to)/);
    expect(fuente).not.toMatch(/zoom-(in|out)-/);
    expect(fuente).not.toMatch(/animate-(in|out)\b/);
  });

  it.each(PRIMITIVAS)('%s se apoya en la hoja compartida', (ruta) => {
    const fuente = leer(...ruta.split('/'));
    expect(fuente).toMatch(/ventana-(emergente|panel)/);
    expect(fuente).toMatch(/ventana-velo/);
  });

  it('diálogos y alertas fijan el origen desde el último toque', () => {
    for (const ruta of PRIMITIVAS.filter((r) => !(r.split('/').at(-1) ?? '').startsWith('sheet'))) {
      expect(leer(...ruta.split('/'))).toContain('refConOrigenDeVentana(ref)');
    }
  });

  it('ninguna pantalla vuelve a entrar «desde la izquierda»', () => {
    const sueltos = archivosDeCodigo(join(RAIZ, 'apps', 'web'))
      .concat(archivosDeCodigo(join(RAIZ, 'packages', 'ui', 'src')))
      .filter((ruta) =>
        /slide-in-from-left-1\/2|slide-in-from-top-\[48%\]/.test(readFileSync(ruta, 'utf8')),
      );
    expect(sueltos).toEqual([]);
  }, 30_000);

  it('el panel lateral dura 220 ms y el diálogo 200 ms', () => {
    const hoja = leer('packages', 'ui', 'src', 'estilos', 'ventanas.css');
    expect(hoja).toMatch(/--duracion-ventana:\s*200ms/);
    expect(hoja).toMatch(/--duracion-panel:\s*220ms/);
  });
});

describe('DP-16 · la hoja de las ventanas', () => {
  const hoja = leer('packages', 'ui', 'src', 'estilos', 'ventanas.css');

  it('sólo anima transform y opacity: nada de layout', () => {
    const keyframes = [...hoja.matchAll(/@keyframes[^{]+\{((?:[^{}]|\{[^{}]*\})*)\}/g)];
    expect(keyframes.length).toBeGreaterThan(0);
    for (const bloque of keyframes) {
      const propiedades = [...(bloque[1] ?? '').matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1]);
      for (const propiedad of propiedades) {
        expect(['opacity', 'transform']).toContain(propiedad);
      }
    }
  });

  it('respeta prefers-reduced-motion con un fundido y sin zoom', () => {
    const reducido = hoja.slice(hoja.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(reducido).toContain('ventana-funde');
    expect(reducido).not.toContain('ventana-entra');
    expect(reducido).not.toContain('panel-entra');
  });

  it('la curva es exponencial, sin rebote', () => {
    expect(hoja).toMatch(/--curva-ventana:\s*cubic-bezier\(0\.16,\s*1,\s*0\.3,\s*1\)/);
  });

  it('sobrevive al minificador del build con sus variables y animaciones', () => {
    const desdeNext = createRequire(
      createRequire(join(RAIZ, 'apps', 'web', 'package.json')).resolve('next/package.json'),
    );
    const { transform } = desdeNext('lightningcss') as {
      transform: (o: {
        filename: string;
        code: Buffer;
        minify: boolean;
        errorRecovery: boolean;
      }) => { code: Buffer };
    };
    const salida = transform({
      filename: 'ventanas.css',
      code: Buffer.from(hoja),
      minify: true,
      errorRecovery: false,
    }).code.toString();
    expect(salida).toContain('.ventana-emergente[data-state=open]');
    expect(salida).toContain('transform-origin:var(--origen-x,50%) var(--origen-y,50%)');
    expect(salida).toContain('scale(var(--escala-inicial-ventana');
    expect(salida).not.toMatch(/translate:/);
  });
});
