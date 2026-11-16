import { describe, expect, it } from 'vitest';

import { fraseDeLaComandaDelTelefono } from './frase-del-telefono';
import type { ComandaDelTelefono } from './pantalla-del-telefono';

/** DP-21 · Bloque 8 · lo que dice «Repetir voz» en el teléfono de cocina. */

type Platillo = ComandaDelTelefono['platillos'][number];

const platillo = (extra: Partial<Platillo> = {}): Platillo => ({
  nombre: 'Consomé de carnero',
  cantidad: '1.0000',
  porPeso: false,
  unidadVariable: null,
  cantidadVariable: null,
  notas: null,
  opciones: [],
  ...extra,
});

const comanda = (platillos: readonly Platillo[]): ComandaDelTelefono => ({
  id: 'c1',
  estado: 'nuevo',
  mesaNumero: 4,
  nombrePedido: null,
  creadaEn: '2026-11-15T12:00:00.000Z',
  notas: null,
  alergias: null,
  celebracion: false,
  tipoCelebracion: null,
  platillos,
});

describe('«Repetir voz» del teléfono de cocina', () => {
  it('tres renglones iguales: una sola frase con «tres»', () => {
    const frase = fraseDeLaComandaDelTelefono(comanda([platillo(), platillo(), platillo()]));
    expect(frase).toBe('Nuevo pedido mesa 4: tres Consomés de carnero.');
  });

  it('la cantidad «3.0000» del servidor se dice «tres», con su otro platillo', () => {
    const frase = fraseDeLaComandaDelTelefono(
      comanda([
        platillo({ cantidad: '3.0000' }),
        platillo({ nombre: 'Mixiote', cantidad: '2.0000' }),
      ]),
    );
    expect(frase).toBe('Nuevo pedido mesa 4: tres Consomés de carnero, dos Mixiotes.');
  });

  it('lo que va por peso dice su peso; las opciones se dicen sin su grupo', () => {
    const frase = fraseDeLaComandaDelTelefono(
      comanda([
        platillo({
          nombre: 'Barbacoa de horno',
          cantidad: '0.5000',
          porPeso: true,
          unidadVariable: 'kg',
          cantidadVariable: '0.5000',
        }),
        platillo({
          opciones: [{ grupo: 'Tamaño', nombres: ['Grande'] }],
          notas: 'Tamaño: Grande · sin cebolla',
        }),
      ]),
    );
    expect(frase).toBe(
      'Nuevo pedido mesa 4: medio kilo de Barbacoa de horno; Consomé de carnero, Grande, sin cebolla.',
    );
  });
});
