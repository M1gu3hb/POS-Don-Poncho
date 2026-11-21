import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { coloresPorCategoria, franjaDeLaCategoria } from './colores';

/**
 * DP-24 · 3.1 y 3.4 · UNA SOLA REJILLA: el orden del menú, las pestañas con color y la franja de la
 * tarjeta son los mismos en la mesa del mesero, en «Para llevar» de la Caja y en el POS.
 *
 * Se lee el código de cada pantalla (sin comentarios): si una vuelve a ordenar por su cuenta, o a
 * pintar sus pestañas sin la pieza compartida, o pierde la franja, falla. Se valida mutando el
 * código real.
 */

const RAIZ = process.cwd().endsWith('web') ? process.cwd() : join(process.cwd(), 'apps', 'web');

function leer(ruta: string): string {
  return readFileSync(join(RAIZ, ruta), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

const REJILLAS = [
  { ruta: 'heredado/pages/Mesero.jsx', conFranja: true },
  { ruta: 'heredado/components/pedido/CatalogoDelPedido.jsx', conFranja: true },
  { ruta: 'heredado/pages/POS.jsx', conFranja: false },
] as const;

describe('las rejillas de platillos comparten orden y pestañas', () => {
  it.each(REJILLAS)(
    '$ruta ordena con ordenarMenu (el orden del portal) y no por su cuenta',
    ({ ruta }) => {
      const codigo = leer(ruta);
      expect(codigo).toMatch(/import \{ ordenarMenu \} from '@morphiqpos\/domain\/catalogo'/);
      expect(codigo).toMatch(/ordenarMenu\(/);
    },
  );

  it.each(REJILLAS)('$ruta pinta sus pestañas con la pieza compartida', ({ ruta }) => {
    const codigo = leer(ruta);
    expect(codigo).toMatch(/<PestanasDeCategoria\b/);
    // Ya no arma sus propios botones de categoría.
    expect(codigo).not.toMatch(/categorias\.map\(\(c\) =>\s*\(\s*<(button|Button)/);
  });

  it.each(REJILLAS.filter((r) => r.conFranja))(
    '$ruta le pone a cada tarjeta la franja del color de su categoría',
    ({ ruta }) => {
      const codigo = leer(ruta);
      expect(codigo).toMatch(/franjaDeLaCategoria\(/);
      expect(codigo).toMatch(/data-categoria-color=\{franja\['data-categoria-color'\]\}/);
      expect(codigo).toMatch(/\$\{franja\.className\}/);
    },
  );

  it('«Para llevar» sigue montando la rejilla de la Caja con las MISMAS props (la Caja la reusa)', () => {
    const llevar = leer('heredado/components/caja/ParaLlevarDialog.jsx');
    const abre = llevar.indexOf('<CatalogoDelPedido');
    const props = llevar.slice(abre, llevar.indexOf('/>', abre));
    for (const prop of ['productos=', 'categorias=', 'cargando=', 'cargados=', 'onTocar=']) {
      expect(props, prop).toContain(prop);
    }
    const catalogo = leer('heredado/components/pedido/CatalogoDelPedido.jsx');
    expect(catalogo).toMatch(
      /export default function CatalogoDelPedido\(\{\s*productos,\s*categorias,\s*cargando,\s*cargados,\s*onTocar,\s*colorize = true,\s*\}\)/,
    );
  });
});

describe('colores y franja', () => {
  const categorias = [
    { id: 'a', nombre: 'Entradas', color: 'cat-3' },
    { id: 'b', nombre: 'Postres', color: '#4A5568' },
    { id: 'c', nombre: 'Bebidas', color: null },
  ];

  it('sólo cuentan los colores de la paleta; un hex suelto o nada es «sin color»', () => {
    expect([...coloresPorCategoria(categorias)]).toEqual([['a', 'cat-3']]);
  });

  it('la tarjeta lleva franja sólo si su categoría tiene color', () => {
    const colores = coloresPorCategoria(categorias);
    expect(franjaDeLaCategoria(colores, 'a')).toEqual({
      className: 'franja-de-categoria',
      'data-categoria-color': 'cat-3',
    });
    expect(franjaDeLaCategoria(colores, 'b')).toEqual({ className: '' });
    expect(franjaDeLaCategoria(colores, null)).toEqual({ className: '' });
    expect(franjaDeLaCategoria(colores, 'desconocida')).toEqual({ className: '' });
  });
});

describe('«El orden del menú» guarda con comandos y refresca todo lo que lee ese orden', () => {
  const gancho = leer('src/restaurante/personalizar-menu/use-orden-del-menu.ts');

  it('usa los tres comandos de catálogo y no escribe por el puente', () => {
    for (const ruta of ['ordenar-categorias', 'ordenar-productos', 'mostrar-en-menu']) {
      expect(gancho).toContain(`/api/catalogo/${ruta}`);
    }
    expect(gancho).not.toContain('/api/datos/escribir');
  });

  it('manda el orden que VIO (`antes`) para que el servidor detecte a otra persona ordenando', () => {
    expect(gancho).toMatch(/categoriaIds: ids, antes/);
    expect(gancho).toMatch(/productoIds: ids, antes/);
  });

  it.each([
    "['productos_pos']",
    "['categorias']",
    "['categorias_producto']",
    "['menu_qr_platillos']",
    "['menu_qr_categorias']",
  ])('invalida %s tras guardar', (llave) => {
    expect(gancho).toContain(llave);
  });

  it('cada botón de orden mide 44 px por componente (nunca un selector global)', () => {
    const pantalla = leer('src/restaurante/personalizar-menu/OrdenDelMenu.tsx');
    expect(pantalla).toContain("'min-h-(--altura-tactil) min-w-(--altura-tactil)'");
    expect(pantalla.match(/className=\{BOTON\}/g)?.length).toBeGreaterThanOrEqual(2);
  });
});
