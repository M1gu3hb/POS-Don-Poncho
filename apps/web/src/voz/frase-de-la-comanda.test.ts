import { describe, expect, it } from 'vitest';

import { fraseNuevoPedidoCocina } from '../../heredado/lib/voiceAlert.js';

/**
 * DP-21 · Bloque 8 · LA VOZ DE COCINA DICE CUÁNTOS.
 *
 * Miguel oía «Consomé de carnero, Consomé de carnero, Consomé de carnero»: tres renglones iguales
 * (tres toques de «+» sobre un platillo con opciones) se leían uno por uno, y con la cantidad en 3
 * salía «3 Consomé…» —un dígito pegado a un nombre en singular—. Aquí se fija lo que SÍ debe decir
 * la voz, con nombres reales de una barbacoa: renglones iguales agrupados, la cantidad primero y
 * en palabras, las opciones dichas y el peso como se dice en la cocina.
 */

type Item = Record<string, unknown>;

const consome = (extra: Item = {}): Item => ({
  producto_id: 'p-consome',
  producto_nombre: 'Consomé de carnero',
  cantidad: 1,
  ...extra,
});

function frase(items: readonly Item[], extras: Record<string, unknown> = {}): string {
  return fraseNuevoPedidoCocina(4, items, '', extras);
}

describe('fraseNuevoPedidoCocina · la cantidad primero y en palabras', () => {
  it('con la cantidad en 3 dice «tres Consomés de carnero»', () => {
    expect(frase([consome({ cantidad: 3 })])).toBe(
      'Nuevo pedido mesa 4: tres Consomés de carnero.',
    );
  });

  it('tres renglones iguales se juntan en una sola mención', () => {
    expect(frase([consome(), consome(), consome()])).toBe(
      'Nuevo pedido mesa 4: tres Consomés de carnero.',
    );
  });

  it('«tres consomés de carnero, dos mixiotes»: cada platillo con su cantidad', () => {
    const dicho = frase([
      consome({ cantidad: 3 }),
      { producto_id: 'p-mixiote', producto_nombre: 'Mixiote', cantidad: 2 },
    ]);
    expect(dicho).toBe('Nuevo pedido mesa 4: tres Consomés de carnero, dos Mixiotes.');
  });

  it('una pieza no lleva cantidad; del 1 al 20 va en palabras y de ahí en adelante en cifras', () => {
    const uno = frase([{ producto_nombre: 'Taco de barbacoa', cantidad: 1 }]);
    expect(uno).toBe('Nuevo pedido mesa 4: Taco de barbacoa.');
    const veinte = frase([{ producto_nombre: 'Taco de barbacoa', cantidad: 20 }]);
    expect(veinte).toBe('Nuevo pedido mesa 4: veinte Tacos de barbacoa.');
    const veintiuno = frase([{ producto_nombre: 'Taco de barbacoa', cantidad: 21 }]);
    expect(veintiuno).toBe('Nuevo pedido mesa 4: 21 Tacos de barbacoa.');
  });

  it('suma lo que viene en renglones distintos del mismo platillo (cantidad y renglón)', () => {
    const dicho = frase([
      { producto_id: 'p-taco', producto_nombre: 'Taco de barbacoa', cantidad: 2 },
      { producto_id: 'p-taco', producto_nombre: 'Taco de barbacoa', cantidad: '3' },
    ]);
    expect(dicho).toBe('Nuevo pedido mesa 4: cinco Tacos de barbacoa.');
  });
});

describe('fraseNuevoPedidoCocina · el plural, sólo cuando es seguro', () => {
  const con = (producto_nombre: string, cantidad = 2): string =>
    frase([{ producto_nombre, cantidad }]);

  it('«X de Y» pone en plural la primera palabra: tacos, aguas, consomés', () => {
    expect(con('Taco de barbacoa')).toBe('Nuevo pedido mesa 4: dos Tacos de barbacoa.');
    expect(con('Agua de jamaica')).toBe('Nuevo pedido mesa 4: dos Aguas de jamaica.');
    expect(con('Consomé de carnero')).toBe('Nuevo pedido mesa 4: dos Consomés de carnero.');
  });

  it('una sola palabra: mixiotes, flanes, pasteles; lo ya plural se queda', () => {
    expect(con('Mixiote')).toBe('Nuevo pedido mesa 4: dos Mixiotes.');
    expect(con('Flan')).toBe('Nuevo pedido mesa 4: dos Flanes.');
    expect(con('Pastel')).toBe('Nuevo pedido mesa 4: dos Pasteles.');
    expect(con('Tacos')).toBe('Nuevo pedido mesa 4: dos Tacos.');
  });

  it('si no es seguro, dice «dos de …» y no inventa un plural', () => {
    expect(con('Pulque natural', 3)).toBe('Nuevo pedido mesa 4: tres de Pulque natural.');
    expect(con('Limón', 2)).toBe('Nuevo pedido mesa 4: dos de Limón.');
    expect(con('Coca Cola', 2)).toBe('Nuevo pedido mesa 4: dos de Coca Cola.');
  });

  it('«barbacoa de horno ½ kg» como nombre: el medio kilo se dice, no se deletrea', () => {
    expect(con('Barbacoa de horno ½ kg')).toBe(
      'Nuevo pedido mesa 4: dos Barbacoas de horno medio kilo.',
    );
  });
});

