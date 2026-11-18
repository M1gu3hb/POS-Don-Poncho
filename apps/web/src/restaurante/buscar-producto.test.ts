import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { coincideConLaBusqueda } from './buscar-producto';

/**
 * DP-D178 · BUSCAR UN PRODUCTO EN EL PEDIDO: con acentos o sin ellos, encuentra igual.
 *
 * «limon» no encontraba «Limón preparado»: el filtro sólo pasaba a minúsculas. En un teléfono con el
 * teclado en pantalla casi nadie teclea el acento, y quien lo teclea tampoco debe fallar contra un
 * nombre que no lo lleva.
 */
describe('coincideConLaBusqueda', () => {
  it('«limon» encuentra «Limón preparado» y «LIMÓN» encuentra «Limonada»', () => {
    expect(coincideConLaBusqueda('Limón preparado', 'limon')).toBe(true);
    expect(coincideConLaBusqueda('Limonada natural 500 ml', 'LIMÓN')).toBe(true);
  });

  it('encuentra por cualquier parte del nombre y sin importar mayúsculas', () => {
    expect(coincideConLaBusqueda('Orden de tacos al pastor', 'TACOS')).toBe(true);
    expect(coincideConLaBusqueda('Orden de tacos al pastor', 'al pas')).toBe(true);
  });

  it('una búsqueda vacía o de espacios deja pasar todo', () => {
    expect(coincideConLaBusqueda('Sopa de tortilla', '')).toBe(true);
    expect(coincideConLaBusqueda('Sopa de tortilla', '   ')).toBe(true);
  });

  it('lo que no está en el nombre no coincide, y un nombre ausente tampoco', () => {
    expect(coincideConLaBusqueda('Sopa de tortilla', 'pizza')).toBe(false);
    expect(coincideConLaBusqueda(null, 'sopa')).toBe(false);
    expect(coincideConLaBusqueda(undefined, 'sopa')).toBe(false);
  });
});

describe('quién filtra por el ayudante', () => {
  const WEB = join(__dirname, '..', '..');
  for (const ruta of [
    'heredado/pages/Mesero.jsx',
    'heredado/components/pedido/CatalogoDelPedido.jsx',
  ]) {
    it(`${ruta} busca con coincideConLaBusqueda y no con toLowerCase().includes`, () => {
      const texto = readFileSync(join(WEB, ruta), 'utf8');
      expect(texto).toMatch(/from '~\/restaurante\/buscar-producto'/);
      expect(texto).toMatch(/coincideConLaBusqueda\(/);
    });
  }
});
