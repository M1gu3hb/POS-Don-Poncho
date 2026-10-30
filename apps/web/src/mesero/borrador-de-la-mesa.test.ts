import { describe, expect, it } from 'vitest';

import {
  conCantidadCambiada,
  conExclusionesDeLinea,
  conLineaPersonalizada,
  conLineaVariable,
  conNotasDeLinea,
  conProducto,
  filtrarPlatillos,
  productoTieneModificadores,
  totalDelCarritoEnCentavos,
  unidadesDelCarrito,
  type ProductoDelMenu,
} from './borrador-de-la-mesa';

/**
 * EL BORRADOR DE LA MESA, SIN PANTALLA.
 *
 * Es lo que el mesero va armando antes de «Enviar a Cocina». Vivía dentro del componente `Mesero`,
 * así que cada toque a un platillo re-dibujaba el mapa y los 107 botones; aquí es lógica pura: la
 * misma que tenía `Mesero.jsx` (cada caso de abajo es una línea de ese archivo, con su ejemplo),
 * pero que se puede ver fallar. Ninguna función toca lo que recibe: devuelven una lista nueva.
 */

const arrachera: ProductoDelMenu = {
  id: 'p-arrachera',
  nombre: 'Arrachera al carbón',
  categoria_id: 'c-carnes',
  precio_venta: 329,
  area_preparacion: 'cocina',
};
const limonada: ProductoDelMenu = {
  id: 'p-limonada',
  nombre: 'Limonada',
  categoria_id: 'c-bebidas',
  precio_venta: 45.5,
  area_preparacion: 'barra',
};

describe('agregar un platillo (el toque directo)', () => {
  it('la primera vez crea la línea con cantidad 1 y sus campos vacíos', () => {
    const carrito = conProducto([], arrachera);
    expect(carrito).toEqual([
      {
        ...arrachera,
        cantidad: 1,
        notas: '',
        _notaUsuario: '',
        _exclusiones: [],
        _modificadores: [],
      },
    ]);
  });

  it('la segunda vez del mismo platillo sube la cantidad y no abre otra línea', () => {
    const carrito = conProducto(conProducto([], arrachera), arrachera);
    expect(carrito).toHaveLength(1);
    expect(carrito[0]?.cantidad).toBe(2);
  });

  it('otro platillo va aparte y los demás no cambian de objeto', () => {
    const antes = conProducto([], arrachera);
    const despues = conProducto(antes, limonada);
    expect(despues).toHaveLength(2);
    expect(despues[0]).toBe(antes[0]);
  });

  it('no muta la lista que recibe', () => {
    const antes = conProducto([], arrachera);
    const copia = structuredClone(antes);
    conProducto(antes, arrachera);
    expect(antes).toEqual(copia);
  });
});

describe('la cantidad de una línea', () => {
  const dos = conProducto(conProducto(conProducto([], arrachera), arrachera), limonada);

  it('+1 sube y −1 baja', () => {
    expect(conCantidadCambiada(dos, 'p-arrachera', 1)[0]?.cantidad).toBe(3);
    expect(conCantidadCambiada(dos, 'p-arrachera', -1)[0]?.cantidad).toBe(1);
  });

  it('al llegar a cero la línea sale del borrador', () => {
    const sin = conCantidadCambiada(dos, 'p-limonada', -1);
    expect(sin.map((l) => l.id)).toEqual(['p-arrachera']);
  });

  it('un id que no está deja todo igual', () => {
    expect(conCantidadCambiada(dos, 'no-existe', 1)).toEqual(dos);
  });
});

describe('un platillo que se vende por kilo o por porción', () => {
  const snapshot = {
    tipo_venta: 'variable_medida',
    cantidad_variable: 350,
    unidad_variable: 'g',
    precio_total_linea: 122.5,
  };

  it('es una línea de cantidad 1 cuyo precio es el total ya calculado, con su snapshot', () => {
    const [linea] = conLineaVariable([], arrachera, snapshot);
    expect(linea).toMatchObject({
      id: 'p-arrachera',
      cantidad: 1,
      precio_venta: 122.5,
      _variable: snapshot,
      notas: '',
    });
  });

  it('cada vez es una línea propia: 350 g y 200 g no se agrupan', () => {
    const dos = conLineaVariable(conLineaVariable([], arrachera, snapshot), arrachera, {
      ...snapshot,
      cantidad_variable: 200,
      precio_total_linea: 70,
    });
    expect(dos).toHaveLength(2);
  });

  it('un total que no es número vale cero y no rompe la cuenta', () => {
    const carrito = conLineaVariable([], arrachera, { ...snapshot, precio_total_linea: 'x' });
    expect(carrito[0]?.precio_venta).toBe(0);
    expect(totalDelCarritoEnCentavos(carrito)).toBe(0);
  });
});

describe('un platillo con opciones elegidas', () => {
  const termino = {
    grupo_nombre: 'Término',
    opciones: [{ nombre: 'Medio' }, { nombre: 'Bien cocido' }],
  };
  const vacio = { grupo_nombre: 'Salsa', opciones: [] };

  it('la nota lleva el texto de las opciones y luego la nota libre, con " · "', () => {
    const [linea] = conLineaPersonalizada([], arrachera, {
      modificadores: [termino, vacio],
      notas: '  sin picante ',
    });
    expect(linea?.notas).toBe('Término: Medio, Bien cocido · sin picante');
    expect(linea?._notaUsuario).toBe('sin picante');
    expect(linea?._modificadores).toEqual([termino, vacio]);
  });

  it('sin opciones ni nota queda vacía', () => {
    const [linea] = conLineaPersonalizada([], arrachera, { modificadores: [], notas: undefined });
    expect(linea?.notas).toBe('');
  });

  it('no se agrupa con otra línea del mismo platillo', () => {
    const base = conProducto([], arrachera);
    const dos = conLineaPersonalizada(base, arrachera, { modificadores: [termino], notas: '' });
    expect(dos).toHaveLength(2);
  });
});