describe('fraseNuevoPedidoCocina · lo que va por peso dice su peso', () => {
  const porPeso = (peso: number | string, extra: Item = {}): Item => ({
    producto_id: 'p-barbacoa',
    producto_nombre: 'Barbacoa de horno',
    cantidad: peso,
    tipo_venta: 'variable_medida',
    unidad_variable: 'kg',
    cantidad_variable: peso,
    ...extra,
  });

  it('medio kilo, un cuarto de kilo, tres cuartos y un kilo', () => {
    expect(frase([porPeso(0.5)])).toBe('Nuevo pedido mesa 4: medio kilo de Barbacoa de horno.');
    expect(frase([porPeso('0.2500')])).toBe(
      'Nuevo pedido mesa 4: un cuarto de kilo de Barbacoa de horno.',
    );
    expect(frase([porPeso(0.75)])).toBe(
      'Nuevo pedido mesa 4: tres cuartos de kilo de Barbacoa de horno.',
    );
    expect(frase([porPeso(1)])).toBe('Nuevo pedido mesa 4: un kilo de Barbacoa de horno.');
  });

  it('kilo y medio, dos kilos y un peso raro en cifras', () => {
    expect(frase([porPeso(1.5)])).toBe('Nuevo pedido mesa 4: kilo y medio de Barbacoa de horno.');
    expect(frase([porPeso(2)])).toBe('Nuevo pedido mesa 4: dos kilos de Barbacoa de horno.');
    expect(frase([porPeso(1.25)])).toBe('Nuevo pedido mesa 4: 1.25 kilos de Barbacoa de horno.');
  });

  it('en gramos', () => {
    expect(frase([porPeso(300, { unidad_variable: 'g' })])).toBe(
      'Nuevo pedido mesa 4: 300 gramos de Barbacoa de horno.',
    );
  });

  it('dos renglones del mismo peso se dicen una vez: «dos de medio kilo de …»', () => {
    expect(frase([porPeso(0.5), porPeso(0.5)])).toBe(
      'Nuevo pedido mesa 4: dos de medio kilo de Barbacoa de horno.',
    );
  });

  it('pesos distintos no se juntan', () => {
    expect(frase([porPeso(0.5), porPeso(1)])).toBe(
      'Nuevo pedido mesa 4: medio kilo de Barbacoa de horno, un kilo de Barbacoa de horno.',
    );
  });
});

describe('fraseNuevoPedidoCocina · opciones y notas', () => {
  const grande = [{ grupo: 'Tamaño', opciones: ['Grande'] }];

  it('las opciones se dicen sin el nombre del grupo, y la nota después', () => {
    const dicho = frase([
      consome({
        cantidad: 2,
        opciones: grande,
        notas: 'Tamaño: Grande · sin cebolla',
      }),
    ]);
    expect(dicho).toBe('Nuevo pedido mesa 4: dos Consomés de carnero, Grande, sin cebolla.');
  });

  it('mismas opciones y misma nota se juntan; otra opción o otra nota, no', () => {
    const chico = [{ grupo: 'Tamaño', opciones: ['Chico'] }];
    const dicho = frase([
      consome({ opciones: grande }),
      consome({ opciones: grande }),
      consome({ opciones: chico }),
      consome({ opciones: grande, notas: 'sin cebolla' }),
    ]);
    expect(dicho).toBe(
      'Nuevo pedido mesa 4: dos Consomés de carnero, Grande; Consomé de carnero, Chico; Consomé de carnero, Grande, sin cebolla.',
    );
  });

  it('la nota se compara sin importar mayúsculas ni espacios de más', () => {
    const dicho = frase([consome({ notas: 'Sin  cebolla ' }), consome({ notas: 'sin cebolla' })]);
    expect(dicho).toBe('Nuevo pedido mesa 4: dos Consomés de carnero, Sin cebolla.');
  });

  it('las opciones pueden venir como el texto JSON del puente', () => {
    const dicho = frase([consome({ opciones: JSON.stringify(grande) })]);
    expect(dicho).toBe('Nuevo pedido mesa 4: Consomé de carnero, Grande.');
  });

  it('un platillo con otro id pero el mismo nombre no se junta', () => {
    const dicho = frase([
      { producto_id: 'a', producto_nombre: 'Mixiote', cantidad: 1 },
      { producto_id: 'b', producto_nombre: 'Mixiote', cantidad: 1 },
    ]);
    expect(dicho).toBe('Nuevo pedido mesa 4: Mixiote, Mixiote.');
  });
});

describe('fraseNuevoPedidoCocina · lo de siempre sigue igual', () => {
  it('sin platillos: «pedido nuevo»; con alergia, celebración y nota general', () => {
    expect(fraseNuevoPedidoCocina(4, [], '', {})).toBe('Nuevo pedido mesa 4: pedido nuevo.');
    expect(
      fraseNuevoPedidoCocina(0, [consome({ cantidad: 3 })], 'sin prisa', {
        rotulo: 'para llevar 3',
        notas_alergias: 'cacahuate',
        celebracion: true,
        tipo_celebracion: 'cumpleaños',
      }),
    ).toBe(
      'Atención, alergia: cacahuate. Nuevo pedido para llevar 3: tres Consomés de carnero. Nota general: sin prisa. Celebración: cumpleaños.',
    );
  });

  it('más de ocho platillos distintos: dice cuántos quedan sin leer', () => {
    const muchos = Array.from({ length: 10 }, (_, i) => ({
      producto_id: `p${String(i)}`,
      producto_nombre: `Platillo ${String(i)}`,
      cantidad: 1,
    }));
    const dicho = frase(muchos);
    expect(dicho).toContain('Platillo 7');
    expect(dicho).not.toContain('Platillo 8');
    expect(dicho).toContain('y dos más');
  });
});
