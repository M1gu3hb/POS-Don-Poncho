import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * DP-12.6 · CONTRATO: LO QUE EL NAVEGADOR MIDE, LEÍDO EN EL CÓDIGO.
 *
 * `pruebas/e2e/pantallas-sin-estorbos.spec.ts` mide con cajas (`boundingBox`) que nada se desborda ni
 * se tapa en 320–430 px. Esas pruebas tardan; este contrato exige, en el código, las decisiones que
 * las hacen pasar, para que una vuelta de `pnpm test:unit` ya avise si alguien las deshace.
 */

const WEB = join(__dirname, '..', '..');
const fuente = (ruta: string): string => readFileSync(join(WEB, ruta), 'utf8');

describe('Cocina en el teléfono', () => {
  it('el título pide su sitio (`basis-48`): si no caben, los botones pasan al renglón de abajo', () => {
    const cocina = fuente('heredado/pages/Cocina.jsx');
    expect(cocina).toMatch(/<div className="grow basis-48 min-w-0">\s*<h1/);
    expect(cocina).not.toMatch(/<div className="flex-1 min-w-0">\s*<h1/);
  });
});

describe('el botón redondo del menú', () => {
  const marco = fuente('heredado/components/common/AppLayout.jsx');

  it('el contenido le deja su lugar al final: sólo si hay botón, y en cada ancho', () => {
    expect(marco).toMatch(/conBotonRedondo = posUser\.rol === ROLES\.ADMIN/);
    expect(marco).toMatch(/' pb-24 md:pb-24 lg:pb-8'/);
  });

  it('el relleno de abajo se agrega al del marco, no lo reemplaza', () => {
    expect(marco).toMatch(/\+\s*espacioAlFinal/);
  });
});

describe('Portal QR → Solicitudes', () => {
  it('las pestañas de filtros se acomodan en renglones, no en una tira que se corta', () => {
    const tab = fuente('heredado/components/portalqr/SolicitudesQRTab.jsx');
    expect(tab).toMatch(/<div className="flex flex-wrap gap-1\.5">\s*\{filtros\.map/);
    expect(tab).not.toMatch(/overflow-x-auto pb-1">\s*\{filtros\.map/);
  });
});

describe('el menú QR del comensal', () => {
  it('la marca del precio va anclada arriba y mide un renglón, no centrada', () => {
    const pagina = fuente('src/restaurante/menu-qr/PaginaConBotones.tsx');
    expect(pagina).toMatch(/absolute top-0 -right-\[3px\]/);
    expect(pagina).toMatch(/height: `\$\{String\(altura\)\}%`/);
    expect(pagina).not.toMatch(/top-1\/2 right-0 max-h-full -translate-y-1\/2/);
  });

  it('«Atención» va a la izquierda, fuera de la columna de las marcas', () => {
    const fab = fuente('heredado/components/portalqr/AtencionFAB.jsx');
    expect(fab).toMatch(/fixed bottom-5 left-5 z-50 flex flex-col items-start/);
    expect(fab).not.toMatch(/fixed bottom-5 right-5/);
  });
});
