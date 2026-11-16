import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * DP-20.1 · EL PLUGIN ES UNA ENTRADA DEL BUILD.
 *
 * El plugin vive en `scripts/modo-compatible/`, FUERA de `apps/web`, y Turbo sólo cuenta como
 * entradas de un build los archivos de su paquete. Sin declararlo, un cambio que toque sólo el
 * plugin salía de la caché con el CSS de antes (pasó: el contrato lo detectó tras el build, y de
 * milagro). En un despliegue con caché remota eso es producción sirviendo la hoja vieja.
 */

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const leer = (ruta: string): string => readFileSync(join(RAIZ, ruta), 'utf8');

describe('lo que Turbo y PostCSS saben del plugin', () => {
  it('Turbo lo cuenta como entrada de todos los builds', () => {
    const turbo = JSON.parse(leer('turbo.json')) as { globalDependencies?: string[] };
    expect(turbo.globalDependencies).toContain('scripts/modo-compatible/**');
    // Y el envoltorio que fija `NODE_ENV=production`, que tampoco vive en el paquete.
    expect(turbo.globalDependencies).toContain('scripts/construir-web.mjs');
  });

  it('PostCSS lo corre DESPUÉS de Tailwind', () => {
    const config = leer('apps/web/postcss.config.mjs').replace(/\s+/g, ' ');
    expect(config).toContain(
      "import modoCompatible from '../../scripts/modo-compatible/plugin.mjs'",
    );
    expect(config).toContain("plugins: ['@tailwindcss/postcss', modoCompatible()]");
  });

  it('el contrato corre después del build, en `verify` y en la CI', () => {
    const verify = (JSON.parse(leer('package.json')) as { scripts: Record<string, string> })
      .scripts['verify'];
    expect(verify).toMatch(/pnpm build && pnpm verify:modo-compatible/);
    const ci = leer('.github/workflows/verificar.yml').replace(/\s+/g, ' ');
    expect(ci).toMatch(/run: pnpm build .*run: pnpm verify:modo-compatible/);
  });
});
