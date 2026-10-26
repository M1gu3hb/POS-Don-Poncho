import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { entradaCrearProducto } from '../../packages/app/src/catalogo/esquemas.ts';
import { entradaGuardarModificadores } from '../../packages/app/src/catalogo/modificadores-guardar.ts';

import {
  areaDeLaCategoria,
  atajosDelProducto,
  entradaDelProducto,
  gruposDelProducto,
  pesos,
  resumenDelMenu,
  validarMenu,
  type MenuDelRestaurante,
} from './menu.mjs';

/**
 * EL MENÚ DE DON PONCHO, tal como lo carga `scripts/cargar-menu.mjs`.
 *
 * Contra el archivo REAL (`docs/cliente/menu-don-poncho.json`) y contra los esquemas REALES
 * de los comandos: si el archivo trae algo que `catalogo.crear_producto` rechazaría, se sabe
 * aquí y no a media carga en la base compartida.
 */
const MENU = JSON.parse(
  readFileSync(new URL('../../docs/cliente/menu-don-poncho.json', import.meta.url), 'utf8'),
) as MenuDelRestaurante;
const CATEGORIA_ID = '00000000-0000-4000-8000-000000000001';
const PRODUCTOS = MENU.categorias.flatMap((c) => c.productos.map((p) => ({ categoria: c, p })));

describe('el archivo del menú', () => {
  it('no tiene un solo problema', () => {
    expect(validarMenu(MENU)).toEqual([]);
  });

  it('trae lo que se transcribió y se aprobó: 107 productos en 17 categorías y 2 estaciones', () => {
    expect(resumenDelMenu(MENU)).toEqual({
      estaciones: 2,
      categorias: 17,
      productos: 107,
      porPeso: 2,
      conOpciones: 13,
    });
  });

  it('ninguna opción cobra: en el restaurante el modificador viaja como nota', () => {
    for (const grupo of MENU.modificadores) {
      expect(
        grupo.opciones.every(([, precio]) => precio === 0),
        grupo.clave,
      ).toBe(true);
    }
  });

  it('los tarros son productos extra con su precio, no opciones', () => {
    const cerveza = MENU.categorias.find((c) => c.nombre === 'Cerveza');
    const extras = cerveza?.productos.filter((p) => p.nombre.endsWith('(extra)'));
    expect(extras?.map((p) => [p.nombre, p.precio])).toEqual([
      ['Michelado (extra)', 1500],
      ['Cubano (extra)', 2000],
      ['Con clamato (extra)', 3000],
      ['Con clamato cubano (extra)', 3500],
    ]);
  });
});

describe('el área que comanda', () => {
  it('toda categoría comanda: la comida a cocina y la bebida a barra', () => {
    for (const categoria of MENU.categorias) {
      const area = areaDeLaCategoria(MENU, categoria);
      expect(area, categoria.nombre).toBe(categoria.estacion === 'Bebidas' ? 'barra' : 'cocina');
    }
  });
});

describe('validarMenu', () => {
  const base: MenuDelRestaurante = {
    version: 1,
    moneda: 'MXN',
    estaciones: ['Cocina'],
    areaPorEstacion: { Cocina: 'cocina' },
    modificadores: [{ clave: 'relleno', nombre: 'Relleno', opciones: [['Queso', 0]] }],
    categorias: [
      { nombre: 'Antojitos', estacion: 'Cocina', productos: [{ nombre: 'Tlacoyo', precio: 2000 }] },
    ],
  };

  it('acepta un menú sano', () => {
    expect(validarMenu(base)).toEqual([]);
  });

  it.each([
    ['un precio en pesos con decimales', { precio: 20.5 }, 'centavos enteros'],
    ['un precio en cero', { precio: 0 }, 'centavos enteros'],
    ['un grupo que no existe', { modificadores: ['salsa'] }, 'no existe'],
    ['una unidad de peso inventada', { porPeso: { unidad: 'arroba' } }, 'unidad de peso'],
  ])('rechaza %s', (_caso, cambio, mensaje) => {
    const roto = {
      ...base,
      categorias: [
        { ...base.categorias[0]!, productos: [{ nombre: 'Tlacoyo', precio: 2000, ...cambio }] },
      ],
    } as MenuDelRestaurante;
    expect(validarMenu(roto).join(' ')).toContain(mensaje);
  });

  it('rechaza una opción con precio, porque no se cobraría', () => {
    const roto = {
      ...base,
      modificadores: [{ clave: 'relleno', nombre: 'Relleno', opciones: [['Queso', 500]] }],
    } as MenuDelRestaurante;
    expect(validarMenu(roto).join(' ')).toContain('no se cobrarían');
  });

  it('rechaza un producto repetido y una estación que no existe', () => {
    const roto = {
      ...base,
      categorias: [
        ...base.categorias,
        { nombre: 'Bebidas', estacion: 'Barra', productos: [{ nombre: 'tlacoyo', precio: 100 }] },
      ],
    } as MenuDelRestaurante;
    const texto = validarMenu(roto).join(' ');
    expect(texto).toContain('repetido');
    expect(texto).toContain('estación que no existe');
  });

  it('rechaza una estación sin área: sus productos no llegarían a cocina', () => {
    expect(validarMenu({ ...base, areaPorEstacion: {} }).join(' ')).toContain('no dice a qué área');
    expect(validarMenu({ ...base, areaPorEstacion: { Cocina: 'ninguno' } }).join(' ')).toContain(
      'no dice a qué área',
    );
  });

  it('exige la versión, que es parte de la clave de idempotencia', () => {
    expect(validarMenu({ ...base, version: 0 }).join(' ')).toContain('version');
  });
});

