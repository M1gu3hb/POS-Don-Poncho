import { describe, expect, it } from 'vitest';

import { progresoDePrimerosPasos, type EntradasDelProgreso } from './progreso-de-primeros-pasos.ts';

/** Un negocio con todo hecho: cada paso se apaga por separado en las pruebas. */
const COMPLETO: EntradasDelProgreso = {
  config: {
    nombre_negocio: 'Don Poncho',
    usa_mesas: true,
    unidades_medida_lista: 'kg, lt, pz',
  },
  usuarios: [{ id: 'u1' }],
  mesas: [{ id: 'm1' }],
  categorias: [{ id: 'c1' }],
  ingredientes: [{ id: 'i1' }],
  productos: [{ id: 'p1' }],
  hayCaja: true,
  cortes: [],
};

const con = (cambio: Partial<EntradasDelProgreso>): EntradasDelProgreso => ({
  ...COMPLETO,
  ...cambio,
});

describe('el progreso de «Primeros pasos»', () => {
  it('un negocio con todo hecho tiene los ocho pasos', () => {
    expect(progresoDePrimerosPasos(COMPLETO)).toEqual({
      negocio: true,
      usuarios: true,
      mesas: true,
      categorias: true,
      unidades: true,
      inventario: true,
      recetas: true,
      caja: true,
    });
  });

  it('el negocio cuenta como configurado sólo si ya no lleva un nombre por defecto', () => {
    const nombre = (nombre_negocio: string | null | undefined): boolean =>
      progresoDePrimerosPasos(con({ config: { ...COMPLETO.config, nombre_negocio } })).negocio;

    expect(nombre('MH Astral Systems')).toBe(false);
    expect(nombre('Mi negocio')).toBe(false);
    expect(nombre('   ')).toBe(false);
    expect(nombre(null)).toBe(false);
    expect(nombre('  Don Poncho  ')).toBe(true);
  });

  it('sin configuración todavía, el negocio y las unidades quedan pendientes', () => {
    const progreso = progresoDePrimerosPasos(con({ config: null }));

    expect(progreso.negocio).toBe(false);
    expect(progreso.unidades).toBe(false);
  });

  it('cada lista vacía —o que no es lista— deja su paso pendiente', () => {
    const vacio = progresoDePrimerosPasos(
      con({
        usuarios: [],
        mesas: [],
        categorias: undefined,
        ingredientes: [],
        productos: null,
      }),
    );

    expect(vacio.usuarios).toBe(false);
    expect(vacio.mesas).toBe(false);
    expect(vacio.categorias).toBe(false);
    expect(vacio.inventario).toBe(false);
    expect(vacio.recetas).toBe(false);
  });

  it('un negocio sin mesas (usa_mesas apagado) tiene ese paso hecho aunque no haya ninguna', () => {
    const sinMesas = con({ mesas: [], config: { ...COMPLETO.config, usa_mesas: false } });

    expect(progresoDePrimerosPasos(sinMesas).mesas).toBe(true);
    expect(progresoDePrimerosPasos(con({ mesas: [] })).mesas).toBe(false);
  });

  it('las unidades de medida cuentan si la lista trae algo más que espacios', () => {
    const unidades = (lista: string | null | undefined): boolean =>
      progresoDePrimerosPasos(con({ config: { ...COMPLETO.config, unidades_medida_lista: lista } }))
        .unidades;

    expect(unidades('kg')).toBe(true);
    expect(unidades('   ')).toBe(false);
    expect(unidades('')).toBe(false);
    expect(unidades(undefined)).toBe(false);
  });

  it('la caja está hecha si hay una abierta o si ya hubo algún corte', () => {
    expect(progresoDePrimerosPasos(con({ hayCaja: false, cortes: [] })).caja).toBe(false);
    expect(progresoDePrimerosPasos(con({ hayCaja: true, cortes: [] })).caja).toBe(true);
    expect(progresoDePrimerosPasos(con({ hayCaja: false, cortes: [{ id: 'k1' }] })).caja).toBe(
      true,
    );
    expect(progresoDePrimerosPasos(con({ hayCaja: false, cortes: undefined })).caja).toBe(false);
  });
});
