import { describe, expect, it } from 'vitest';

import {
  ESCALA_CON_TOQUE,
  ESCALA_SIN_TOQUE,
  VIGENCIA_DEL_TOQUE_MS,
  calcularOrigenDeVentana,
  type CajaDeVentana,
} from './origen-de-ventana';

/** Un diálogo de 400 x 200 con el centro en (500, 300): su caja va de (300, 200) a (700, 400). */
const CAJA: CajaDeVentana = { centroX: 500, centroY: 300, ancho: 400, alto: 200 };

describe('el origen de la animación de una ventana', () => {
  it('con un toque reciente, crece desde ese punto medido dentro de la caja', () => {
    const origen = calcularOrigenDeVentana({
      toque: { x: 350, y: 250, en: 1_000 },
      ahora: 1_200,
      caja: CAJA,
      reducirMovimiento: false,
    });

    expect(origen).toEqual({ x: 50, y: 50, escala: ESCALA_CON_TOQUE });
  });

  it('sin ningún toque, aparece al centro con el zoom mínimo', () => {
    const origen = calcularOrigenDeVentana({
      toque: null,
      ahora: 5_000,
      caja: CAJA,
      reducirMovimiento: false,
    });

    expect(origen).toEqual({ x: 200, y: 100, escala: ESCALA_SIN_TOQUE });
  });

  it('con un toque viejo (más de un segundo), se trata como si no hubiera toque', () => {
    const origen = calcularOrigenDeVentana({
      toque: { x: 350, y: 250, en: 1_000 },
      ahora: 1_000 + VIGENCIA_DEL_TOQUE_MS + 1,
      caja: CAJA,
      reducirMovimiento: false,
    });

    expect(origen).toEqual({ x: 200, y: 100, escala: ESCALA_SIN_TOQUE });
  });

  it('un toque justo en el límite de vigencia todavía cuenta', () => {
    const origen = calcularOrigenDeVentana({
      toque: { x: 350, y: 250, en: 1_000 },
      ahora: 1_000 + VIGENCIA_DEL_TOQUE_MS,
      caja: CAJA,
      reducirMovimiento: false,
    });

    expect(origen.escala).toBe(ESCALA_CON_TOQUE);
  });

  it('con movimiento reducido no hay zoom aunque haya toque: sólo fundido', () => {
    const origen = calcularOrigenDeVentana({
      toque: { x: 350, y: 250, en: 1_000 },
      ahora: 1_100,
      caja: CAJA,
      reducirMovimiento: true,
    });

    expect(origen).toEqual({ x: 200, y: 100, escala: 1 });
  });

  it('un toque muy lejos de la ventana no la manda de un lado a otro: el origen se acota', () => {
    const origen = calcularOrigenDeVentana({
      toque: { x: -5_000, y: 9_000, en: 1_000 },
      ahora: 1_100,
      caja: CAJA,
      reducirMovimiento: false,
    });

    expect(origen.x).toBe(-400);
    expect(origen.y).toBe(400);
  });

  it('un toque en el futuro (reloj raro) no cuenta como reciente', () => {
    const origen = calcularOrigenDeVentana({
      toque: { x: 350, y: 250, en: 9_000 },
      ahora: 1_000,
      caja: CAJA,
      reducirMovimiento: false,
    });

    expect(origen.escala).toBe(ESCALA_SIN_TOQUE);
  });
});
