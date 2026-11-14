import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { pedidoSinTerminar } from './pedido-sin-terminar.ts';

/**
 * DP-18 · A7 · EL PEDIDO PARA LLEVAR QUE QUEDÓ A MEDIAS NO SE ARRASTRA AL SIGUIENTE.
 *
 * (1) Al cobrar bien, el borrador se borra en ese mismo momento, y SÓLO después de que el servidor
 * confirmó el cobro. (2) Un borrador de antes de una recarga se pregunta (retomar / descartar) en
 * vez de mezclarse; el que dejó esta misma pantalla (cobro cancelado, la X) vuelve sin preguntar.
 */

const RAIZ_WEB = process.cwd().endsWith('web') ? process.cwd() : join(process.cwd(), 'apps', 'web');
const leer = (...ruta: string[]) =>
  readFileSync(join(RAIZ_WEB, 'heredado', ...ruta), 'utf8')
    .replace(/\/\/.*$/gm, '')
    .replace(/\s+/g, ' ');

describe('A7 · la regla', () => {
  it('un borrador de antes pregunta antes de mezclarse', () => {
    expect(pedidoSinTerminar({ recuperado: true, deEstaSesion: false, decidido: false })).toBe(
      true,
    );
  });

  it('sin borrador no hay nada que preguntar', () => {
    expect(pedidoSinTerminar({ recuperado: false, deEstaSesion: false, decidido: false })).toBe(
      false,
    );
  });

  it('el borrador que dejó esta pantalla (cobro cancelado o la X) vuelve con todo, sin preguntar', () => {
    expect(pedidoSinTerminar({ recuperado: true, deEstaSesion: true, decidido: false })).toBe(
      false,
    );
  });

  it('una vez que la cajera eligió, no se vuelve a preguntar', () => {
    expect(pedidoSinTerminar({ recuperado: true, deEstaSesion: false, decidido: true })).toBe(
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

  it('y sólo DESPUÉS de que el servidor confirmó el cobro (si se cae, el borrador sigue)', () => {
    const cobrar = caja.indexOf('const handleCobrar = async () => {');
    const llamada = caja.indexOf("'/api/venta/cobrar'", cobrar);
    const borrado = caja.indexOf('borrarBorrador(almacenDelBorrador(), claveDelBorrador)', cobrar);
    expect(cobrar).toBeGreaterThan(-1);
    expect(llamada).toBeGreaterThan(cobrar);
    expect(borrado).toBeGreaterThan(llamada);
    expect(caja.slice(llamada, borrado)).toContain('ventaQuedoPagada = true;');
  });

  it('la Caja marca como de esta sesión el borrador de su cobro cancelado y el de la X', () => {
    expect(caja).toContain('setParaLlevarDeEstaSesion(true); setShowParaLlevar(true);');
    expect(caja).toContain(
      'onCerrar={() => { setParaLlevarDeEstaSesion(true); setShowParaLlevar(false); }}',
    );
    expect(caja).toContain('deEstaSesion={paraLlevarDeEstaSesion}');
    expect(caja).not.toContain('setParaLlevarDeEstaSesion(false)');
  });

  it('la toma pregunta por el borrador de antes y deja retomarlo o descartarlo', () => {
    expect(dialogo).toContain('const sinTerminar = pedidoSinTerminar({');
    expect(dialogo).toContain('Quedó un pedido sin terminar');
    expect(dialogo).toContain('pedido.vaciar()');
  });
});
