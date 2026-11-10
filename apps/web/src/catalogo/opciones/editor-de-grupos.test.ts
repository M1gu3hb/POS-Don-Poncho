import { describe, expect, it } from 'vitest';

import {
  cambiosDelGrupo,
  entradaDeAsignar,
  entradaDeGuardar,
  etiquetaDePrecio,
  grupoDesdeLectura,
  grupoNuevo,
  moverAbajo,
  moverArriba,
  opcionNueva,
  precioAPesos,
  precioDesdeCentavos,
  precioEsValido,
  productosQueLoUsan,
  validarGrupo,
  type GrupoDeLectura,
  type GrupoEditable,
} from './editor-de-grupos.ts';

const LECTURA: GrupoDeLectura = {
  id: 'g1',
  nombre: 'Término',
  tipo: 'unica',
  obligatorio: true,
  minimo: null,
  maximo: null,
  activo: true,
  opciones: [
    { id: 'o1', nombre: 'Medio', precioCentavos: '0', activa: true },
    { id: 'o2', nombre: 'Bien cocido', precioCentavos: '1250', activa: true },
    { id: 'o3', nombre: 'Sin sal', precioCentavos: '-500', activa: false },
  ],
  productoIds: ['p1', 'p2', 'p3'],
};

function grupo(cambios: Partial<GrupoEditable> = {}): GrupoEditable {
  return {
    ...grupoNuevo(),
    nombre: 'Extras',
    opciones: [
      { ...opcionNueva(), nombre: 'Queso', precio: '15' },
      { ...opcionNueva(), nombre: 'Tocino', precio: '' },
    ],
    ...cambios,
  };
}

describe('precioEsValido', () => {
  it.each(['', '0', '15', '-5', '12.50', '12.5', '-0.5', '1234567'])('acepta «%s»', (texto) => {
    expect(precioEsValido(texto)).toBe(true);
  });
  it.each(['abc', '1.234', '12.', '.5', '--5', '+5', '12345678', '1,5', '$5'])(
    'rechaza «%s»',
    (texto) => {
      expect(precioEsValido(texto)).toBe(false);
    },
  );
  it('ignora espacios en los extremos', () => {
    expect(precioEsValido(' 15 ')).toBe(true);
  });
});

describe('precioDesdeCentavos', () => {
  it('convierte centavos con signo a pesos', () => {
    expect(precioDesdeCentavos('0')).toBe('');
    expect(precioDesdeCentavos('1500')).toBe('15');
    expect(precioDesdeCentavos('1250')).toBe('12.50');
    expect(precioDesdeCentavos('-500')).toBe('-5');
    expect(precioDesdeCentavos('-5')).toBe('-0.05');
    expect(precioDesdeCentavos('5')).toBe('0.05');
  });
});

describe('precioAPesos', () => {
  it('vacío y cero son «0»; el resto se conserva con su signo', () => {
    expect(precioAPesos('')).toBe('0');
    expect(precioAPesos('  ')).toBe('0');
    expect(precioAPesos('0')).toBe('0');
    expect(precioAPesos('-0')).toBe('0');
    expect(precioAPesos('0.00')).toBe('0');
    expect(precioAPesos('15')).toBe('15');
    expect(precioAPesos(' -5 ')).toBe('-5');
    expect(precioAPesos('12.50')).toBe('12.50');
  });
});

describe('etiquetaDePrecio', () => {
  it('dice el costo con su signo y sus centavos', () => {
    expect(etiquetaDePrecio('')).toBe('sin costo');
    expect(etiquetaDePrecio('0')).toBe('sin costo');
    expect(etiquetaDePrecio('15')).toBe('+$15.00');
    expect(etiquetaDePrecio('-5')).toBe('−$5.00');
    expect(etiquetaDePrecio('12.5')).toBe('+$12.50');
    expect(etiquetaDePrecio('1234567')).toBe('+$1,234,567.00');
  });
  it('un precio inválido no tiene etiqueta', () => {
    expect(etiquetaDePrecio('abc')).toBe('');
  });
});

