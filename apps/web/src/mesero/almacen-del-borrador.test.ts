import { describe, expect, it, vi } from 'vitest';

import { crearAlmacenDelBorrador } from './almacen-del-borrador';

/**
 * EL ALMACÉN DEL BORRADOR, que está FUERA de React.
 *
 * Es lo que hace que abrir una mesa no vuelva a dibujar el mapa: el carrito, la búsqueda y el
 * filtro ya no son estado del componente `Mesero`, sino de un almacén al que se suscribe sólo
 * quien los lee (`useSyncExternalStore`). Estas pruebas fijan lo que ese contrato exige:
 * un estado inmutable de identidad estable, avisos sólo cuando algo CAMBIÓ de verdad, y que un
 * suscriptor pueda irse sin dejar el aviso colgado.
 */

const arrachera = { id: 'p-arrachera', nombre: 'Arrachera', precio_venta: 329 };

describe('el estado', () => {
  it('nace vacío: sin carrito, sin búsqueda, en «todas» y sin nota', () => {
    const almacen = crearAlmacenDelBorrador();
    expect(almacen.leer()).toEqual({ carrito: [], busqueda: '', categoria: 'todas', nota: '' });
  });

  it('sin cambios, leer() devuelve el MISMO objeto (lo que useSyncExternalStore exige)', () => {
    const almacen = crearAlmacenDelBorrador();
    expect(almacen.leer()).toBe(almacen.leer());
  });

  it('un cambio da un objeto nuevo y el anterior queda intacto', () => {
    const almacen = crearAlmacenDelBorrador();
    const antes = almacen.leer();
    almacen.agregarProducto(arrachera);
    expect(almacen.leer()).not.toBe(antes);
    expect(antes.carrito).toHaveLength(0);
    expect(almacen.leer().carrito).toHaveLength(1);
  });
});

describe('los avisos', () => {
  it('cada cambio avisa UNA vez', () => {
    const almacen = crearAlmacenDelBorrador();
    const oyente = vi.fn();
    almacen.suscribir(oyente);
    almacen.agregarProducto(arrachera);
    expect(oyente).toHaveBeenCalledTimes(1);
    almacen.ponerBusqueda('arr');
    expect(oyente).toHaveBeenCalledTimes(2);
  });

  it('lo que no cambia nada no avisa: la misma búsqueda, la misma categoría, la misma nota', () => {
    const almacen = crearAlmacenDelBorrador();
    const oyente = vi.fn();
    almacen.suscribir(oyente);
    almacen.ponerBusqueda('');
    almacen.ponerCategoria('todas');
    almacen.ponerNota('');
    almacen.vaciarPedido();
    almacen.cambiarCantidad('no-existe', 1);
    expect(oyente).not.toHaveBeenCalled();
  });

  it('quien se da de baja ya no oye, y los demás sí', () => {
    const almacen = crearAlmacenDelBorrador();
    const sale = vi.fn();
    const queda = vi.fn();
    const baja = almacen.suscribir(sale);
    almacen.suscribir(queda);
    baja();
    almacen.agregarProducto(arrachera);
    expect(sale).not.toHaveBeenCalled();
    expect(queda).toHaveBeenCalledTimes(1);
  });

  it('darse de baja dos veces no estorba', () => {
    const almacen = crearAlmacenDelBorrador();
    const baja = almacen.suscribir(vi.fn());
    baja();
    expect(() => {
      baja();
    }).not.toThrow();
  });
});

describe('las acciones', () => {
  it('agregar dos veces lo mismo sube la cantidad; cambiarCantidad la baja y al cero la quita', () => {
    const almacen = crearAlmacenDelBorrador();
    almacen.agregarProducto(arrachera);
    almacen.agregarProducto(arrachera);
    expect(almacen.leer().carrito[0]?.cantidad).toBe(2);
    almacen.cambiarCantidad('p-arrachera', -1);
    expect(almacen.leer().carrito[0]?.cantidad).toBe(1);
    almacen.cambiarCantidad('p-arrachera', -1);
    expect(almacen.leer().carrito).toEqual([]);
  });

  it('las líneas de kilo y las personalizadas se suman como líneas propias', () => {
    const almacen = crearAlmacenDelBorrador();
    almacen.agregarVariable(arrachera, { precio_total_linea: 100 });
    almacen.agregarPersonalizado(arrachera, { modificadores: [], notas: 'sin sal' });
    expect(almacen.leer().carrito).toHaveLength(2);
    expect(almacen.leer().carrito[1]?.notas).toBe('sin sal');
  });

  it('las notas y exclusiones de una línea llegan a esa línea', () => {
    const almacen = crearAlmacenDelBorrador();
    almacen.agregarProducto(arrachera);
    almacen.ponerNotasDeLinea('p-arrachera', 'bien cocida');
    almacen.ponerExclusionesDeLinea('p-arrachera', ['cebolla']);
    expect(almacen.leer().carrito[0]).toMatchObject({
      notas: 'bien cocida',
      _exclusiones: ['cebolla'],
    });
  });

  it('vaciarPedido borra el carrito y la nota, y deja la búsqueda y el filtro como estaban', () => {
    const almacen = crearAlmacenDelBorrador();
    almacen.agregarProducto(arrachera);
    almacen.ponerNota('para llevar');
    almacen.ponerBusqueda('arr');
    almacen.ponerCategoria('c-carnes');
    almacen.vaciarPedido();
    expect(almacen.leer()).toEqual({
      carrito: [],
      busqueda: 'arr',
      categoria: 'c-carnes',
      nota: '',
    });
  });

  it('reiniciar lo deja todo como al nacer (al abrir otra mesa)', () => {
    const almacen = crearAlmacenDelBorrador();
    almacen.agregarProducto(arrachera);
    almacen.ponerNota('para llevar');
    almacen.ponerBusqueda('arr');
    almacen.ponerCategoria('c-carnes');
    almacen.reiniciar();
    expect(almacen.leer()).toEqual({ carrito: [], busqueda: '', categoria: 'todas', nota: '' });
  });

  it('las acciones se pueden pasar sueltas: no dependen de `this`', () => {
    const almacen = crearAlmacenDelBorrador();
    const { agregarProducto, leer } = almacen;
    agregarProducto(arrachera);
    expect(leer().carrito).toHaveLength(1);
  });
});
