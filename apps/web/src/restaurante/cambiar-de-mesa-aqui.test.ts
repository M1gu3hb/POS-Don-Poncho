import { describe, expect, it } from 'vitest';

import {
  avisoDelCambio,
  destinosDelCambio,
  preguntaDelCambio,
  puedeUnirODividir,
} from './cambiar-de-mesa-aqui';
import type { MesaElegible } from './mesas-elegibles';

/**
 * DP-21 · Bloque 10 · CAMBIAR DE MESA, DE VERDAD (M24).
 *
 * Lo que vio Miguel: «Cambiar de mesa» sacaba al mesero del mapa a otra pantalla. Ahora el panel
 * de la mesa abre ahí mismo las mesas libres de SU zona, en botones grandes; al tocar una pregunta
 * «¿Pasar la cuenta de la mesa 3 a la mesa 7?», y al pasar avisa «La cuenta pasó a la mesa 7».
 */
const mesa = (
  numero: number,
  zona: string | null,
  otros: Partial<MesaElegible> = {},
): MesaElegible => ({
  id: `m${String(numero)}`,
  numero,
  estado: 'libre',
  zona,
  venta_activa_id: null,
  ...otros,
});

describe('destinosDelCambio', () => {
  const salon = [
    mesa(3, 'Interior', { estado: 'ocupada', venta_activa_id: 'v3' }),
    mesa(7, 'Interior'),
    mesa(1, 'Interior'),
    mesa(9, 'Terraza'),
    mesa(4, 'Interior', { estado: 'ocupada', venta_activa_id: 'v4' }),
    mesa(8, 'Terraza', { unida_a_mesa_id: 'm9' }),
    mesa(12, null),
  ];
  const propia = { id: 'm3', zona: 'Interior' };

  it('primero las mesas libres de SU zona, por número', () => {
    expect(destinosDelCambio(salon, propia).deLaZona.map((m) => m.numero)).toEqual([1, 7]);
  });

  it('las de otras zonas van aparte: «nos pasamos a la terraza» sigue pudiéndose', () => {
    expect(destinosDelCambio(salon, propia).deOtrasZonas.map((m) => m.numero)).toEqual([9, 12]);
  });

  it('nunca la propia, una ocupada, una con cuenta ni una absorbida en una unión', () => {
    const todas = destinosDelCambio(salon, propia);
    const numeros = [...todas.deLaZona, ...todas.deOtrasZonas].map((m) => m.numero);
    expect(numeros).not.toContain(3);
    expect(numeros).not.toContain(4);
    expect(numeros).not.toContain(8);
  });

  it('una mesa sin zona busca entre las que tampoco la tienen', () => {
    const sinZona = destinosDelCambio(salon, { id: 'm3', zona: null });
    expect(sinZona.deLaZona.map((m) => m.numero)).toEqual([12]);
    expect(
      destinosDelCambio(salon, { id: 'm3', zona: '  ' }).deLaZona.map((m) => m.numero),
    ).toEqual([12]);
  });

  it('la zona no distingue mayúsculas ni espacios de más', () => {
    expect(
      destinosDelCambio(salon, { id: 'm3', zona: ' interior ' }).deLaZona.map((m) => m.numero),
    ).toEqual([1, 7]);
  });
});

describe('lo que dice', () => {
  it('pregunta antes de pasar, con las dos mesas', () => {
    expect(preguntaDelCambio(3, 7)).toBe('¿Pasar la cuenta de la mesa 3 a la mesa 7?');
  });

  it('y avisa a dónde pasó', () => {
    expect(avisoDelCambio(7)).toBe('La cuenta pasó a la mesa 7');
  });
});

describe('puedeUnirODividir', () => {
  it('el enlace «Unir o dividir la cuenta» es de dirección: al mesero «Mesa activa» no se lo da', () => {
    expect(puedeUnirODividir('dueno')).toBe(true);
    expect(puedeUnirODividir('administrador')).toBe(true);
    expect(puedeUnirODividir('gerente')).toBe(true);
    expect(puedeUnirODividir('mesero')).toBe(false);
    expect(puedeUnirODividir('cajero')).toBe(false);
    expect(puedeUnirODividir(null)).toBe(false);
  });
});
