import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { crearAlmacenDelBorrador } from './almacen-del-borrador';
import type { ProductoDelMenu } from './borrador-de-la-mesa';
import { CatalogoDeLaMesa, type CatalogoDeLaMesaProps } from './CatalogoDeLaMesa';
import { PlatilloTesela } from './PlatilloTesela';

/**
 * EL CATÁLOGO DE LA MESA ABIERTA y su platillo.
 *
 * Lo que fija: el NOMBRE ACCESIBLE del platillo (`^Nombre \$`, como lo busca la prueba de
 * navegador; un `<Dinero>` suelto se leería «329 pesos con 00 centavos»), los tres estados del
 * catálogo, y el primer dibujo en dos tiempos (`useDeferredValue` con valor inicial vacío): el
 * diálogo abre con su esqueleto y los botones llegan en un segundo dibujo.
 */

const arrachera: ProductoDelMenu = {
  id: 'p1',
  nombre: 'Arrachera al carbón',
  categoria_id: 'c1',
  precio_venta: 329,
  area_preparacion: 'cocina',
};

const tesela = (producto: ProductoDelMenu, colorear = true): string =>
  renderToStaticMarkup(
    <PlatilloTesela producto={producto} colorear={colorear} alElegir={() => undefined} />,
  );

describe('el platillo', () => {
  it('es un botón sólido cuyo nombre accesible es «Nombre $importe área»', () => {
    const html = tesela(arrachera);
    expect(html).toMatch(/^<button[^>]*type="button"/);
    expect(html).toContain('aria-label="Arrachera al carbón $329.00 cocina"');
    expect(html).toContain('data-nivel="1"');
  });

  it('el importe visible es <Dinero> (cifras tabulares) y no texto a mano', () => {
    const html = tesela(arrachera);
    expect(html).toContain('data-dinero=""');
    expect(html).toContain('tabular-nums');
  });

  it('el importe va en el color del estilo, o en el del texto si el negocio lo apaga', () => {
    expect(tesela(arrachera, true)).toContain('text-primario');
    // (Un platillo sin opciones no tiene ningún otro `text-primario`.)
    expect(tesela(arrachera, false)).not.toContain('text-primario');
  });

  it('por kilo: el importe es el del kilo y la medida va detrás', () => {
    const html = tesela({
      id: 'p2',
      nombre: 'Barbacoa',
      tipo_venta: 'variable_medida',
      precio_venta: 0,
      precio_por_unidad_variable: 180,
      unidad_variable: 'kg',
      area_preparacion: 'cocina',
    });
    expect(html).toContain('aria-label="Barbacoa $180.00 / kg cocina Variable"');
    expect(html).toContain('/ kg');
    expect(html).toContain('>Variable<');
  });

  it('por porción: el importe es el de la porción', () => {
    const html = tesela({
      id: 'p3',
      nombre: 'Mezcal',
      tipo_venta: 'porcion_contenedor',
      precio_por_porcion: 95,
      nombre_porcion: 'copa',
      area_preparacion: 'barra',
    });
    expect(html).toContain('aria-label="Mezcal $95.00 / copa barra Por porción"');
  });

  it('un platillo con opciones lo dice, en el nombre y a la vista', () => {
    const html = tesela({
      ...arrachera,
      modificadores: [{ nombre: 'Término', opciones: [{ nombre: 'Medio' }] }],
    });
    expect(html).toContain('aria-label="Arrachera al carbón $329.00 cocina Opciones"');
    expect(html).toContain('>Opciones<');
  });

  it('sin foto, el marcador de la marca; con foto, la imagen con su tamaño y carga diferida', () => {
    expect(tesela(arrachera)).toContain('lucide-utensils-crossed');
    expect(tesela(arrachera)).not.toContain('<img');
    const conFoto = tesela({ ...arrachera, imagen_url: 'https://cdn.example/arrachera.jpg' });
    expect(conFoto).toContain('<img');
    expect(conFoto).toContain('src="https://cdn.example/arrachera.jpg"');
    expect(conFoto).toContain('loading="lazy"');
    expect(conFoto).toContain('width="44"');
    expect(conFoto).toContain('alt=""');
  });

  it('sin área de preparación, «cocina»', () => {
    expect(tesela({ id: 'p4', nombre: 'Agua', precio_venta: 20 })).toContain(
      'aria-label="Agua $20.00 cocina"',
    );
  });

  it('un precio ausente es $0.00, no un error', () => {
    expect(tesela({ id: 'p5', nombre: 'Cortesía' })).toContain(
      'aria-label="Cortesía $0.00 cocina"',
    );
  });

  it('sin vidrio ni sombras ni colores a mano', () => {
    const html = tesela(arrachera);
    expect(html).not.toMatch(/backdrop|blur|gradient|#[0-9a-f]{3,6}\b/i);
    expect(html).not.toMatch(/style="[^"]*shadow/);
  });
});

