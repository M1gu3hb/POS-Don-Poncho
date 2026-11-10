import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * DP-16 (QA-D, H-01) · EL FONDO DE LA TARJETA se elige en los DOS editores de platillos.
 *
 * Con el módulo de recetas (el de Don Poncho) los platillos no se editan en «Productos → Editar»
 * (`ProductoSimpleDialog`) sino en Recetas (`RecetaFormDialog`): sólo con el primero, a sus 107
 * platillos no se les podía poner fondo. En los dos: el selector sale cuando no hay foto, el fondo
 * guardado se carga al editar y viaja al guardar.
 */

const RAIZ_WEB = process.cwd().endsWith('web') ? process.cwd() : join(process.cwd(), 'apps', 'web');
/** El código sin comentarios ni espacios: un comentario o un cambio de formato no cuentan. */
const sinEspacios = (ruta: string) =>
  readFileSync(join(RAIZ_WEB, ruta), 'utf8')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\s+/g, '');

describe('el fondo de la tarjeta en los editores de platillos', () => {
  it('Productos → Editar (sin recetas)', () => {
    const c = sinEspacios('heredado/components/productos/ProductoSimpleDialog.jsx');
    expect(c).toContain('setFondoTarjeta(producto?.fondo_tarjeta||null);');
    expect(c).toContain('fondo_tarjeta:fondoTarjeta,');
    expect(c).toContain(
      '{!imagenUrl.trim()&&(<SelectorDeFondovalor={fondoTarjeta}alCambiar={setFondoTarjeta}nombre={nombre}/>)}',
    );
  });

  it('Recetas (con recetas, el de Don Poncho)', () => {
    const c = sinEspacios('heredado/components/recetas/RecetaFormDialog.jsx');
    expect(c).toContain('fondo_tarjeta:productoToEdit.fondo_tarjeta??null,');
    expect(c).toContain('fondo_tarjeta:producto.fondo_tarjeta??null,');
    expect(c).toContain('{!producto.imagen_url&&(');
    expect(c).toContain(
      '<SelectorDeFondovalor={producto.fondo_tarjeta}alCambiar={(fondo)=>setProducto({...producto,fondo_tarjeta:fondo})}nombre={producto.nombre}/>',
    );
  });
});
