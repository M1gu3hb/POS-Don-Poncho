import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * DP-16 · Parte 4 · LO QUE ENCONTRÓ EL QA DE LOS APARATOS (QA-D, `docs/qa/HALLAZGOS-DP16.md`).
 *
 * Contratos sobre el código: un objetivo que vuelve a bajar de 44 px, la ficha que deja de ser
 * diálogo o el texto sobre la foto sin su sombra rompen esta prueba, no sólo la vista.
 */

const RAIZ_WEB = process.cwd().endsWith('web') ? process.cwd() : join(process.cwd(), 'apps', 'web');
const RAIZ = join(RAIZ_WEB, '..', '..');
/** El código sin comentarios ni espacios: un comentario o un cambio de formato no cuentan. */
const sinEspacios = (ruta: string) =>
  readFileSync(join(RAIZ, ruta), 'utf8')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\s+/g, '');

const FICHA = 'apps/web/heredado/components/portalqr/ProductoQRDialog.jsx';

describe('QA-D · el portal del comensal', () => {
  it('H-03 · la ficha: «Cerrar», la cantidad y las presentaciones de 44 px', () => {
    const c = sinEspacios(FICHA);
    expect(c).toContain('className="absolutetop-3right-3w-11h-11rounded-full');
    expect(
      c.split(
        'className="w-11h-11rounded-fullborder-2flexitems-centerjustify-centerdisabled:opacity-40"',
      ),
    ).toHaveLength(3);
    expect(c).toContain('className={`min-h-11px-4rounded-fulltext-smfont-semiboldborder-2');
  });

  it('H-09 · la ficha es un diálogo con el nombre del platillo de título', () => {
    const c = sinEspacios(FICHA);
    expect(c).toContain('role="dialog"aria-modal="true"aria-labelledby={idDelTitulo}');
    expect(c).toContain('<h2id={idDelTitulo}');
  });

  it('H-03 · la «×» de los paneles y el botón del tema, de 44 px', () => {
    expect(sinEspacios('packages/ui/src/primitivas/sheet.tsx')).toContain(
      'size-[max(2.75rem,var(--altura-control))]place-items-centerrounded-full',
    );
    expect(sinEspacios('apps/web/heredado/components/common/ThemeToggle.jsx')).toContain(
      'justify-centerw-11h-11rounded-full',
    );
  });

  it('H-04 · «Páginas subidas»: las fichas de página y «Agregar» de 44 px', () => {
    expect(sinEspacios('apps/web/heredado/pages/PortalCliente.jsx')).toContain(
      'className={`shrink-0min-h-11px-4rounded-fulltext-smfont-semibold',
    );
    // Sin `size="sm"`: el tamaño normal del botón es `--altura-control` (44 px).
    expect(sinEspacios('apps/web/src/restaurante/PlatilloParaPedir.tsx')).toContain(
      '<Buttontype="button"onClick={alPedir}disabled={agotado}',
    );
  });

  it('H-02 · el texto sobre la foto lleva su propia sombra, del alto de lo que dice', () => {
    expect(sinEspacios('apps/web/src/portal/menu-digital/MenuDigital.tsx')).toContain(
      '<spanclassName="menu-tarjeta-textoflexflex-colgap-1">',
    );
    const css = sinEspacios('apps/web/src/portal/menu-digital/menu-digital.css');
    expect(css).toContain('.menu-tarjeta-foto.menu-tarjeta-texto{');
    expect(css).toContain('hsl(00%0%/0.62)calc(100%-2.5rem)');
  });
});

describe('QA-J · el portal', () => {
  it('H9 · en el menú digital no se pinta «Sin menú configurado todavía.»', () => {
    expect(sinEspacios('apps/web/heredado/pages/PortalCliente.jsx')).toContain(
      '{!usarDigital&&!usarProductos&&!usarSecciones&&(',
    );
  });
});

describe('QA-J · la cocina', () => {
  it('H8 · la banda «Cuenta cobrada» sale sólo en las mesas (`avisaCuentaCobrada`)', () => {
    expect(sinEspacios('apps/web/src/cocina/TarjetaDeCocina.tsx')).toContain(
      'constcobrada=cuenta.comandas.some(avisaCuentaCobrada);',
    );
  });
});

describe('QA-D · el mesero', () => {
  it('H-06 · «Entregar» por estación mide 44 px de alto', () => {
    expect(sinEspacios('apps/web/heredado/components/mesero/ListosParaRecogerCard.jsx')).toContain(
      'className="h-11px-3text-xsgap-1shrink-0border-exito/30',
    );
  });
});

describe('QA-D · la cocina', () => {
  it('H-05 · en «Listo» el botón baja cuando no cabe: no se encima con el texto', () => {
    const c = sinEspacios('apps/web/src/cocina/TarjetaDeCocina.tsx');
    expect(c).toContain(
      '<divclassName="flexflex-wrapitems-centerjustify-betweengap-(--espacio-2)">',
    );
    expect(c).toContain('variant="outline"className="shrink-0"');
  });
});