const comun: Omit<CatalogoDeLaMesaProps, 'borrador'> = {
  productos: [arrachera, { id: 'p2', nombre: 'Limonada', categoria_id: 'c2', precio_venta: 45 }],
  categorias: [
    { id: 'c1', nombre: 'Carnes' },
    { id: 'c2', nombre: 'Bebidas' },
  ],
  cargando: false,
  leido: true,
  sinLeer: false,
  colorear: true,
  alElegir: () => undefined,
  alReintentar: () => undefined,
};
const catalogo = (
  cambios: Partial<CatalogoDeLaMesaProps> = {},
  buscar = '',
  categoria = '',
): string => {
  const borrador = crearAlmacenDelBorrador();
  if (buscar !== '') borrador.ponerBusqueda(buscar);
  if (categoria !== '') borrador.ponerCategoria(categoria);
  return renderToStaticMarkup(<CatalogoDeLaMesa borrador={borrador} {...comun} {...cambios} />);
};

describe('lo que hace que abrir una mesa no dibuje 107 botones por cada toque', () => {
  it('el platillo y el catálogo están memoizados: con propiedades iguales no se vuelven a dibujar', () => {
    expect(PlatilloTesela).toHaveProperty('$$typeof', Symbol.for('react.memo'));
    expect(CatalogoDeLaMesa).toHaveProperty('$$typeof', Symbol.for('react.memo'));
  });
});

describe('el catálogo', () => {
  it('el primer dibujo es el esqueleto: los platillos llegan en el segundo (el diálogo abre antes)', () => {
    const html = catalogo();
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-busy="true"');
    expect(html).not.toContain('aria-label="Arrachera');
  });

  it('el buscador y las categorías están desde el primer dibujo', () => {
    const html = catalogo();
    expect(html).toContain('placeholder="Buscar producto..."');
    expect(html).toContain('>Todas<');
    expect(html).toContain('>Carnes<');
    expect(html).toContain('>Bebidas<');
  });

  it('«Todas» es la elegida al principio, y lo dice con aria-pressed', () => {
    const html = catalogo();
    expect(html).toMatch(/aria-pressed="true"[^>]*>Todas</);
    expect(html).toMatch(/aria-pressed="false"[^>]*>Carnes</);
  });

  it('la categoría elegida del borrador es la que queda marcada', () => {
    expect(catalogo({}, '', 'c2')).toMatch(/aria-pressed="true"[^>]*>Bebidas</);
  });

  it('lo que se tecleó antes sigue en el campo', () => {
    expect(catalogo({}, 'arra')).toContain('value="arra"');
  });

  it('cargando: el esqueleto, sin «Sin productos»', () => {
    const html = catalogo({ productos: [], cargando: true, leido: false });
    expect(html).toContain('role="status"');
    expect(html).not.toContain('Sin productos disponibles');
  });

  it('leído y sin platillos: «Sin productos disponibles»', () => {
    expect(catalogo({ productos: [], leido: true })).toContain('Sin productos disponibles');
  });

  it('una búsqueda que no encuentra nada: «Sin resultados para tu búsqueda»', () => {
    const html = catalogo({}, 'zzzz');
    expect(html).toContain('Sin resultados para tu búsqueda');
    expect(html).not.toContain('Sin productos disponibles');
  });

  it('si la lectura falló y no hay nada que enseñar: un error con salida', () => {
    const html = catalogo({ productos: [], sinLeer: true, leido: true });
    expect(html).toContain('role="alert"');
    expect(html).toContain('No se pudo leer el menú.');
    expect(html).toContain('Volver a intentar');
    expect(html).not.toContain('Sin productos disponibles');
  });

  it('con platillos ya leídos, un error de relectura no los tapa', () => {
    expect(catalogo({ sinLeer: true })).not.toContain('role="alert"');
  });
});