describe('pesos', () => {
  it.each([
    [79500, '795.00'],
    [1500, '15.00'],
    [5, '0.05'],
    [0, '0.00'],
  ])('%i centavos son «%s»', (centavos, texto) => {
    expect(pesos(centavos)).toBe(texto);
  });

  it('no acepta lo que no son centavos enteros', () => {
    expect(() => pesos(12.5)).toThrow();
    expect(() => pesos(-1)).toThrow();
  });
});

describe('entradaDelProducto', () => {
  it.each(PRODUCTOS)('$p.nombre pasa el esquema de catalogo.crear_producto', ({ categoria, p }) => {
    const resultado = entradaCrearProducto.safeParse(
      entradaDelProducto(categoria, p, CATEGORIA_ID),
    );
    expect(resultado.success, JSON.stringify(resultado.error?.issues)).toBe(true);
  });

  it('todo nace con RECETA PENDIENTE: estrategia receta, se vende sin existencia', () => {
    for (const { categoria, p } of PRODUCTOS) {
      expect(entradaDelProducto(categoria, p, CATEGORIA_ID)).toMatchObject({
        estrategiaConsumo: 'receta',
        permiteVentaSinStock: true,
        visibleEnPos: true,
      });
    }
  });

  it('la barbacoa se vende por kilo, a $795.00 el kilo', () => {
    const barbacoa = PRODUCTOS.find(({ p }) => p.nombre === 'Barbacoa de horno');
    expect(barbacoa).toBeDefined();
    expect(entradaDelProducto(barbacoa!.categoria, barbacoa!.p, CATEGORIA_ID)).toMatchObject({
      tipoVenta: 'variable_medida',
      unidadVariable: 'kg',
      precioVariable: '795.00',
    });
    expect(atajosDelProducto(barbacoa!.p)).toEqual([0.25, 0.5, 1]);
  });

  it('un licor se vende por copa y lo dice', () => {
    const tequila = MENU.categorias.find((c) => c.nombre === 'Tequila')!;
    expect(entradaDelProducto(tequila, tequila.productos[0]!, CATEGORIA_ID)).toMatchObject({
      descripcion: 'Copa',
      tipoVenta: 'precio_fijo',
    });
  });
});

describe('gruposDelProducto', () => {
  it.each(PRODUCTOS.filter(({ p }) => (p.modificadores ?? []).length > 0))(
    '$p.nombre pasa el esquema de catalogo.guardar_modificadores',
    ({ p }) => {
      const entrada = { productoId: CATEGORIA_ID, grupos: gruposDelProducto(MENU, p) };
      const resultado = entradaGuardarModificadores.safeParse(entrada);
      expect(resultado.success, JSON.stringify(resultado.error?.issues)).toBe(true);
    },
  );

  it('un sabor de temporada entra prendido y sin precio', () => {
    const pulque = PRODUCTOS.find(({ p }) => p.nombre === 'Pulque básico · litro')!;
    const [grupo] = gruposDelProducto(MENU, pulque.p);
    const tuna = grupo?.opciones.find((o) => o.nombre === 'Tuna roja');
    expect(tuna).toEqual({ nombre: 'Tuna roja', precioExtra: '0.00', activa: true });
    expect(grupo?.obligatorio).toBe(true);
  });
});
