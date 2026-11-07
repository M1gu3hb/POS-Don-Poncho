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
  opciones: [
    { id: 'o-queso', nombre: 'Queso' },
    { id: 'o-flor', nombre: 'Flor de calabaza' },
  ],
};
const EXTRAS: GrupoDeOpciones = {
  id: 'g-extras',
  nombre: 'Extras',
  obligatorio: false,
  tipo: 'multiple',
  opciones: [
    { id: 'o-crema', nombre: 'Crema' },
    { id: 'o-salsa', nombre: 'Salsa, verde' },
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
      { grupoId: 'g-relleno', grupo: 'Relleno', opcionId: 'o-flor', opcion: 'Flor de calabaza' },
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
        { grupoId: 'g1', grupo: 'Relleno', opcionId: 'a', opcion: 'Queso' },
        { grupoId: 'g2', grupo: 'Extras', opcionId: 'b', opcion: 'Crema' },
        { grupoId: 'g2', grupo: 'Extras', opcionId: 'c', opcion: 'Salsa' },
      ]),
    ).toBe('Relleno: Queso · Extras: Crema, Salsa');
  });
});
