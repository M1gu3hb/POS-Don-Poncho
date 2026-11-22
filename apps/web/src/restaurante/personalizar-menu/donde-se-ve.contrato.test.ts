import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * DP-25 · Parte 8 · DP-D227 · LO OCULTO DEL POS NO SE OFRECE EN NINGUNA PANTALLA DEL POS, Y EL PORTAL
 * NO DEPENDE DE ESE INTERRUPTOR.
 *
 * Se lee el código de cada lugar (sin comentarios): si una rejilla del mesero o de la Caja deja de
 * pedir `visible_en_pos: true`, si el portal vuelve a mirarlo, o si un botón de «Dónde se ve» pierde
 * su medida táctil, falla. Se valida mutando el código real.
 */

const RAIZ = process.cwd().endsWith('web') ? process.cwd() : join(process.cwd(), 'apps', 'web');
const RAIZ_DEL_REPO = join(RAIZ, '..', '..');

function leer(ruta: string, raiz = RAIZ): string {
  return readFileSync(join(raiz, ruta), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

/** Cada lectura heredada del catálogo del POS: `ProductoTerminado.filter({ … })`. */
const FILTROS_HEREDADOS = /ProductoTerminado\.filter\(\{([^}]*)\}\)/g;

describe('lo oculto del POS no sale en las rejillas del mesero ni de la Caja', () => {
  it.each([
    ['heredado/pages/Mesero.jsx', 2],
    ['heredado/pages/POS.jsx', 1],
    ['heredado/components/caja/ParaLlevarDialog.jsx', 2],
  ] as const)('%s pide sólo lo visible en el POS en cada lectura', (ruta, lecturas) => {
    const filtros = [...leer(ruta).matchAll(FILTROS_HEREDADOS)].map((m) => m[1] ?? '');
    expect(filtros).toHaveLength(lecturas);
    for (const filtro of filtros) {
      expect(filtro).toMatch(/\bactivo:\s*true\b/);
      expect(filtro).toMatch(/\bvisible_en_pos:\s*true\b/);
    }
  });

  it('la mesa activa del mapa pide sólo lo activo y visible en el POS', () => {
    const codigo = leer('src/restaurante/MesaActiva.tsx');
    const llamada = codigo.slice(
      codigo.indexOf("consultarPuente<ProductoDeComanda>('ProductoTerminado'"),
    );
    expect(llamada.slice(0, 260)).toMatch(
      /filtro:\s*\{[^}]*\bactivo:\s*true\b[^}]*\bvisible_en_pos:\s*true\b[^}]*\}/,
    );
  });
});

describe('el portal del comensal sólo obedece al interruptor del portal', () => {
  it.each(['src/portal/consulta.ts', 'src/portal/productos.ts'])(
    '%s pide visible_en_menu_digital y no mira visible_en_pos',
    (ruta) => {
      const codigo = leer(ruta, join(RAIZ_DEL_REPO, 'packages', 'app'));
      expect(codigo).toMatch(/visible_en_menu_digital',\s*'=',\s*true/);
      expect(codigo).not.toContain('visible_en_pos');
    },
  );
});

describe('«Dónde se ve»', () => {
  const pieza = leer('src/restaurante/personalizar-menu/DondeSeVe.tsx');
  const botones = [...pieza.matchAll(/<Button\b[\s\S]*?>/g)].map((m) => m[0]);

  it('tiene los dos botones (abrir y cada acción) y todos miden 44 px por componente', () => {
    expect(pieza).toContain("'min-h-(--altura-tactil) min-w-(--altura-tactil)'");
    expect(botones).toHaveLength(2);
    for (const boton of botones) expect(boton).toMatch(/className=\{[^}]*BOTON/);
  });

  it('cada acción manda al comando sólo el cambio de esa acción', () => {
    const hook = leer('src/restaurante/personalizar-menu/use-orden-del-menu.ts');
    expect(hook).toMatch(
      /invocarComando\(RUTAS_DEL_ORDEN\.mostrar,\s*\{\s*productoId,\s*\.\.\.cambio\s*\}\)/,
    );
    const pantalla = leer('src/restaurante/personalizar-menu/OrdenDelMenu.tsx');
    expect(pantalla).toMatch(/datos\.mostrar\(pid,\s*cambio\)/);
    expect(pantalla).toMatch(/cambio = cambioDe\(accion\)/);
  });
});
