import { describe, expect, it } from 'vitest';

import { estadoDelFlujo, huecosDeFlujos, resumenDeFlujos } from './flujos.mjs';

const conPrueba = { id: 'a.uno', pruebas: ['x.spec.ts'], pruebasQueFaltan: [] };
const sinPrueba = { id: 'a.dos', pruebas: [], pruebasQueFaltan: [] };
const noAplica = {
  id: 'a.tres',
  pruebas: [],
  pruebasQueFaltan: [],
  estado: 'no aplica',
  razon: 'La función no existe en la app.',
};

describe('flujos del mapa · «no aplica» declarado', () => {
  it('un flujo no aplicable no cuenta como «sin prueba», se cuenta aparte', () => {
    const resumen = resumenDeFlujos([conPrueba, sinPrueba, noAplica]);
    expect(resumen).toEqual({ total: 3, sinPrueba: 1, noAplica: 1 });
  });

  it('el estado de un flujo no aplicable lleva su razón a la vista', () => {
    expect(estadoDelFlujo(noAplica)).toBe('no aplica: La función no existe en la app.');
    expect(estadoDelFlujo(sinPrueba)).toBe('sin prueba');
    expect(estadoDelFlujo(conPrueba)).toBe('con prueba, por recorrer con el arnés');
  });

  it('«no aplica» sin razón es un hueco', () => {
    const huecos = huecosDeFlujos([{ ...noAplica, razon: '  ' }]);
    expect(huecos).toHaveLength(1);
    expect(huecos[0]).toContain('a.tres');
  });

  it('«no aplica» con pruebas enlazadas es un hueco (o aplica o no)', () => {
    const huecos = huecosDeFlujos([{ ...noAplica, pruebas: ['x.spec.ts'] }]);
    expect(huecos).toHaveLength(1);
  });

  it('un estado desconocido es un hueco', () => {
    expect(huecosDeFlujos([{ ...conPrueba, estado: 'luego' }])).toHaveLength(1);
  });

  it('sigue marcando la prueba citada que no existe', () => {
    const huecos = huecosDeFlujos([{ ...conPrueba, pruebasQueFaltan: ['no-existe.ts'] }]);
    expect(huecos).toHaveLength(1);
    expect(huecos[0]).toContain('no-existe.ts');
  });

  it('un flujo sano no da huecos', () => {
    expect(huecosDeFlujos([conPrueba, sinPrueba, noAplica])).toEqual([]);
  });
});
