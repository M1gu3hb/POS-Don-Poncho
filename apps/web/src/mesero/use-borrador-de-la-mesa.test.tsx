import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { crearAlmacenDelBorrador } from './almacen-del-borrador';
import { useBorrador, useCrearBorrador } from './use-borrador-de-la-mesa';

/**
 * LOS GANCHOS DEL BORRADOR, leídos en el servidor (el primer dibujo): lo que `useSyncExternalStore`
 * entrega sin suscribirse todavía. La suscripción en el navegador la cubren el almacén (sus avisos)
 * y las pruebas de navegador; aquí se fija que cada selector lee SU parte y que el almacén que
 * crea `Mesero` es uno solo por dibujo.
 */

function Busqueda({ almacen }: { readonly almacen: ReturnType<typeof crearAlmacenDelBorrador> }) {
  const busqueda = useBorrador(almacen, (e) => e.busqueda);
  const unidades = useBorrador(almacen, (e) => e.carrito.length);
  return (
    <p>
      {busqueda}|{unidades}
    </p>
  );
}

function CreaYLee() {
  const almacen = useCrearBorrador();
  return <p>{almacen.leer().categoria}</p>;
}

describe('useBorrador', () => {
  it('cada selector saca su parte del estado', () => {
    const almacen = crearAlmacenDelBorrador();
    almacen.ponerBusqueda('arra');
    almacen.agregarProducto({ id: 'p1', nombre: 'Arrachera', precio_venta: 10 });
    expect(renderToStaticMarkup(<Busqueda almacen={almacen} />)).toBe('<p>arra|1</p>');
  });

  it('un almacén vacío se lee vacío', () => {
    expect(renderToStaticMarkup(<Busqueda almacen={crearAlmacenDelBorrador()} />)).toBe(
      '<p>|0</p>',
    );
  });
});

describe('useCrearBorrador', () => {
  it('entrega un almacén listo, con la categoría «todas»', () => {
    expect(renderToStaticMarkup(<CreaYLee />)).toBe('<p>todas</p>');
  });
});
