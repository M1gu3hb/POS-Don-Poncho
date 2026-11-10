import { describe, expect, it } from 'vitest';

import {
  avisoDelGrupo,
  elegidasConPrecio,
  faltaEnElGrupo,
  puedeElegirOtra,
  totalDeLaLinea,
  type GrupoParaElegir,
} from './eleccion-de-opciones';

const termino: GrupoParaElegir = {
  nombre: 'Término',
  tipo: 'unica',
  obligatorio: true,
  minimo: null,
  maximo: null,
  opciones: [
    { id: 't1', nombre: 'Medio' },
    { id: 't2', nombre: 'Bien cocido' },
  ],
};

const extras: GrupoParaElegir = {
  nombre: 'Extras',
  tipo: 'multiple',
  obligatorio: false,
  minimo: null,
  maximo: 2,
  opciones: [
    { id: 'e1', nombre: 'Queso', precioCentavos: '1500' },
    { id: 'e2', nombre: 'Aguacate', precioCentavos: '2000' },
    { id: 'e3', nombre: 'Sin crema', precioCentavos: '-500' },
  ],
};

const salsas: GrupoParaElegir = {
  nombre: 'Salsas',
  tipo: 'multiple',
  obligatorio: true,
  minimo: 2,
  maximo: null,
  opciones: [
    { id: 's1', nombre: 'Verde' },
    { id: 's2', nombre: 'Roja' },
    { id: 's3', nombre: 'Habanero' },
  ],
};

describe('faltaEnElGrupo (DP-16 · el portal valida como el mesero)', () => {
  it('un grupo obligatorio sin nada elegido pide una', () => {
    expect(faltaEnElGrupo(termino, new Set())).toBe('Elige una opción en Término');
    expect(faltaEnElGrupo(termino, new Set(['t1']))).toBeNull();
  });

  it('un grupo de varias con mínimo pide las que faltan', () => {
    expect(faltaEnElGrupo(salsas, new Set(['s1']))).toBe('Elige al menos 2 en Salsas');
    expect(faltaEnElGrupo(salsas, new Set(['s1', 's2']))).toBeNull();
  });

  it('un grupo opcional se puede dejar vacío aunque tenga máximo', () => {
    expect(faltaEnElGrupo(extras, new Set())).toBeNull();
  });

  it('un grupo opcional con mínimo se puede saltar, pero si se empieza cuenta su mínimo', () => {
    const salsasOpcionales = { ...salsas, obligatorio: false };
    expect(faltaEnElGrupo(salsasOpcionales, new Set())).toBeNull();
    expect(faltaEnElGrupo(salsasOpcionales, new Set(['s1']))).toBe('Elige al menos 2 en Salsas');
  });

  it('un mínimo mayor que las opciones no deja el grupo imposible', () => {
    const dos = { ...salsas, minimo: 5 };
    expect(faltaEnElGrupo(dos, new Set(['s1', 's2', 's3']))).toBeNull();
  });
});

describe('puedeElegirOtra', () => {
  it('en un grupo de varias con máximo, al llegar al tope ya no entra otra', () => {
    expect(puedeElegirOtra(extras, new Set(['e1']))).toBe(true);
    expect(puedeElegirOtra(extras, new Set(['e1', 'e2']))).toBe(false);
  });

  it('sin máximo, o en uno de una sola, siempre se puede tocar', () => {
    expect(puedeElegirOtra(salsas, new Set(['s1', 's2', 's3']))).toBe(true);
    expect(puedeElegirOtra(termino, new Set(['t1']))).toBe(true);
  });
});

describe('avisoDelGrupo', () => {
  it('dice cuántas se eligen', () => {
    expect(avisoDelGrupo(termino)).toBe('Obligatorio');
    expect(avisoDelGrupo(extras)).toBe('Opcional · hasta 2');
    expect(avisoDelGrupo(salsas)).toBe('Obligatorio · al menos 2');
    expect(avisoDelGrupo({ ...salsas, maximo: 3 })).toBe('Obligatorio · de 2 a 3');
  });
});

describe('elegidasConPrecio y totalDeLaLinea', () => {
  it('lo elegido viaja por grupo, con su precio, en el orden del grupo', () => {
    const elegidas = elegidasConPrecio([termino, extras], {
      Término: new Set(['t2']),
      Extras: new Set(['e3', 'e1']),
    });
    expect(elegidas).toEqual([
      {
        grupo_nombre: 'Término',
        tipo: 'unica',
        opciones: [{ id: 't2', nombre: 'Bien cocido', precioCentavos: '0' }],
      },
      {
        grupo_nombre: 'Extras',
        tipo: 'multiple',
        opciones: [
          { id: 'e1', nombre: 'Queso', precioCentavos: '1500' },
          { id: 'e3', nombre: 'Sin crema', precioCentavos: '-500' },
        ],
      },
    ]);
  });

  it('en una pieza la opción va por unidad; en lo que va por peso, una vez por renglón', () => {
    const elegidas = elegidasConPrecio([extras], { Extras: new Set(['e1']) });
    // 2 tacos de $35 con queso (+$15): 2 × $50.
    expect(totalDeLaLinea({ precio: 35, cantidad: 2, elegidas })).toBe(100);
    // ½ kg de barbacoa ($210) con queso: $225, no $217.50.
    expect(totalDeLaLinea({ precio: 0, cantidad: 1, elegidas, precioPorPeso: 210 })).toBe(225);
  });

  it('nunca baja de cero', () => {
    const elegidas = elegidasConPrecio([extras], { Extras: new Set(['e3']) });
    expect(totalDeLaLinea({ precio: 3, cantidad: 1, elegidas })).toBe(0);
  });
});
