import { describe, expect, it } from 'vitest';

import { opcionesParaElComando, tieneGruposParaOfrecer } from './opciones-en-pos';

describe('opcionesParaElComando', () => {
  it('manda sólo los ids y deja fuera el grupo sin elección', () => {
    expect(
      opcionesParaElComando({
        modificadores: [
          { grupo_id: 'g1', opciones: [{ id: 'a' }, { id: 'b' }] },
          { grupo_id: 'g2', opciones: [] },
        ],
      }),
    ).toEqual([{ grupoId: 'g1', opcionIds: ['a', 'b'] }]);
  });
  it('sin diálogo no hay elección', () => {
    expect(opcionesParaElComando(undefined)).toEqual([]);
  });
});

describe('tieneGruposParaOfrecer', () => {
  it('sólo cuenta grupos y opciones activos', () => {
    expect(tieneGruposParaOfrecer({ modificadores: [] })).toBe(false);
    expect(
      tieneGruposParaOfrecer({
        modificadores: [{ nombre: 'Salsa', activo: false, opciones: [{ nombre: 'Verde' }] }],
      }),
    ).toBe(false);
    expect(
      tieneGruposParaOfrecer({
        modificadores: [{ nombre: 'Salsa', opciones: [{ nombre: 'Verde' }] }],
      }),
    ).toBe(true);
  });
});