describe('grupoDesdeLectura', () => {
  it('trae el grupo con precios en pesos y las opciones tal cual', () => {
    const g = grupoDesdeLectura(LECTURA);
    expect(g.id).toBe('g1');
    expect(g.minimo).toBe('');
    expect(g.maximo).toBe('');
    expect(g.opciones.map((o) => o.precio)).toEqual(['', '12.50', '-5']);
    expect(g.opciones.map((o) => o.activa)).toEqual([true, true, false]);
    expect(g.opciones.map((o) => o.id)).toEqual(['o1', 'o2', 'o3']);
  });
  it('conserva mínimo y máximo de un grupo «varias»', () => {
    const g = grupoDesdeLectura({ ...LECTURA, tipo: 'multiple', minimo: 1, maximo: 2 });
    expect(g.minimo).toBe('1');
    expect(g.maximo).toBe('2');
  });
});

describe('validarGrupo', () => {
  it('un grupo correcto no tiene errores', () => {
    expect(validarGrupo(grupo())).toEqual([]);
  });
  it('pide nombre', () => {
    expect(validarGrupo(grupo({ nombre: '   ' }))).toContain('Ponle nombre al grupo.');
  });
  it('pide al menos una opción', () => {
    expect(validarGrupo(grupo({ opciones: [] }))).toContain('Agrega al menos una opción.');
  });
  it('pide nombre en cada opción', () => {
    const g = grupo({ opciones: [{ ...opcionNueva(), nombre: ' ', precio: '' }] });
    expect(validarGrupo(g).join(' ')).toContain('opción sin nombre');
  });
  it('rechaza opciones repetidas sin importar mayúsculas ni espacios', () => {
    const g = grupo({
      opciones: [
        { ...opcionNueva(), nombre: 'Queso', precio: '' },
        { ...opcionNueva(), nombre: ' queso ', precio: '' },
      ],
    });
    expect(validarGrupo(g).join(' ')).toContain('repetida');
  });
  it('rechaza un precio con formato inválido', () => {
    const g = grupo({ opciones: [{ ...opcionNueva(), nombre: 'Queso', precio: '1.234' }] });
    expect(validarGrupo(g).join(' ')).toContain('precio');
  });
  it('mínimo mayor que máximo es error; igual es válido', () => {
    expect(validarGrupo(grupo({ tipo: 'multiple', minimo: '3', maximo: '2' })).join(' ')).toContain(
      'mínimo',
    );
    expect(validarGrupo(grupo({ tipo: 'multiple', minimo: '2', maximo: '2' }))).toEqual([]);
  });
  it('mínimo y máximo deben ser enteros', () => {
    expect(validarGrupo(grupo({ tipo: 'multiple', minimo: '1.5' })).length).toBeGreaterThan(0);
    expect(validarGrupo(grupo({ tipo: 'multiple', maximo: '-1' })).length).toBeGreaterThan(0);
    expect(validarGrupo(grupo({ tipo: 'multiple', maximo: '0' })).length).toBeGreaterThan(0);
  });
  it('el mínimo no puede pasar de las opciones activas', () => {
    const g = grupo({
      tipo: 'multiple',
      minimo: '2',
      opciones: [
        { ...opcionNueva(), nombre: 'A', precio: '' },
        { ...opcionNueva(), nombre: 'B', precio: '', activa: false },
      ],
    });
    expect(validarGrupo(g).join(' ')).toContain('activas');
  });
  it('en «una» se ignoran mínimo y máximo', () => {
    expect(validarGrupo(grupo({ tipo: 'unica', minimo: '9', maximo: '1' }))).toEqual([]);
  });
});

