import { ErrorDominio } from '@morphiqpos/contracts';
import { describe, expect, it } from 'vitest';

import {
  elegirLasOpciones,
  textoDeLasOpciones,
  type GrupoDeOpciones,
} from './opciones-de-la-linea.ts';

/**
 * DP-14.6-3 · Las opciones de una línea, decididas por el SERVIDOR: si el platillo trae un grupo
 * obligatorio sin su elección no se escribe, sea cual sea la pantalla que lo mandó.
 */

const RELLENO: GrupoDeOpciones = {
  id: 'g-relleno',
  nombre: 'Relleno',
  obligatorio: true,
  tipo: 'unica',
  minimo: null,
  maximo: null,
  opciones: [
    { id: 'o-queso', nombre: 'Queso', deltaCentavos: 0n },
    { id: 'o-flor', nombre: 'Flor de calabaza', deltaCentavos: 1_500n },
  ],
};
const EXTRAS: GrupoDeOpciones = {
  id: 'g-extras',
  nombre: 'Extras',
  obligatorio: false,
  tipo: 'multiple',
  minimo: null,
  maximo: null,
  opciones: [
    { id: 'o-crema', nombre: 'Crema', deltaCentavos: -500n },
    { id: 'o-salsa', nombre: 'Salsa, verde', deltaCentavos: 0n },
  ],
};

function codigoDe(f: () => unknown): string | undefined {
  try {
    f();
  } catch (e) {
    return e instanceof ErrorDominio ? e.codigo : 'OTRO';
  }
  return undefined;
}

describe('elegirLasOpciones · lo estructurado', () => {
  it('acepta la elección del grupo obligatorio y la devuelve con sus nombres', () => {
    const r = elegirLasOpciones(
      'Quesadilla',
      [RELLENO, EXTRAS],
      [{ grupoId: 'g-relleno', opcionIds: ['o-flor'] }],
      '',
    );
    expect(r).toEqual([
      {
        grupoId: 'g-relleno',
        grupo: 'Relleno',
        opcionId: 'o-flor',
        opcion: 'Flor de calabaza',
        deltaCentavos: 1_500n,
      },
    ]);
  });

  it('rechaza el grupo obligatorio SIN elección con OPCION_OBLIGATORIA', () => {
    expect(codigoDe(() => elegirLasOpciones('Quesadilla', [RELLENO], [], ''))).toBe(
      'OPCION_OBLIGATORIA',
    );
    expect(
      codigoDe(() =>
        elegirLasOpciones('Quesadilla', [RELLENO], [{ grupoId: 'g-relleno', opcionIds: [] }], ''),
      ),
    ).toBe('OPCION_OBLIGATORIA');
  });

  it('un grupo opcional puede quedar sin elegir', () => {
    expect(elegirLasOpciones('Taco', [EXTRAS], [], '')).toEqual([]);
  });

  it('rechaza una opción que no es del platillo o un grupo ajeno (OPCION_NO_VALIDA)', () => {
    expect(
      codigoDe(() =>
        elegirLasOpciones('Q', [RELLENO], [{ grupoId: 'g-relleno', opcionIds: ['o-otra'] }], ''),
      ),
    ).toBe('OPCION_NO_VALIDA');
    expect(
      codigoDe(() =>
        elegirLasOpciones('Q', [RELLENO], [{ grupoId: 'g-ajeno', opcionIds: ['o-queso'] }], ''),
      ),
    ).toBe('OPCION_NO_VALIDA');
  });

  it('un grupo de elección única no admite dos opciones, ni una repetida', () => {
    expect(
      codigoDe(() =>
        elegirLasOpciones(
          'Q',
          [RELLENO],
          [{ grupoId: 'g-relleno', opcionIds: ['o-queso', 'o-flor'] }],
          '',
        ),
      ),
    ).toBe('OPCION_NO_VALIDA');
    expect(
      codigoDe(() =>
        elegirLasOpciones(
          'T',
          [EXTRAS],
          [{ grupoId: 'g-extras', opcionIds: ['o-crema', 'o-crema'] }],
          '',
        ),
      ),
    ).toBe('OPCION_NO_VALIDA');
  });

  it('lo estructurado manda sobre lo que diga la nota', () => {
    const r = elegirLasOpciones(
      'Q',
      [RELLENO],
      [{ grupoId: 'g-relleno', opcionIds: ['o-queso'] }],
      'Relleno: Flor de calabaza',
    );
    expect(r.map((o) => o.opcionId)).toEqual(['o-queso']);
  });
});

