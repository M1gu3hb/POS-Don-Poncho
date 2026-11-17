import { describe, expect, it } from 'vitest';

import {
  avisoDelRelevo,
  entradaDelRelevo,
  meserosParaPasar,
  preguntaDelRelevo,
  puedePasarLaMesa,
} from './pasar-la-mesa.ts';

/**
 * DP-D156 · «Pasar la mesa a otro mesero»: lo que decide la pantalla, sin pantalla.
 *
 * Quién lo ve es lo que el comando deja (`relevo.ts`: gerente, administrador, dueño y cajero; con los
 * nombres de la sesión, `administrador` y `caja`). El servidor es el que manda: esto sólo evita
 * ofrecer un botón que terminaría en «tu rol no puede hacer eso».
 */

const USUARIOS = [
  { id: 'ana', nombre: 'Ana', rol: 'mesero', activo: true },
  { id: 'beto', nombre: 'Beto', rol: 'mesero', activo: true },
  { id: 'carla', nombre: 'carla', rol: 'mesero', activo: true },
  { id: 'dora', nombre: 'Dora', rol: 'mesero', activo: false },
  { id: 'enzo', nombre: 'Enzo', rol: 'cajero', activo: true },
  { id: 'fer', nombre: 'Fer', rol: 'cocina', activo: true },
  { id: 'gus', nombre: 'Gus', rol: 'gerente', activo: true },
];

describe('quién ve «Pasar la mesa a otro mesero»', () => {
  it.each(['administrador', 'caja'])('%s, cuando la mesa tiene mesero', (rol) => {
    expect(puedePasarLaMesa(rol, 'ana')).toBe(true);
  });

  it.each(['mesero', 'cocina', 'almacen', null])('%s, nunca', (rol) => {
    expect(puedePasarLaMesa(rol, 'ana')).toBe(false);
  });

  it('sin saber quién atiende la mesa no se ofrece: no hay a quién relevar', () => {
    expect(puedePasarLaMesa('administrador', null)).toBe(false);
    expect(puedePasarLaMesa('administrador', undefined)).toBe(false);
    expect(puedePasarLaMesa('administrador', '')).toBe(false);
  });
});

describe('a quién se le puede pasar', () => {
  it('sólo meseros activos, sin el que ya la atiende, por nombre', () => {
    const elegibles = meserosParaPasar(USUARIOS, 'ana');
    expect(elegibles.map((m) => m.id)).toEqual(['beto', 'carla']);
  });

  it('no ofrece a un dado de baja, a la caja ni a la cocina', () => {
    const ids = meserosParaPasar(USUARIOS, null).map((m) => m.id);
    expect(ids).not.toContain('dora');
    expect(ids).not.toContain('enzo');
    expect(ids).not.toContain('fer');
    expect(ids).not.toContain('gus');
  });

  it('una lista vacía no rompe', () => {
    expect(meserosParaPasar([], 'ana')).toEqual([]);
  });
});

describe('lo que se pregunta, se manda y se avisa', () => {
  it('la pregunta nombra la mesa, a quien se va y a quien entra', () => {
    expect(preguntaDelRelevo({ mesa: 4, sale: 'Ana', entra: 'Beto' })).toBe(
      '¿Pasar la mesa 4 de Ana a Beto?',
    );
  });

  it('sin saber el nombre de quien la atiende, no inventa uno', () => {
    expect(preguntaDelRelevo({ mesa: 4, sale: null, entra: 'Beto' })).toBe(
      '¿Pasar la mesa 4 a Beto?',
    );
  });

  it('el aviso confirma a quién quedó', () => {
    expect(avisoDelRelevo({ mesa: 4, entra: 'Beto' })).toBe('La mesa 4 quedó con Beto');
  });

  it('el comando va con ESTA cuenta, el que se va y el que entra', () => {
    expect(entradaDelRelevo({ ordenId: 'o1', saleId: 'ana', entraId: 'beto' })).toEqual({
      ordenId: 'o1',
      empleadoSaleId: 'ana',
      empleadoEntraId: 'beto',
    });
  });
});
