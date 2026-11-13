import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * DP-18 (A4) · DONDE FALTA EL ALMACÉN, LA PANTALLA DEJA CREARLO.
 *
 * Inventario sacaba el almacén del último movimiento del ledger: en una sucursal recién abierta no hay
 * movimientos y decía «Falta el almacén» aunque existiera, y si de verdad no existía no había forma de
 * crearlo. Compras sólo respondía el 422 de `compras.registrar`. Ahora las dos lo leen del resumen de
 * inventario y, si no hay ninguno, ofrecen «Crear el almacén principal» (`FaltaElAlmacen`).
 */

const WEB = join(import.meta.dirname, '..', '..');
const plano = (ruta: string): string =>
  readFileSync(join(WEB, ruta), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\s+/g, '');

describe('DP-18 · falta el almacén', () => {
  it('el aviso crea el almacén principal y avisa a la pantalla con su id', () => {
    const c = plano('src/inventario/FaltaElAlmacen.tsx');
    expect(c).toContain('awaitcrearAlmacenPrincipal()');
    expect(c).toContain('onCreado(id)');
    expect(c).toContain('Crearelalmacénprincipal');
  });

  it('Inventario lo lee del resumen cuando el ledger no lo dice, y ofrece crearlo', () => {
    const c = plano('src/restaurante/Inventario.tsx');
    expect(c).toContain('leerAlmacenes(');
    expect(c).toContain('almacenPrincipal(');
    expect(c).toContain('<FaltaElAlmacen');
  });

  it('Compras lo ofrece a quien registra compras', () => {
    const c = plano('heredado/pages/Compras.jsx');
    expect(c).toContain('leerAlmacenes(');
    expect(c).toMatch(/registra&&sinAlmacen&&\(?<FaltaElAlmacen/);
  });
});
