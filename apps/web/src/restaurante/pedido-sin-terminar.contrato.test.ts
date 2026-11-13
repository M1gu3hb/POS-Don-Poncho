import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { pedidoSinTerminar } from './pedido-sin-terminar.ts';

/**
 * DP-18 · A7 · EL PEDIDO PARA LLEVAR QUE QUEDÓ A MEDIAS NO SE ARRASTRA AL SIGUIENTE.
 *
 * (1) Al cobrar bien, el borrador se borra en ese mismo momento. (2) Un borrador de antes se
 * pregunta (retomar / descartar) en vez de mezclarse; volver de SU cobro cancelado no pregunta.
 */

const RAIZ_WEB = process.cwd().endsWith('web') ? process.cwd() : join(process.cwd(), 'apps', 'web');
const leer = (...ruta: string[]) =>
  readFileSync(join(RAIZ_WEB, 'heredado', ...ruta), 'utf8')
    .replace(/\/\/.*$/gm, '')
    .replace(/\s+/g, ' ');

describe('A7 · la regla', () => {
  it('un borrador de antes pregunta antes de mezclarse', () => {
    expect(pedidoSinTerminar({ recuperado: true, volviendoDelCobro: false, decidido: false })).toBe(
      true,
    );
  });

  it('sin borrador no hay nada que preguntar', () => {
    expect(
      pedidoSinTerminar({ recuperado: false, volviendoDelCobro: false, decidido: false }),
    ).toBe(false);
  });

  it('al volver de un cobro cancelado el pedido vuelve con todo, sin preguntar', () => {
    expect(pedidoSinTerminar({ recuperado: true, volviendoDelCobro: true, decidido: false })).toBe(
      false,
    );
  });

  it('una vez que la cajera eligió, no se vuelve a preguntar', () => {
    expect(pedidoSinTerminar({ recuperado: true, volviendoDelCobro: false, decidido: true })).toBe(
      false,
    );
  });
});

describe('A7 · las pantallas', () => {
  const caja = leer('pages', 'Caja.jsx');
  const dialogo = leer('components', 'caja', 'ParaLlevarDialog.jsx');

  it('la Caja borra el borrador al cobrar, en el mismo paso que marca el pago', () => {
    expect(caja).toContain(
      'paraLlevarPagadoRef.current = true; const claveDelBorrador = claveDelParaLlevar(posUser?.id); if (claveDelBorrador) borrarBorrador(almacenDelBorrador(), claveDelBorrador);',
    );
  });

  it('la Caja distingue volver de su cobro cancelado de abrir un pedido nuevo', () => {
    expect(caja).toContain('setParaLlevarVuelveDelCobro(true); setShowParaLlevar(true);');
    expect(caja).toContain('volviendoDelCobro={paraLlevarVuelveDelCobro}');
  });

  it('la toma pregunta por el borrador de antes y deja retomarlo o descartarlo', () => {
    expect(dialogo).toContain('const sinTerminar = pedidoSinTerminar({');
    expect(dialogo).toContain('Quedó un pedido sin terminar');
    expect(dialogo).toContain('pedido.vaciar()');
  });
});
