import { describe, expect, it } from 'vitest';

import {
  clasificarLasQueSeAgregan,
  type GrupoAlQueSeAgrega,
  type MesaPorAgregar,
} from './reglas-de-agregar.ts';

/**
 * DP-24 · P5 — las reglas de «Agregar mesas», sin base de datos: qué mesa pedida es suelta, cuál
 * es principal de otro grupo y cuáles se rechazan (con su mensaje).
 */

const GRUPO: GrupoAlQueSeAgrega = { principalId: 'p', sucursalId: 's1' };

function mesa(id: string, numero: number, resto: Partial<MesaPorAgregar> = {}): MesaPorAgregar {
  return {
    id,
    numero,
    estado: 'libre',
    sucursalId: 's1',
    unidaA: null,
    encabezaUnionId: null,
    ...resto,
  };
}

const rechazoDe = (pedidas: string[], mesas: MesaPorAgregar[]) =>
  clasificarLasQueSeAgregan(GRUPO, pedidas, mesas).rechazo;

describe('qué se agrega', () => {
  it('las mesas sueltas entran en el orden pedido', () => {
    const r = clasificarLasQueSeAgregan(GRUPO, ['c', 'b'], [mesa('b', 2), mesa('c', 3)]);
    expect(r.rechazo).toBeNull();
    expect(r.agrega).toEqual({ sueltas: ['c', 'b'], principalesDeOtros: [] });
  });

  it('la principal de otro grupo se separa de las sueltas, con su unión', () => {
    const r = clasificarLasQueSeAgregan(
      GRUPO,
      ['d', 'b'],
      [mesa('b', 2), mesa('d', 4, { encabezaUnionId: 'u2' })],
    );
    expect(r.agrega).toEqual({
      sueltas: ['b'],
      principalesDeOtros: [{ mesaId: 'd', unionId: 'u2' }],
    });
  });
});

describe('qué se rechaza', () => {
  it('una mesa que ya está en ESTE grupo', () => {
    const r = rechazoDe(['b'], [mesa('b', 2, { unidaA: { id: 'p', numero: 1 } })]);
    expect(r).toEqual({ codigo: 'MESA_YA_ABIERTA', mensaje: 'La mesa 2 ya está en este grupo.' });
  });

  it('la principal del grupo no se agrega a sí misma', () => {
    expect(rechazoDe(['p'], [mesa('p', 1)])?.mensaje).toMatch(/principal de este grupo/);
  });

  it('una mesa absorbida en OTRO grupo: dice cuál agregar', () => {
    const r = rechazoDe(['e'], [mesa('e', 5, { unidaA: { id: 'd', numero: 4 } })]);
    expect(r?.codigo).toBe('MESA_YA_ABIERTA');
    expect(r?.mensaje).toBe('La mesa 5 está unida a la 4: agrega la 4, que encabeza ese grupo.');
  });

  it('una mesa de otra sucursal', () => {
    const r = rechazoDe(['x'], [mesa('x', 9, { sucursalId: 's2' })]);
    expect(r).toMatchObject({ codigo: 'MESA_NO_ENCONTRADA' });
    expect(r?.mensaje).toMatch(/otra sucursal/);
  });

  it('una mesa en limpieza se dice con su nombre', () => {
    const r = rechazoDe(['b'], [mesa('b', 2, { estado: 'limpieza' })]);
    expect(r).toMatchObject({ codigo: 'UNION_DE_MESAS_INVALIDA' });
    expect(r?.mensaje).toBe('La mesa 2 está en limpieza: márcala libre primero.');
  });

  it('una mesa repetida', () => {
    expect(rechazoDe(['b', 'b'], [mesa('b', 2)])?.mensaje).toMatch(/repetida/);
  });

  it('una mesa que no existe', () => {
    expect(rechazoDe(['zzz'], [mesa('b', 2)])?.codigo).toBe('MESA_NO_ENCONTRADA');
  });

  it('un solo rechazo basta aunque las demás sirvan', () => {
    const r = clasificarLasQueSeAgregan(
      GRUPO,
      ['b', 'c'],
      [mesa('b', 2), mesa('c', 3, { estado: 'limpieza' })],
    );
    expect(r.agrega).toBeNull();
    expect(r.rechazo?.mensaje).toMatch(/mesa 3/);
  });
});