describe('entradaDeGuardar', () => {
  it('arma la entrada con precios en pesos y sin límites para «una»', () => {
    const entrada = entradaDeGuardar(grupoDesdeLectura(LECTURA));
    expect(entrada).toEqual({
      grupoId: 'g1',
      nombre: 'Término',
      tipo: 'unica',
      obligatorio: true,
      minimo: null,
      maximo: null,
      activo: true,
      opciones: [
        { id: 'o1', nombre: 'Medio', precio: '0', activa: true },
        { id: 'o2', nombre: 'Bien cocido', precio: '12.50', activa: true },
        { id: 'o3', nombre: 'Sin sal', precio: '-5', activa: false },
      ],
    });
  });
  it('un grupo nuevo no manda grupoId ni id de opción', () => {
    const entrada = entradaDeGuardar(grupo());
    expect('grupoId' in entrada).toBe(false);
    expect(entrada.opciones.every((o) => !('id' in o))).toBe(true);
    expect(entrada.opciones.map((o) => o.precio)).toEqual(['15', '0']);
  });
  it('«varias» manda mínimo y máximo como números, o null si están vacíos', () => {
    const a = entradaDeGuardar(grupo({ tipo: 'multiple', minimo: '1', maximo: '3' }));
    expect(a.minimo).toBe(1);
    expect(a.maximo).toBe(3);
    const b = entradaDeGuardar(grupo({ tipo: 'multiple', minimo: '', maximo: '' }));
    expect(b.minimo).toBeNull();
    expect(b.maximo).toBeNull();
  });
  it('«una» descarta el mínimo y el máximo aunque estén escritos', () => {
    const a = entradaDeGuardar(grupo({ tipo: 'unica', minimo: '1', maximo: '3' }));
    expect(a.minimo).toBeNull();
    expect(a.maximo).toBeNull();
  });
  it('recorta los espacios de los nombres', () => {
    const a = entradaDeGuardar(grupo({ nombre: '  Extras  ' }));
    expect(a.nombre).toBe('Extras');
    expect(a.opciones[0]?.nombre).toBe('Queso');
  });
});

describe('cambiosDelGrupo', () => {
  it('un grupo sin tocar no cambió; uno nuevo siempre se guarda', () => {
    const original = grupoDesdeLectura(LECTURA);
    expect(cambiosDelGrupo(original, original)).toBe(false);
    expect(cambiosDelGrupo(grupo(), undefined)).toBe(true);
  });
  it('detecta un precio, un nombre o el orden de las opciones', () => {
    const original = grupoDesdeLectura(LECTURA);
    const precio = {
      ...original,
      opciones: original.opciones.map((o, i) => (i === 0 ? { ...o, precio: '5' } : o)),
    };
    expect(cambiosDelGrupo(precio, original)).toBe(true);
    expect(cambiosDelGrupo({ ...original, nombre: 'Otro' }, original)).toBe(true);
    expect(
      cambiosDelGrupo({ ...original, opciones: moverAbajo(original.opciones, 0) }, original),
    ).toBe(true);
    expect(cambiosDelGrupo({ ...original, activo: false }, original)).toBe(true);
  });
});

describe('entradaDeAsignar', () => {
  it('manda los grupos en el orden dado', () => {
    expect(entradaDeAsignar('p9', ['b', 'a', 'c'])).toEqual({
      productoId: 'p9',
      grupoIds: ['b', 'a', 'c'],
    });
  });
});

describe('productosQueLoUsan', () => {
  it('cuenta los otros productos, sin contar el que se edita', () => {
    expect(productosQueLoUsan(LECTURA.productoIds, 'p1')).toBe(2);
    expect(productosQueLoUsan(LECTURA.productoIds, 'p9')).toBe(3);
    expect(productosQueLoUsan([], 'p1')).toBe(0);
  });
});

describe('mover', () => {
  it('sube y baja un lugar sin mutar la lista', () => {
    const lista = ['a', 'b', 'c'];
    expect(moverArriba(lista, 1)).toEqual(['b', 'a', 'c']);
    expect(moverAbajo(lista, 1)).toEqual(['a', 'c', 'b']);
    expect(lista).toEqual(['a', 'b', 'c']);
  });
  it('en los extremos no hace nada', () => {
    const lista = ['a', 'b', 'c'];
    expect(moverArriba(lista, 0)).toEqual(lista);
    expect(moverAbajo(lista, 2)).toEqual(lista);
    expect(moverAbajo(lista, 9)).toEqual(lista);
    expect(moverArriba(lista, -1)).toEqual(lista);
  });
});
