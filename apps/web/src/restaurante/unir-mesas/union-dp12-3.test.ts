import { describe, expect, it } from 'vitest';

import { cajaDeLaUnion, conGente, enLimpieza, type MesaDelPlanoDeUnion } from './plano-de-union';
import { adondeVa } from './use-arrastre-de-mesas';

/** DP-12.3 · Lo puro de «Unir mesas» en la pantalla. */

const mesa = (
  parte: Partial<MesaDelPlanoDeUnion> & { id: string; numero: number },
): MesaDelPlanoDeUnion => ({
  posicion_x: 100,
  posicion_y: 100,
  forma: 'redonda',
  tamano: 'mediana',
  unida_a_mesa_id: null,
  estado: 'libre',
  venta_activa_id: null,
  ...parte,
});

describe('la mesa sigue al dedo 1:1', () => {
  const inicio = { px: 200, py: 300, x0: 50, y0: 60 };

  it('se mueve lo mismo que el dedo, dividido entre la escala del plano', () => {
    expect(adondeVa(inicio, { x: 230, y: 290 }, 1, { ancho: 900, alto: 500 })).toEqual({
      x: 80,
      y: 50,
    });
    expect(adondeVa(inicio, { x: 230, y: 290 }, 0.5, { ancho: 900, alto: 500 })).toEqual({
      x: 110,
      y: 40,
    });
  });

  it('no se sale del plano', () => {
    expect(adondeVa(inicio, { x: -500, y: 2000 }, 1, { ancho: 900, alto: 500 })).toEqual({
      x: 0,
      y: 500,
    });
  });
});

describe('la unión en el mapa (DP-12.3)', () => {
  it('la principal con sus absorbidas se pinta fundida: dos redondas lado a lado, una cápsula', () => {
    const principal = mesa({ id: 'a', numero: 4 });
    const unida = mesa({ id: 'b', numero: 5, posicion_x: 180, unida_a_mesa_id: 'a' });
    expect(cajaDeLaUnion(principal, [principal, unida])).toMatchObject({
      x: 100,
      ancho: 160,
      alto: 80,
      figura: 'capsula-horizontal',
    });
    expect(cajaDeLaUnion(unida, [principal, unida])).toBeNull();
  });

  it('dice qué mesa del grupo está en limpieza y cuáles tienen gente', () => {
    const mesas = [
      mesa({ id: 'a', numero: 1, estado: 'pedido_enviado', venta_activa_id: 'v1' }),
      mesa({ id: 'b', numero: 2, estado: 'limpieza' }),
      mesa({ id: 'c', numero: 3 }),
    ];
    expect(enLimpieza(['a', 'b'], mesas)?.numero).toBe(2);
    expect(enLimpieza(['a', 'c'], mesas)).toBeNull();
    expect(conGente(['a', 'b', 'c'], mesas).map((m) => m.numero)).toEqual([1]);
  });
});