describe('elegirLasOpciones · el respaldo de la nota (clientes que sólo mandan texto)', () => {
  it('lee «Grupo: opción» de la nota que arman el mesero y el portal', () => {
    const r = elegirLasOpciones(
      'Q',
      [RELLENO, EXTRAS],
      undefined,
      'Relleno: Flor de calabaza · Extras: Crema, Salsa, verde · sin cebolla',
    );
    expect(r.map((o) => o.opcionId)).toEqual(['o-flor', 'o-crema', 'o-salsa']);
  });

  it('la nota que no dice el grupo obligatorio se rechaza', () => {
    expect(codigoDe(() => elegirLasOpciones('Q', [RELLENO], undefined, 'sin cebolla'))).toBe(
      'OPCION_OBLIGATORIA',
    );
    expect(codigoDe(() => elegirLasOpciones('Q', [RELLENO], undefined, 'Relleno: Pollo'))).toBe(
      'OPCION_OBLIGATORIA',
    );
  });

  it('el grupo viene después de la nota propia con el separador del portal', () => {
    const r = elegirLasOpciones('Q', [RELLENO], undefined, 'poco picante — Relleno: Queso');
    expect(r.map((o) => o.opcionId)).toEqual(['o-queso']);
  });

  it('un platillo sin grupos no pide nada', () => {
    expect(elegirLasOpciones('Refresco', [], undefined, '')).toEqual([]);
  });
});

describe('textoDeLasOpciones', () => {
  it('junta por grupo, como se lee en la comanda', () => {
    expect(
      textoDeLasOpciones([
        { grupoId: 'g1', grupo: 'Relleno', opcionId: 'a', opcion: 'Queso', deltaCentavos: 0n },
        { grupoId: 'g2', grupo: 'Extras', opcionId: 'b', opcion: 'Crema', deltaCentavos: 0n },
        { grupoId: 'g2', grupo: 'Extras', opcionId: 'c', opcion: 'Salsa', deltaCentavos: 0n },
      ]),
    ).toBe('Relleno: Queso · Extras: Crema, Salsa');
  });
});

describe('DP-16 · el precio de cada opción y el mínimo y máximo de un grupo', () => {
  const SALSAS: GrupoDeOpciones = {
    id: 'g-salsas',
    nombre: 'Salsas',
    obligatorio: false,
    tipo: 'multiple',
    minimo: 2,
    maximo: 3,
    opciones: ['a', 'b', 'c', 'd'].map((id) => ({ id, nombre: id, deltaCentavos: 0n })),
  };

  it('cada elegida lleva el precio que dice el catálogo', () => {
    const elegidas = elegirLasOpciones(
      'Quesadilla',
      [RELLENO, EXTRAS],
      [
        { grupoId: 'g-relleno', opcionIds: ['o-flor'] },
        { grupoId: 'g-extras', opcionIds: ['o-crema'] },
      ],
      '',
    );
    expect(elegidas.map((o) => o.deltaCentavos)).toEqual([1_500n, -500n]);
  });

  it('más del máximo no entra', () => {
    expect(
      codigoDe(() =>
        elegirLasOpciones(
          'Tacos',
          [SALSAS],
          [{ grupoId: 'g-salsas', opcionIds: ['a', 'b', 'c', 'd'] }],
          '',
        ),
      ),
    ).toBe('OPCION_NO_VALIDA');
  });

  it('menos del mínimo no entra si se eligió algo; nada en un grupo no obligatorio sí', () => {
    expect(
      codigoDe(() =>
        elegirLasOpciones('Tacos', [SALSAS], [{ grupoId: 'g-salsas', opcionIds: ['a'] }], ''),
      ),
    ).toBe('OPCION_OBLIGATORIA');
    expect(elegirLasOpciones('Tacos', [SALSAS], [], '')).toEqual([]);
    expect(
      elegirLasOpciones('Tacos', [SALSAS], [{ grupoId: 'g-salsas', opcionIds: ['a', 'b'] }], ''),
    ).toHaveLength(2);
  });

  it('obligatorio con mínimo: hay que llegar al mínimo', () => {
    const obligatorio = { ...SALSAS, obligatorio: true };
    expect(codigoDe(() => elegirLasOpciones('Tacos', [obligatorio], [], ''))).toBe(
      'OPCION_OBLIGATORIA',
    );
  });
});
