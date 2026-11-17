import { describe, expect, it } from 'vitest';

import { valuarInventario, type ArticuloParaValuar } from './valuacion.ts';

/**
 * F-108 · Cuánto dinero hay dormido, y desde cuándo.
 *
 * Las dos preguntas van juntas a propósito. «Cuánto vale mi inventario» es
 * contabilidad; «cuánto llevo dormido y desde cuándo» es la decisión de
 * rematar, que es la que el ferretero no puede tomar hoy.
 */

const AHORA = new Date('2026-09-15T12:00:00.000Z');
const HACE_UN_ANO = new Date('2025-09-15T12:00:00.000Z');
const ANTEAYER = new Date('2026-09-13T12:00:00.000Z');

function articulo(cambios: Partial<ArticuloParaValuar> = {}): ArticuloParaValuar {
  return {
    insumoId: 'i1',
    existencia: '10.0000',
    costoPromedioCentavos: 1200n,
    ultimoMovimiento: ANTEAYER,
    ...cambios,
  };
}

describe('F-108 · valuación por promedio', () => {
  it('multiplica existencia por costo promedio y suma', () => {
    const valuacion = valuarInventario(
      [
        articulo({ insumoId: 'i1', existencia: '10.0000', costoPromedioCentavos: 1200n }),
        articulo({ insumoId: 'i2', existencia: '3.5000', costoPromedioCentavos: 800n }),
      ],
      { metodo: 'promedio', ahora: AHORA },
    );

    expect(valuacion.valorCentavos).toBe(12_000n + 2800n);
    expect(valuacion.articulos).toBe(2);
  });

  it('redondea al centavo más cercano, no hacia abajo', () => {
    // 0.5 unidades a 5 centavos = 2.5 centavos.
    const valuacion = valuarInventario(
      [articulo({ existencia: '0.5000', costoPromedioCentavos: 5n })],
      { metodo: 'promedio', ahora: AHORA },
    );

    expect(valuacion.valorCentavos).toBe(3n);
  });

  it('una existencia NEGATIVA cuenta como cero, no resta del total', () => {
    const valuacion = valuarInventario(
      [
        articulo({ insumoId: 'i1', existencia: '10.0000' }),
        articulo({ insumoId: 'i2', existencia: '-4.0000', costoPromedioCentavos: 900n }),
      ],
      { metodo: 'promedio', ahora: AHORA },
    );

    // Valuarla en negativo haría que el almacén valiera menos de lo que hay en
    // el estante. El renglón se queda visible, con cantidad cero.
    expect(valuacion.valorCentavos).toBe(12_000n);
    expect(valuacion.lineas[1]?.cantidad).toBe('0.0000');
    expect(valuacion.articulos).toBe(2);
  });
});

describe('DP-D165 · valuación con el costo EXACTO', () => {
  it('la leche (2.4 ¢/ml) con 20 L vale $480.00: multiplica con el exacto, no con los 2 ¢ mostrados', () => {
    const valuacion = valuarInventario(
      [
        articulo({
          existencia: '20000.0000',
          costoPromedioCentavos: 2n,
          costoExactoDmc: 24_000n,
        }),
      ],
      { metodo: 'promedio', ahora: AHORA },
    );

    expect(valuacion.valorCentavos).toBe(48_000n);
    // El costo de centavos de la línea sigue siendo el exacto redondeado, para mostrarlo.
    expect(valuacion.lineas[0]?.costoUnitarioCentavos).toBe(2n);
    expect(valuacion.lineas[0]?.costoExactoDmc).toBe(24_000n);
  });

  it('redondea UNA sola vez, al final: 3 ml a 2.4 ¢ son 7.2 ¢ → 7, no 3 × 2 = 6', () => {
    const valuacion = valuarInventario(
      [articulo({ existencia: '3.0000', costoPromedioCentavos: 2n, costoExactoDmc: 24_000n })],
      { metodo: 'promedio', ahora: AHORA },
    );

    expect(valuacion.valorCentavos).toBe(7n);
  });

  it('sin costo exacto parte del de centavos × 10 000: lo que ese costo siempre valió', () => {
    const valuacion = valuarInventario(
      [articulo({ existencia: '10.0000', costoPromedioCentavos: 1200n })],
      { metodo: 'promedio', ahora: AHORA },
    );

    expect(valuacion.valorCentavos).toBe(12_000n);
    expect(valuacion.lineas[0]?.costoExactoDmc).toBe(12_000_000n);
  });

  it('una existencia en negativo vale cero también con el costo exacto (DP-D146)', () => {
    const valuacion = valuarInventario(
      [articulo({ existencia: '-500.0000', costoPromedioCentavos: 2n, costoExactoDmc: 24_000n })],
      { metodo: 'promedio', ahora: AHORA },
    );

    expect(valuacion.valorCentavos).toBe(0n);
  });

  it('PEPS: suma cantidad × costo exacto de cada capa y redondea UNA vez sobre la suma', () => {
    const valuacion = valuarInventario(
      [
        articulo({
          existencia: '3.0000',
          costoPromedioCentavos: 2n,
          costoExactoDmc: 24_000n,
          capas: [
            {
              cantidad: '1.0000',
              costoUnitarioCentavos: 2n,
              costoExactoDmc: 24_000n,
              cuando: HACE_UN_ANO,
            },
            {
              cantidad: '1.0000',
              costoUnitarioCentavos: 2n,
              costoExactoDmc: 24_000n,
              cuando: HACE_UN_ANO,
            },
            {
              cantidad: '1.0000',
              costoUnitarioCentavos: 2n,
              costoExactoDmc: 24_000n,
              cuando: ANTEAYER,
            },
          ],
        }),
      ],
      { metodo: 'peps', ahora: AHORA },
    );

    // 3 × 2.4 ¢ = 7.2 ¢ → 7 (por capa y redondeando cada una serían 2 + 2 + 2 = 6).
    expect(valuacion.valorCentavos).toBe(7n);
    expect(valuacion.lineas[0]?.costoExactoDmc).toBe(24_000n);
  });
});

