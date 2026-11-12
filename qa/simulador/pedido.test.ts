import { describe, expect, it } from 'vitest';

import { armarCatalogo, gruposDe } from './catalogo.ts';
import { mundoVacio, type ProductoConocido } from './mundo.ts';
import { elegirOpciones, esPorPeso, pedibles, planearLinea, planearRonda } from './pedido.ts';
import { crearAzar } from './semilla.ts';

const quesadilla: ProductoConocido = {
  id: 'q',
  nombre: 'Quesadilla',
  categoria: 'Pa’ empezar',
  estacion: 'Cocina',
  tipoVenta: 'precio_fijo',
  precioCentavos: 2500,
  presentaciones: [],
  soloPresentaciones: false,
  grupos: [
    {
      id: 'g',
      nombre: 'Relleno',
      tipo: 'unica',
      obligatorio: true,
      minimo: null,
      maximo: null,
      opciones: [
        { id: 'o1', nombre: 'Pollo', deltaCentavos: 0, activa: true },
        { id: 'o2', nombre: 'Queso', deltaCentavos: 500, activa: true },
        { id: 'o3', nombre: 'Hongos', deltaCentavos: 0, activa: false },
      ],
    },
  ],
};
const barbacoa: ProductoConocido = {
  id: 'b',
  nombre: 'Barbacoa de horno',
  categoria: 'Lo fuerte',
  estacion: 'Cocina',
  tipoVenta: 'variable_medida',
  precioCentavos: 79_500,
  presentaciones: [0.25, 0.5, 1],
  soloPresentaciones: true,
  grupos: [],
};
const guacamole: ProductoConocido = {
  id: 'g',
  nombre: 'Guacamole',
  categoria: 'Pa’ empezar',
  estacion: 'Cocina',
  tipoVenta: 'precio_fijo',
  precioCentavos: 6000,
  presentaciones: [],
  soloPresentaciones: false,
  grupos: [],
};

function mundoConCarta() {
  const m = mundoVacio();
  m.catalogo = [quesadilla, barbacoa, guacamole];
  return m;
}

describe('lo que pide un grupo', () => {
  it('elige una sola opción activa en un grupo único obligatorio', () => {
    const grupo = quesadilla.grupos[0];
    if (grupo === undefined) throw new Error('falta el grupo');
    for (let s = 0; s < 30; s += 1) {
      const e = elegirOpciones(crearAzar(s), grupo);
      expect(e).toHaveLength(1);
      expect(['Pollo', 'Queso']).toContain(e[0]?.opcion);
    }
  });

  it('el importe esperado suma las opciones por pieza y no por kilo', () => {
    const conQueso = planearLinea(crearAzar('x'), quesadilla, false);
    const delta = conQueso.opciones.reduce((s, o) => s + o.deltaCentavos, 0);
    expect(conQueso.importeCentavos).toBe((2500 + delta) * conQueso.cantidad);
    const peso = planearLinea(crearAzar('y'), barbacoa, false);
    expect(esPorPeso(peso.producto)).toBe(true);
    expect([0.25, 0.5, 1]).toContain(peso.cantidad);
    expect(peso.importeCentavos).toBe(Math.round(79_500 * peso.cantidad));
  });

  it('no pide lo agotado', () => {
    const m = mundoConCarta();
    m.agotados.add('Guacamole');
    expect(pedibles(m).map((p) => p.nombre)).not.toContain('Guacamole');
  });

  it('una ronda es de 1 a 6 líneas y es la misma con la misma semilla', () => {
    const m = mundoConCarta();
    const a = planearRonda(crearAzar(5), m, 4);
    expect(a.length).toBeGreaterThanOrEqual(1);
    expect(a.length).toBeLessThanOrEqual(6);
    expect(planearRonda(crearAzar(5), m, 4)).toEqual(a);
  });
});

describe('el catálogo leído de la copia', () => {
  it('arma los grupos con el delta que usa la app (delta, o el extra si no hay delta)', () => {
    const grupos = gruposDe([
      {
        producto_id: 'p',
        id: 'g',
        nombre: 'Sabor',
        tipo: 'unica',
        obligatorio: true,
        minimo: null,
        maximo: null,
        opcion_id: 'o',
        opcion: 'Fresa',
        delta: '1500',
        activa: true,
      },
    ]);
    expect(grupos.get('p')?.[0]?.opciones[0]?.deltaCentavos).toBe(1500);
  });

  it('el precio de lo que se vende por peso es el del kilo y los presets salen de la lista', () => {
    const [p] = armarCatalogo(
      [
        {
          id: 'b',
          nombre: 'Barbacoa',
          categoria: 'Lo fuerte',
          estacion: null,
          tipo_venta: 'variable_medida',
          precio: '79500',
          por_porcion: null,
          presets: [0.25, 0.5, 1],
          solo_presets: false,
        },
      ],
      new Map(),
    );
    expect(p?.precioCentavos).toBe(79_500);
    expect(p?.presentaciones).toEqual([0.25, 0.5, 1]);
    expect(p?.estacion).toBe('Cocina');
  });
});
