import { describe, expect, it } from 'vitest';

import {
  ALTO_BASE_DEL_MAPA,
  ALTO_MINIMO_DEL_MAPA,
  MARGEN_DERECHO_DEL_LIENZO,
  MARGEN_DEL_LIENZO,
  MINIMO_POR_MESA_PX,
  calcularEscalaDelMapa,
  cajasDelMapa,
  type CajaDeMesa,
} from './escala-del-mapa';

const mesa = (x: number, y: number, ancho = 80, alto = 80): CajaDeMesa => ({ x, y, ancho, alto });

describe('la extensión del dibujo', () => {
  it('es hasta donde llega la última mesa, más sus márgenes', () => {
    const r = calcularEscalaDelMapa({
      anchoDisponible: 2000,
      altoDisponible: 2000,
      mesas: [mesa(100, 50), mesa(400, 300, 120, 70)],
    });
    expect(r.lienzo).toEqual({
      ancho: 520 + MARGEN_DERECHO_DEL_LIENZO,
      alto: 370 + MARGEN_DEL_LIENZO,
    });
  });

  it('cuenta la caja de una unión como una mesa más (ancho y alto propios)', () => {
    const r = calcularEscalaDelMapa({
      anchoDisponible: 2000,
      altoDisponible: 2000,
      mesas: [mesa(100, 100, 260, 80)],
    });
    expect(r.lienzo.ancho).toBe(360 + MARGEN_DERECHO_DEL_LIENZO);
  });
});

describe('cuando cabe, no se toca', () => {
  it('con espacio de sobra la escala es 1 (nunca se agranda) y no se desplaza', () => {
    const r = calcularEscalaDelMapa({
      anchoDisponible: 1600,
      altoDisponible: 1200,
      mesas: [mesa(100, 100), mesa(440, 280)],
    });
    expect(r.escala).toBe(1);
    expect(r.desplazaX).toBe(false);
    expect(r.desplazaY).toBe(false);
    expect(r.desplaza).toBe(false);
  });

  it('justo al ancho que mide el dibujo, escala 1', () => {
    const r = calcularEscalaDelMapa({
      anchoDisponible: 100 + MARGEN_DERECHO_DEL_LIENZO,
      altoDisponible: 1000,
      mesas: [mesa(0, 0, 100, 100)],
    });
    expect(r.escala).toBe(1);
  });
});

describe('se ajusta al ancho y al alto que tiene', () => {
  it('con la barra abierta (menos ancho) escala el dibujo completo para que no se corte nada', () => {
    const mesas = [mesa(60, 60), mesa(700, 300)];
    const abierta = calcularEscalaDelMapa({ anchoDisponible: 800, altoDisponible: 900, mesas });
    const cerrada = calcularEscalaDelMapa({ anchoDisponible: 1100, altoDisponible: 900, mesas });
    expect(cerrada.escala).toBe(1);
    expect(abierta.escala).toBeLessThan(1);
    expect(abierta.pantalla.ancho).toBeLessThanOrEqual(800 + 0.5);
    expect(abierta.escala).toBeCloseTo(800 / (780 + MARGEN_DERECHO_DEL_LIENZO), 2);
  });

  it('manda el eje más apretado: el alto puede ser el que decide', () => {
    const r = calcularEscalaDelMapa({
      anchoDisponible: 2000,
      altoDisponible: 500,
      mesas: [mesa(0, 0, 100, 100), mesa(0, 700, 100, 100)],
    });
    expect(r.escala).toBeCloseTo(500 / (800 + MARGEN_DEL_LIENZO), 2);
    expect(r.pantalla.alto).toBeLessThanOrEqual(500 + 0.5);
  });

  it('no se mueve ninguna posición: la escala es lo único que cambia', () => {
    const mesas = [mesa(60, 60), mesa(700, 300)];
    const copia = JSON.parse(JSON.stringify(mesas)) as CajaDeMesa[];
    calcularEscalaDelMapa({ anchoDisponible: 400, altoDisponible: 300, mesas });
    expect(mesas).toEqual(copia);
  });

  it('la caja mide la base (600) si hay espacio, y lo disponible si hay menos', () => {
    const mesas = [mesa(60, 60)];
    expect(
      calcularEscalaDelMapa({ anchoDisponible: 900, altoDisponible: 900, mesas }).caja.alto,
    ).toBe(ALTO_BASE_DEL_MAPA);
    expect(
      calcularEscalaDelMapa({ anchoDisponible: 900, altoDisponible: 500, mesas }).caja.alto,
    ).toBe(500);
  });

  it('la caja no baja del mínimo aunque la pantalla sea muy baja', () => {
    const r = calcularEscalaDelMapa({
      anchoDisponible: 900,
      altoDisponible: 100,
      mesas: [mesa(60, 60)],
    });
    expect(r.caja.alto).toBe(ALTO_MINIMO_DEL_MAPA);
  });
});

