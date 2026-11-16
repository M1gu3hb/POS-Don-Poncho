import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * DP-21 · Bloque 16 (M21) · LO QUE EL BARRIDO ENCONTRÓ Y SE ARREGLÓ: el cableado, leído.
 *
 * El barrido (`pruebas/e2e/barrido-visual.spec.ts`) mide en el navegador; estas pruebas dejan escrito
 * lo que se corrigió, para que una edición futura no lo regrese sin que algo se ponga rojo.
 */

const RAIZ = process.cwd().endsWith('web') ? process.cwd() : join(process.cwd(), 'apps', 'web');
const leer = (ruta: string): string => readFileSync(join(RAIZ, ruta), 'utf8');

describe('las tarjetas de una fila miden lo mismo', () => {
  it('Caja → Movimientos: la rejilla estira sus tarjetas (sin `items-start`)', () => {
    const rejilla = leer('src/restaurante/MovimientosDeCaja.tsx')
      .split('\n')
      .find((l) => l.includes('lg:grid-cols-2'));
    expect(rejilla).toBeDefined();
    expect(rejilla).not.toMatch(/\bitems-start\b/);
  });
});

describe('el corte no desborda en el teléfono', () => {
  it('su rejilla tiene una columna que puede encogerse (`minmax(0,1fr)`) desde el principio', () => {
    expect(leer('src/restaurante/CierreDiario.tsx')).toContain(
      'grid grid-cols-[minmax(0,1fr)] items-start',
    );
  });
});

describe('los campos de una fila se alinean por abajo', () => {
  it.each([
    'heredado/components/compras/RegistrarCompraDialog.jsx',
    'heredado/components/inventario/RegistrarInventarioInicialDialog.jsx',
  ])('%s: «cantidad · unidad · costo» alinea por abajo y se apila en el teléfono', (archivo) => {
    expect(leer(archivo)).toContain('grid grid-cols-1 items-end gap-3 sm:grid-cols-3');
  });
});

describe('el texto no se corta con puntos suspensivos donde hay sitio para dos renglones', () => {
  it('la barra: el nombre del negocio y el de quien entró', () => {
    const barra = leer('heredado/components/common/Sidebar.jsx');
    expect(barra).toMatch(/font-bold line-clamp-2 break-words leading-tight/);
    expect(barra).toMatch(/text-xs font-medium break-words leading-tight">\{posUser\.nombre\}/);
  });

  it('los nombres de platillos e ingredientes', () => {
    expect(leer('heredado/pages/Productos.jsx')).toMatch(/line-clamp-2 break-words font-heading/);
    expect(leer('heredado/pages/Inventario.jsx')).toMatch(/line-clamp-2 break-words text-sm/);
  });

  it('la mesa del mapa: el nombre del mesero se acorta a su nombre de pila bajo 100 px', () => {
    const mesa = leer('heredado/components/mesas/MesaShape.jsx');
    expect(mesa).toMatch(/const apretada = dim\.w < 100;/);
  });
});