describe('F-108 · lo que lleva dormido', () => {
  it('separa el valor de lo que no se mueve, con el umbral del giro', () => {
    const valuacion = valuarInventario(
      [
        articulo({ insumoId: 'i1', ultimoMovimiento: ANTEAYER }),
        articulo({ insumoId: 'i2', ultimoMovimiento: HACE_UN_ANO, costoPromedioCentavos: 900n }),
      ],
      { metodo: 'promedio', ahora: AHORA, umbralDias: 180 },
    );

    expect(valuacion.valorCentavos).toBe(12_000n + 9000n);
    // Sólo el segundo lleva un año parado: ése es el dinero dormido.
    expect(valuacion.valorDormidoCentavos).toBe(9000n);
  });

  it('un artículo que nunca se movió no cuenta como dormido: cuenta como sin datos', () => {
    const valuacion = valuarInventario([articulo({ ultimoMovimiento: null })], {
      metodo: 'promedio',
      ahora: AHORA,
    });

    expect(valuacion.lineas[0]?.diasSinMovimiento).toBeNull();
    expect(valuacion.valorDormidoCentavos).toBe(0n);
  });

  it('rechaza un último movimiento en el futuro en vez de dar días negativos', () => {
    expect(() =>
      valuarInventario([articulo({ ultimoMovimiento: new Date('2027-01-01T00:00:00.000Z') })], {
        metodo: 'promedio',
        ahora: AHORA,
      }),
    ).toThrow();
  });
});

describe('F-108 · valuación PEPS', () => {
  it('valúa con las capas MÁS NUEVAS, que son las que quedan en el estante', () => {
    const valuacion = valuarInventario(
      [
        articulo({
          existencia: '10.0000',
          costoPromedioCentavos: 1000n,
          capas: [
            { cantidad: '20.0000', costoUnitarioCentavos: 800n, cuando: HACE_UN_ANO },
            { cantidad: '10.0000', costoUnitarioCentavos: 1500n, cuando: ANTEAYER },
          ],
        }),
      ],
      { metodo: 'peps', ahora: AHORA },
    );

    // «Primeras entradas, primeras salidas» significa que lo VIEJO ya salió.
    // Valuar con la capa de $8.00 subvaluaría el inventario en $70.
    expect(valuacion.lineas[0]?.costoUnitarioCentavos).toBe(1500n);
    expect(valuacion.valorCentavos).toBe(15_000n);
  });

  it('cuando la existencia cruza dos capas, promedia sólo las que la cubren', () => {
    const valuacion = valuarInventario(
      [
        articulo({
          existencia: '15.0000',
          costoPromedioCentavos: 1000n,
          capas: [
            { cantidad: '20.0000', costoUnitarioCentavos: 800n, cuando: HACE_UN_ANO },
            { cantidad: '10.0000', costoUnitarioCentavos: 1500n, cuando: ANTEAYER },
          ],
        }),
      ],
      { metodo: 'peps', ahora: AHORA },
    );

    // 10 a 1500 + 5 a 800 = 19 000 / 15 = 1266.67 → 1267 centavos.
    expect(valuacion.lineas[0]?.costoUnitarioCentavos).toBe(1267n);
  });

  it('completa con el promedio cuando el histórico no llega tan atrás', () => {
    const valuacion = valuarInventario(
      [
        articulo({
          existencia: '10.0000',
          costoPromedioCentavos: 1000n,
          capas: [{ cantidad: '4.0000', costoUnitarioCentavos: 1500n, cuando: ANTEAYER }],
        }),
      ],
      { metodo: 'peps', ahora: AHORA },
    );

    // 4 a 1500 + 6 a 1000 = 12 000 / 10 = 1200. Negarse a valuar sería negarse
    // a contestar la pregunta, y un almacén sin histórico completo es lo normal
    // el primer año.
    expect(valuacion.lineas[0]?.costoUnitarioCentavos).toBe(1200n);
  });

  it('sin capas, PEPS cae al promedio en vez de valuar en cero', () => {
    const valuacion = valuarInventario([articulo({ capas: [] })], {
      metodo: 'peps',
      ahora: AHORA,
    });

    expect(valuacion.lineas[0]?.costoUnitarioCentavos).toBe(1200n);
  });
});
