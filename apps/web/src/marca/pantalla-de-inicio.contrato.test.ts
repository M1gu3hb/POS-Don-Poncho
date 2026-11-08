import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * DP-15 · «AGREGAR A PANTALLA DE INICIO» CON NOMBRE E ÍCONO DE DON PONCHO (Fase 8).
 *
 * Android lee el manifiesto (`app/manifest.ts`: nombre, nombre corto, íconos y `standalone`). El
 * iPhone toma el ícono de `apple-touch-icon` y, para abrir como app y con su nombre corto, las
 * etiquetas `apple-mobile-web-app-*` que Next escribe desde `metadata.appleWebApp`.
 */

const RAIZ_WEB = process.cwd().endsWith('web') ? process.cwd() : join(process.cwd(), 'apps', 'web');
const leer = (ruta: string) => readFileSync(join(RAIZ_WEB, ruta), 'utf8').replace(/\s+/g, '');

describe('DP-15 · la app en la pantalla de inicio', () => {
  it('Android: el manifiesto tiene nombre, nombre corto, íconos y abre como app', () => {
    const m = leer('app/manifest.ts');
    expect(m).toContain("name:'POSDonPoncho'");
    expect(m).toContain("short_name:'DonPoncho'");
    expect(m).toContain("display:'standalone'");
    expect(m).toContain("src:'/iconos/icono-512-maskable.png'");
  });

  it('iPhone: ícono de inicio y modo app con su nombre corto', () => {
    const l = leer('app/layout.tsx');
    expect(l).toContain("apple:{url:'/iconos/apple-touch-icon.png',sizes:'180x180'}");
    expect(l).toContain("appleWebApp:{capable:true,title:'DonPoncho',statusBarStyle:'default'}");
  });
});