describe('ninguna mesa de menos de 56 px', () => {
  const lejos = [mesa(0, 0, 60, 60), mesa(800, 600, 120, 70)];

  it('la escala mínima deja la mesa más chica en 56 px', () => {
    const r = calcularEscalaDelMapa({ anchoDisponible: 300, altoDisponible: 300, mesas: lejos });
    expect(r.escala).toBeCloseTo(MINIMO_POR_MESA_PX / 60, 2);
    expect(60 * r.escala).toBeGreaterThanOrEqual(MINIMO_POR_MESA_PX - 0.1);
  });

  it('si no cabe en la escala mínima, se desplaza en los dos sentidos', () => {
    const r = calcularEscalaDelMapa({ anchoDisponible: 300, altoDisponible: 300, mesas: lejos });
    expect(r.desplazaX).toBe(true);
    expect(r.desplazaY).toBe(true);
    expect(r.desplaza).toBe(true);
    expect(r.pantalla.ancho).toBeGreaterThan(300);
    expect(r.pantalla.alto).toBeGreaterThan(r.caja.alto);
  });

  it('puede desplazarse en un solo sentido', () => {
    const r = calcularEscalaDelMapa({
      anchoDisponible: 300,
      altoDisponible: 900,
      mesas: [mesa(0, 0, 60, 60), mesa(800, 100, 120, 70)],
    });
    expect(r.desplazaX).toBe(true);
    expect(r.desplazaY).toBe(false);
  });

  it('una mesa que YA mide menos de 56 a escala 1 (90 × 55) no se encoge más: escala 1 y se desplaza', () => {
    const r = calcularEscalaDelMapa({
      anchoDisponible: 200,
      altoDisponible: 900,
      mesas: [mesa(0, 0, 90, 55), mesa(300, 0, 90, 55)],
    });
    expect(r.escala).toBe(1);
    expect(r.desplazaX).toBe(true);
  });

  it('el mínimo se mide con el lado CORTO de la mesa más chica, no con el largo', () => {
    const r = calcularEscalaDelMapa({
      anchoDisponible: 100,
      altoDisponible: 900,
      mesas: [mesa(0, 0, 90, 62), mesa(500, 0, 90, 62)],
    });
    expect(r.escala).toBeCloseTo(MINIMO_POR_MESA_PX / 62, 2);
  });
});

describe('lo que no se puede medir', () => {
  it('sin mesas: escala 1, nada que desplazar y la caja de base', () => {
    const r = calcularEscalaDelMapa({ anchoDisponible: 900, altoDisponible: 900, mesas: [] });
    expect(r.escala).toBe(1);
    expect(r.desplaza).toBe(false);
    expect(r.caja.alto).toBe(ALTO_BASE_DEL_MAPA);
  });

  it.each([0, -5, Number.NaN, Number.POSITIVE_INFINITY])(
    'con un ancho disponible de %s (aún sin medir) no escala ni desplaza',
    (ancho) => {
      const r = calcularEscalaDelMapa({
        anchoDisponible: ancho,
        altoDisponible: 800,
        mesas: [mesa(500, 500)],
      });
      expect(r.escala).toBe(1);
      expect(r.desplaza).toBe(false);
    },
  );

  it('una mesa sin tamaño (0 × 0) no rompe la cuenta', () => {
    const r = calcularEscalaDelMapa({
      anchoDisponible: 400,
      altoDisponible: 400,
      mesas: [mesa(10, 10, 0, 0), mesa(300, 300)],
    });
    expect(Number.isFinite(r.escala)).toBe(true);
    expect(r.escala).toBeGreaterThan(0);
    expect(r.escala).toBeLessThanOrEqual(1);
  });

  it('la escala sale redondeada a milésimas: un píxel de más no hace temblar al observador', () => {
    const r = calcularEscalaDelMapa({
      anchoDisponible: 777,
      altoDisponible: 900,
      mesas: [mesa(0, 0, 100, 100), mesa(700, 0, 100, 100)],
    });
    expect(r.escala).toBe(Math.round(r.escala * 1000) / 1000);
  });
});

describe('cajasDelMapa · lo que se dibuja, en puntos del plano', () => {
  const tabla = new Map([['unida', { x: 10, y: 20, ancho: 260, alto: 80 }]]);
  const cajaDe = (id: string) => tabla.get(id) ?? null;

  it('una mesa sin posición se pinta en (100, 100), como MesaShape', () => {
    expect(cajasDelMapa([{ id: 'a', forma: 'redonda', tamano: 'mediana' }], cajaDe)).toEqual([
      { x: 100, y: 100, ancho: 80, alto: 80 },
    ]);
  });

  it('con forma y tamaño toma sus medidas; sin ellos, la mediana redonda', () => {
    const [chica, sinNada] = cajasDelMapa(
      [
        { id: 'a', posicion_x: 5, posicion_y: 6, forma: 'cuadrada', tamano: 'chica' },
        { id: 'b', posicion_x: 7, posicion_y: 8 },
      ],
      cajaDe,
    );
    expect(chica).toEqual({ x: 5, y: 6, ancho: 60, alto: 60 });
    expect(sinNada).toEqual({ x: 7, y: 8, ancho: 80, alto: 80 });
  });

  it('una unión viva ocupa la caja del grupo (su posición y su tamaño), no los de la mesa', () => {
    const [caja] = cajasDelMapa(
      [{ id: 'unida', posicion_x: 999, posicion_y: 999, forma: 'redonda', tamano: 'chica' }],
      cajaDe,
    );
    expect(caja).toEqual({ x: 10, y: 20, ancho: 260, alto: 80 });
  });
});
