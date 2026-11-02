import { describe, expect, it } from 'vitest';

import {
  nombreDistintivoDeLaMesa,
  rotuloDeLaMesa,
  sufijoDelNombreDeLaMesa,
} from './nombre-de-la-mesa.ts';

/**
 * DP-12.6 · «Mesa 2 · Mesa 2».
 *
 * Los datos guardan `nombre: "Mesa N"` (el alta de una mesa se lo pone) y la pantalla antepone
 * «Mesa {numero} · {nombre}». El nombre sólo se agrega cuando DICE ALGO MÁS: «Terraza», «Barra».
 */

describe('el nombre que distingue a una mesa', () => {
  it('«Mesa 2» en la mesa 2 no dice nada que el número no diga', () => {
    expect(nombreDistintivoDeLaMesa({ numero: 2, nombre: 'Mesa 2' })).toBe('');
  });

  it('el nombre vacío, en blanco o ausente tampoco', () => {
    expect(nombreDistintivoDeLaMesa({ numero: 2, nombre: '' })).toBe('');
    expect(nombreDistintivoDeLaMesa({ numero: 2, nombre: '   ' })).toBe('');
    expect(nombreDistintivoDeLaMesa({ numero: 2, nombre: null })).toBe('');
    expect(nombreDistintivoDeLaMesa({ numero: 2 })).toBe('');
    expect(nombreDistintivoDeLaMesa(null)).toBe('');
    expect(nombreDistintivoDeLaMesa(undefined)).toBe('');
  });

  it('se compara sin mayúsculas y sin espacios de más', () => {
    expect(nombreDistintivoDeLaMesa({ numero: 12, nombre: '  mesa   12 ' })).toBe('');
    expect(nombreDistintivoDeLaMesa({ numero: 12, nombre: 'MESA 12' })).toBe('');
  });

  it('el número solo o con # tampoco aporta', () => {
    expect(nombreDistintivoDeLaMesa({ numero: 7, nombre: '7' })).toBe('');
    expect(nombreDistintivoDeLaMesa({ numero: 7, nombre: '#7' })).toBe('');
  });

  it('un número que llega como texto se compara igual', () => {
    expect(nombreDistintivoDeLaMesa({ numero: '2', nombre: 'Mesa 2' })).toBe('');
  });

  it('«Mesa 2» en OTRA mesa SÍ se conserva: el dato está mal, pero no se esconde', () => {
    expect(nombreDistintivoDeLaMesa({ numero: 3, nombre: 'Mesa 2' })).toBe('Mesa 2');
  });

  it('«Mesa 12» no se confunde con la mesa 1 ni con la 2', () => {
    expect(nombreDistintivoDeLaMesa({ numero: 1, nombre: 'Mesa 12' })).toBe('Mesa 12');
    expect(nombreDistintivoDeLaMesa({ numero: 2, nombre: 'Mesa 12' })).toBe('Mesa 12');
  });

  it('un nombre de verdad se devuelve recortado', () => {
    expect(nombreDistintivoDeLaMesa({ numero: 2, nombre: ' Terraza ' })).toBe('Terraza');
    expect(nombreDistintivoDeLaMesa({ numero: 2, nombre: 'Mesa 2 de la terraza' })).toBe(
      'Mesa 2 de la terraza',
    );
  });

  it('sin número no hay con qué comparar: el nombre se conserva', () => {
    expect(nombreDistintivoDeLaMesa({ nombre: 'Barra' })).toBe('Barra');
  });
});

describe('el sufijo del nombre', () => {
  it('lleva el punto medio cuando hay algo que decir', () => {
    expect(sufijoDelNombreDeLaMesa({ numero: 2, nombre: 'Terraza' })).toBe(' · Terraza');
  });

  it('es vacío cuando el nombre repite', () => {
    expect(sufijoDelNombreDeLaMesa({ numero: 2, nombre: 'Mesa 2' })).toBe('');
    expect(sufijoDelNombreDeLaMesa(null)).toBe('');
  });
});

describe('el rótulo completo de la mesa', () => {
  it('«Mesa 2» a secas cuando el nombre repite', () => {
    expect(rotuloDeLaMesa({ numero: 2, nombre: 'Mesa 2' })).toBe('Mesa 2');
  });

  it('«Mesa 2 · Terraza» cuando el nombre aporta', () => {
    expect(rotuloDeLaMesa({ numero: 2, nombre: 'Terraza' })).toBe('Mesa 2 · Terraza');
  });

  it('la palabra puede ser otra', () => {
    expect(rotuloDeLaMesa({ numero: 2, nombre: 'Terraza' }, 'Mesita')).toBe('Mesita 2 · Terraza');
  });

  it('sin número lleva el guion largo, como las pantallas', () => {
    expect(rotuloDeLaMesa({ nombre: '' })).toBe('Mesa —');
  });
});
