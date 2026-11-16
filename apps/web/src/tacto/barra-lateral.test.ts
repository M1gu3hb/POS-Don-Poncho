import { describe, expect, it, vi } from 'vitest';

import {
  CLAVE_DE_LA_BARRA,
  SECCIONES_PARA_EMPEZAR_PLEGADA,
  barraPlegada,
  guardarEleccion,
  leerEleccion,
  type AlmacenDeLaBarra,
} from './barra-lateral';

const almacen = (inicial: Record<string, string> = {}) => {
  const datos = new Map(Object.entries(inicial));
  const a: AlmacenDeLaBarra = {
    getItem: (clave) => datos.get(clave) ?? null,
    setItem: (clave, valor) => {
      datos.set(clave, valor);
    },
  };
  return { a, datos };
};

describe('si la barra empieza plegada cuando el aparato no ha elegido', () => {
  it('con una o dos secciones (mesero, cocina) empieza plegada: 240 px para «Mesas» no tienen caso', () => {
    expect(SECCIONES_PARA_EMPEZAR_PLEGADA).toBe(2);
    expect(barraPlegada({ eleccion: null, deModelo: false, secciones: 1 })).toBe(true);
    expect(barraPlegada({ eleccion: null, deModelo: false, secciones: 2 })).toBe(true);
  });

  it('con tres o más secciones empieza abierta', () => {
    expect(barraPlegada({ eleccion: null, deModelo: false, secciones: 3 })).toBe(false);
    expect(barraPlegada({ eleccion: null, deModelo: false, secciones: 12 })).toBe(false);
  });

  it('las pantallas de modelo siguen empezando plegadas, sean cuantas sean', () => {
    expect(barraPlegada({ eleccion: null, deModelo: true, secciones: 12 })).toBe(true);
  });

  it('lo que el aparato elige manda sobre la omisión, en los dos sentidos', () => {
    expect(barraPlegada({ eleccion: 'abierta', deModelo: false, secciones: 1 })).toBe(false);
    expect(barraPlegada({ eleccion: 'abierta', deModelo: true, secciones: 1 })).toBe(false);
    expect(barraPlegada({ eleccion: 'plegada', deModelo: false, secciones: 12 })).toBe(true);
  });
});

describe('la elección se recuerda en el aparato', () => {
  it('lo que se guarda se lee igual', () => {
    const { a } = almacen();
    guardarEleccion(a, 'plegada');
    expect(leerEleccion(a)).toBe('plegada');
    guardarEleccion(a, 'abierta');
    expect(leerEleccion(a)).toBe('abierta');
  });

  it('sin nada guardado, o con basura, no hay elección', () => {
    expect(leerEleccion(almacen().a)).toBeNull();
    expect(leerEleccion(almacen({ [CLAVE_DE_LA_BARRA]: 'quien-sabe' }).a)).toBeNull();
  });

  it('sin almacén (modo privado, datos bloqueados) no se cae: no hay elección', () => {
    expect(leerEleccion(null)).toBeNull();
    expect(() => {
      guardarEleccion(null, 'plegada');
    }).not.toThrow();
  });

  it('si leer o guardar LANZA (cuota, datos del sitio bloqueados) no se cae', () => {
    const roto: AlmacenDeLaBarra = {
      getItem: vi.fn(() => {
        throw new Error('bloqueado');
      }),
      setItem: vi.fn(() => {
        throw new Error('lleno');
      }),
    };
    expect(leerEleccion(roto)).toBeNull();
    expect(() => {
      guardarEleccion(roto, 'abierta');
    }).not.toThrow();
  });
});
