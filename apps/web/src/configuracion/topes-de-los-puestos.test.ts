import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { topesEnPantalla } from './topes-de-los-puestos';

/**
 * DP-14 · ronda 2 (menor) · CONFIGURACIÓN → DESCUENTOS DICE LOS TOPES REALES.
 *
 * Decía «gerente 30 %, administrador 50 %, dueño 100 %» fijo aunque el negocio tuviera otros en
 * `topes_descuento`. Ahora pinta lo que el servidor aplica a cada puesto (`venta.topes_de_los_puestos`):
 * el porcentaje y el monto, lo que llegue primero.
 */
describe('topesEnPantalla', () => {
  it('cada puesto con su nombre, su porcentaje y su monto en centavos', () => {
    expect(
      topesEnPantalla([
        { rol: 'gerente', topeBp: 2_000, topeCentavos: '100000' },
        { rol: 'administrador', topeBp: 5_000, topeCentavos: '500000' },
        { rol: 'dueno', topeBp: 10_000, topeCentavos: '100000000' },
      ]),
    ).toEqual([
      { rol: 'gerente', puesto: 'gerente', porcentaje: '20', centavos: 100_000 },
      { rol: 'administrador', puesto: 'administrador', porcentaje: '50', centavos: 500_000 },
      { rol: 'dueno', puesto: 'dueño', porcentaje: '100', centavos: 100_000_000 },
    ]);
  });

  it('un porcentaje con medio punto no se redondea', () => {
    expect(
      topesEnPantalla([{ rol: 'gerente', topeBp: 1_250, topeCentavos: '0' }])[0],
    ).toMatchObject({ porcentaje: '12.5', centavos: 0 });
  });
});

describe('la pantalla de Descuentos', () => {
  const pantalla = () => readFileSync(join(__dirname, 'CajaYDescuentos.tsx'), 'utf8');

  it('ya no trae los topes escritos a mano', () => {
    expect(pantalla()).not.toMatch(/gerente 30 %, administrador 50 %, dueño 100 %/);
  });

  it('los lee del servidor y los pinta con el dinero del sistema', () => {
    expect(pantalla()).toMatch(
      /invocarComando<[^>]*>\(\s*'\/api\/venta\/topes-de-los-puestos',\s*\{\},?\s*\)/,
    );
    expect(pantalla()).toMatch(/topesEnPantalla\(/);
    expect(pantalla()).toMatch(/<Dinero centavos=\{t\.centavos\} \/>/);
  });
});
