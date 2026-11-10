import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { apagarElResto } from './apagar-el-resto';

/**
 * DP-17 (QA de DP-16, D-H-09) · LA FICHA DEL PLATILLO ES MODAL TAMBIÉN PARA EL LECTOR DE PANTALLA.
 *
 * Con la ficha abierta, las tarjetas del menú seguían en el árbol de accesibilidad (el lector las
 * leía y el Tab salía de la ficha a ellas). Al abrir, lo que está junto a la capa de la ficha queda
 * `inert` (ni foco, ni lector, ni clic); al cerrar, vuelve como estaba y el foco regresa a donde
 * estaba. Lo que ya estaba `inert` por otra razón no se toca.
 */

interface Nodo {
  inert: boolean;
  readonly nombre: string;
}

function pagina() {
  const encabezado: Nodo = { inert: false, nombre: 'encabezado' };
  const menu: Nodo = { inert: false, nombre: 'menú' };
  const yaApagado: Nodo = { inert: true, nombre: 'otra ventana' };
  const capa: Nodo = { inert: false, nombre: 'ficha' };
  const hermanos = [encabezado, menu, yaApagado, capa];
  return { encabezado, menu, yaApagado, capa, hermanos };
}

describe('apagar el resto de la página mientras la ficha está abierta', () => {
  it('apaga los hermanos de la capa, y no la capa', () => {
    const p = pagina();
    apagarElResto(p.capa, p.hermanos);
    expect(p.hermanos.map((n) => [n.nombre, n.inert])).toEqual([
      ['encabezado', true],
      ['menú', true],
      ['otra ventana', true],
      ['ficha', false],
    ]);
  });

  it('al cerrar los devuelve como estaban (lo que ya estaba apagado, se queda apagado)', () => {
    const p = pagina();
    const devolver = apagarElResto(p.capa, p.hermanos);
    devolver();
    expect(p.hermanos.map((n) => [n.nombre, n.inert])).toEqual([
      ['encabezado', false],
      ['menú', false],
      ['otra ventana', true],
      ['ficha', false],
    ]);
  });
});

describe('la ficha del platillo lo usa', () => {
  const RAIZ_WEB = process.cwd().endsWith('web')
    ? process.cwd()
    : join(process.cwd(), 'apps', 'web');
  const c = readFileSync(
    join(RAIZ_WEB, 'heredado/components/portalqr/ProductoQRDialog.jsx'),
    'utf8',
  )
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\s+/g, '');

  it('al abrir apaga el resto y al cerrar devuelve el foco', () => {
    expect(c).toContain('apagarElResto(capa,Array.from(capa.parentElement?.children??[]))');
    expect(c).toContain('anterior.focus()');
    expect(c).toContain('ref={capaRef}');
  });

  it('el foco no salta a «Cerrar» cuando el portal se refresca (el efecto depende sólo de `open`)', () => {
    expect(c).toContain("if(evento.key==='Escape')alCerrarRef.current?.();");
    expect(c).toContain('anterior.focus();};},[open]);');
  });
});
