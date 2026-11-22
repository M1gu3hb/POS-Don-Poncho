import { describe, expect, it } from 'vitest';

import {
  ESTADOS_DEL_PLATILLO,
  estadoDeLaLinea,
  estadosPorLinea,
  renglonesDelPlatillo,
  type ComandaParaElEstado,
} from './estado-del-platillo.ts';

/**
 * DP-25 · Parte 3 · 3.1 y 3.2 · EL ESTADO DE CADA PLATILLO y SUS OPCIONES, en la mesa del mesero.
 * Puro: lo que la pantalla enseña sale de aquí.
 */

const comanda = (
  items: readonly { id?: string; linea: string; estado: string }[],
  estado = 'en_preparacion',
): ComandaParaElEstado => ({
  estado,
  items: items.map((i) => ({ detalle_venta_id: i.linea, estado: i.estado })),
});

describe('estadosPorLinea', () => {
  it('traduce el estado del item al del platillo: pendiente es «nuevo»', () => {
    const mapa = estadosPorLinea([
      comanda([
        { linea: 'l1', estado: 'pendiente' },
        { linea: 'l2', estado: 'en_preparacion' },
        { linea: 'l3', estado: 'listo' },
        { linea: 'l4', estado: 'entregado' },
      ]),
    ]);
    expect([...mapa.entries()]).toEqual([
      ['l1', 'nuevo'],
      ['l2', 'en_preparacion'],
      ['l3', 'listo'],
      ['l4', 'entregado'],
    ]);
  });

  it('un platillo anulado no aparece', () => {
    const mapa = estadosPorLinea([comanda([{ linea: 'l1', estado: 'cancelado' }])]);
    expect(mapa.has('l1')).toBe(false);
  });

  it('si una línea tiene varios items, manda el MENOS avanzado (aún no está completa)', () => {
    const mapa = estadosPorLinea([
      comanda([{ linea: 'l1', estado: 'listo' }]),
      comanda([{ linea: 'l1', estado: 'pendiente' }]),
    ]);
    expect(mapa.get('l1')).toBe('nuevo');
  });

  it('junta las comandas de todas las estaciones y rondas de la cuenta', () => {
    const mapa = estadosPorLinea([
      comanda([{ linea: 'l1', estado: 'listo' }]),
      comanda([{ linea: 'l2', estado: 'entregado' }]),
    ]);
    expect(mapa.size).toBe(2);
  });
});

describe('estadoDeLaLinea', () => {
  it('usa el item de la comanda y, sin él, el estado que trae la propia línea', () => {
    const mapa = estadosPorLinea([comanda([{ linea: 'l1', estado: 'listo' }])]);
    expect(estadoDeLaLinea({ id: 'l1', estado_preparacion: 'pendiente' }, mapa)).toBe('listo');
    expect(estadoDeLaLinea({ id: 'l9', estado_preparacion: 'en_preparacion' }, mapa)).toBe(
      'en_preparacion',
    );
  });

  it('sin ningún dato es «nuevo»: lo que se acaba de mandar todavía no tiene comanda leída', () => {
    expect(estadoDeLaLinea({ id: 'l9' }, new Map())).toBe('nuevo');
  });
});

describe('ESTADOS_DEL_PLATILLO', () => {
  it('cada estado trae etiqueta, glifo y explicación propios: el color nunca va solo', () => {
    expect(ESTADOS_DEL_PLATILLO.map((e) => e.etiqueta)).toEqual([
      'Nuevo',
      'En preparación',
      'Listo',
      'Entregado',
    ]);
    expect(new Set(ESTADOS_DEL_PLATILLO.map((e) => e.glifo)).size).toBe(4);
    for (const e of ESTADOS_DEL_PLATILLO) expect(e.explicacion.length).toBeGreaterThan(10);
  });
});

describe('renglonesDelPlatillo', () => {
  it('las opciones salen con su grupo y la nota sólo con lo escrito a mano', () => {
    const r = renglonesDelPlatillo({
      opciones_snapshot: [
        { grupo: 'Extras', opciones: [{ nombre: 'Michelado', precioCentavos: '1500' }] },
      ],
      notas_producto: 'Extras: Michelado · sin chile',
    });
    expect(r.opciones).toEqual(['Extras: Michelado (+$15.00)']);
    expect(r.nota).toBe('sin chile');
  });

  it('sin instantánea cae al texto plano de las opciones', () => {
    const r = renglonesDelPlatillo({ opciones_texto: 'Término: medio · Salsa: verde' });
    expect(r.opciones).toEqual(['Término: medio', 'Salsa: verde']);
    expect(r.nota).toBe('');
  });

  it('un platillo sin nada que decir no inventa renglones', () => {
    expect(renglonesDelPlatillo({})).toEqual({ opciones: [], nota: '' });
  });
});
