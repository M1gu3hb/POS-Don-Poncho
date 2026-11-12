import { describe, expect, it } from 'vitest';

import {
  loPeorDelGrupo,
  opcionesQueDejanSinPrecio,
  type GrupoParaRevisar,
} from './opciones-sin-precio.ts';

const op = (nombre: string, delta: bigint, activa = true) => ({
  nombre,
  deltaCentavos: delta,
  activa,
});
const unica = (opciones: GrupoParaRevisar['opciones'], obligatorio = true): GrupoParaRevisar => ({
  nombre: 'Proteína',
  tipo: 'unica',
  obligatorio,
  minimo: null,
  maximo: null,
  opciones,
});
const varias = (
  opciones: GrupoParaRevisar['opciones'],
  minimo: number | null,
  maximo: number | null,
): GrupoParaRevisar => ({
  nombre: 'Extras',
  tipo: 'multiple',
  obligatorio: false,
  minimo,
  maximo,
  opciones,
});

describe('DP-18 · M6 · una opción que resta no deja el platillo en $0 o menos', () => {
  it('lo peor de un grupo: la más barata si es obligatoria; si es opcional, sólo si resta', () => {
    expect(loPeorDelGrupo(unica([op('Res', 1_000n), op('Pollo', 500n)]))).toBe(500n);
    expect(loPeorDelGrupo(unica([op('Res', 1_000n)], false))).toBe(0n);
    expect(loPeorDelGrupo(unica([op('Sin carne', -1_500n), op('Res', 0n)], false))).toBe(-1_500n);
    expect(loPeorDelGrupo(unica([op('Sin carne', -1_500n, false), op('Res', 0n)]))).toBe(0n);
  });

  it('en «varias»: las que más restan hasta el máximo, y el mínimo obliga a elegir aunque sumen', () => {
    const g = [
      op('Sin crema', -500n),
      op('Sin queso', -700n),
      op('Sin salsa', -300n),
      op('Aguacate', 2_000n),
    ];
    expect(loPeorDelGrupo(varias(g, null, 2))).toBe(-1_200n);
    expect(loPeorDelGrupo(varias(g, null, null))).toBe(-1_500n);
    expect(loPeorDelGrupo(varias([op('Queso', 1_500n), op('Crema', 800n)], 1, 2))).toBe(800n);
  });

  it('se rechaza cuando lo que restan las opciones llega al precio del platillo', () => {
    const taco = { nombre: 'Taco', precioMinimoCentavos: 2_500n };
    expect(
      opcionesQueDejanSinPrecio(taco, [unica([op('Sin carne', -2_500n), op('Res', 0n)])]),
    ).toMatch(/«Taco» podría quedar en \$0\.00/);
    expect(
      opcionesQueDejanSinPrecio(taco, [
        varias([op('Sin todo', -2_000n), op('Sin tortilla', -1_000n)], null, null),
      ]),
    ).toMatch(/−\$5\.00/);
  });

  it('se deja cuando nunca baja de un centavo, o cuando ninguna opción resta', () => {
    const taco = { nombre: 'Taco', precioMinimoCentavos: 2_500n };
    expect(
      opcionesQueDejanSinPrecio(taco, [unica([op('Sin cebolla', -2_499n), op('Res', 0n)])]),
    ).toBeNull();
    expect(
      opcionesQueDejanSinPrecio({ nombre: 'Cortesía', precioMinimoCentavos: 0n }, [
        unica([op('Res', 0n)]),
      ]),
    ).toBeNull();
    expect(opcionesQueDejanSinPrecio(taco, [])).toBeNull();
  });
});