describe('notas y exclusiones de una línea', () => {
  const base = conProducto(conProducto([], arrachera), limonada);

  it('las notas cambian sólo esa línea', () => {
    const despues = conNotasDeLinea(base, 'p-limonada', 'Sin hielo');
    expect(despues[1]).toMatchObject({ notas: 'Sin hielo', _notaUsuario: 'Sin hielo' });
    expect(despues[0]).toBe(base[0]);
  });

  it('borrar la nota deja la nota final vacía y conserva lo que el usuario había escrito', () => {
    const escrita = conNotasDeLinea(base, 'p-limonada', 'Sin hielo');
    const borrada = conNotasDeLinea(escrita, 'p-limonada', '');
    expect(borrada[1]).toMatchObject({ notas: '', _notaUsuario: 'Sin hielo' });
  });

  it('las exclusiones son la lista que llega; algo que no es lista, vacío', () => {
    expect(conExclusionesDeLinea(base, 'p-arrachera', ['cebolla'])[0]?._exclusiones).toEqual([
      'cebolla',
    ]);
    expect(
      conExclusionesDeLinea(base, 'p-arrachera', 'cebolla' as unknown as string[])[0]?._exclusiones,
    ).toEqual([]);
  });
});

describe('lo que suma el borrador', () => {
  it('el total va en centavos enteros: 3 × $329.00 + $45.50 = $1,032.50', () => {
    let carrito = conProducto([], limonada);
    for (let i = 0; i < 3; i += 1) carrito = conProducto(carrito, arrachera);
    expect(totalDelCarritoEnCentavos(carrito)).toBe(3 * 32900 + 4550);
    expect(unidadesDelCarrito(carrito)).toBe(4);
  });

  it('con centavos que en coma flotante no cuadran (0.1 + 0.2) sigue siendo exacto', () => {
    const a: ProductoDelMenu = { id: 'a', precio_venta: 0.1 };
    const b: ProductoDelMenu = { id: 'b', precio_venta: 0.2 };
    expect(totalDelCarritoEnCentavos(conProducto(conProducto([], a), b))).toBe(30);
  });

  it('un borrador vacío suma cero', () => {
    expect(totalDelCarritoEnCentavos([])).toBe(0);
    expect(unidadesDelCarrito([])).toBe(0);
  });
});

describe('buscar y filtrar el catálogo', () => {
  const menu: readonly ProductoDelMenu[] = [
    arrachera,
    limonada,
    { id: 'p-sin-nombre', categoria_id: 'c-carnes' },
    { id: 'p-tacos', nombre: 'Tacos de ARRACHERA', categoria_id: 'c-tacos' },
  ];

  it('«todas» y sin búsqueda deja todo, y devuelve la misma lista', () => {
    expect(filtrarPlatillos(menu, 'todas', '')).toBe(menu);
  });

  it('por categoría', () => {
    expect(filtrarPlatillos(menu, 'c-carnes', '').map((p) => p.id)).toEqual([
      'p-arrachera',
      'p-sin-nombre',
    ]);
  });

  it('la búsqueda no distingue mayúsculas y encuentra en medio del nombre', () => {
    // Minúsculas contra nombres con mayúsculas, y mayúsculas contra nombres en minúsculas.
    expect(filtrarPlatillos(menu, 'todas', 'arrachera').map((p) => p.id)).toEqual([
      'p-arrachera',
      'p-tacos',
    ]);
    expect(filtrarPlatillos(menu, 'todas', 'LIMON').map((p) => p.id)).toEqual(['p-limonada']);
  });

  it('categoría y búsqueda a la vez', () => {
    expect(filtrarPlatillos(menu, 'c-tacos', 'arra').map((p) => p.id)).toEqual(['p-tacos']);
  });

  it('un platillo sin nombre no rompe la búsqueda ni aparece', () => {
    expect(filtrarPlatillos(menu, 'todas', 'x')).toEqual([]);
  });
});

describe('¿el platillo pide elegir opciones?', () => {
  const conOpciones: ProductoDelMenu = {
    id: 'x',
    modificadores: [{ nombre: 'Término', opciones: [{ nombre: 'Medio' }] }],
  };

  it('sí, con un grupo con nombre y una opción con nombre', () => {
    expect(productoTieneModificadores(conOpciones)).toBe(true);
  });

  it('no, si el grupo está apagado, sin nombre o sin opciones activas', () => {
    expect(productoTieneModificadores({ id: 'x', modificadores: [] })).toBe(false);
    expect(
      productoTieneModificadores({
        id: 'x',
        modificadores: [{ nombre: 'T', activo: false, opciones: [{ nombre: 'M' }] }],
      }),
    ).toBe(false);
    expect(
      productoTieneModificadores({
        id: 'x',
        modificadores: [{ nombre: ' ', opciones: [{ nombre: 'M' }] }],
      }),
    ).toBe(false);
    expect(
      productoTieneModificadores({
        id: 'x',
        modificadores: [{ nombre: 'T', opciones: [{ nombre: 'M', activo: false }] }],
      }),
    ).toBe(false);
  });

  it('no, si modificadores no es una lista', () => {
    expect(productoTieneModificadores({ id: 'x', modificadores: 'nada' })).toBe(false);
    expect(productoTieneModificadores({ id: 'x' })).toBe(false);
  });
});
