import { describe, expect, it } from 'vitest';

import { emular, OrdenDesconocida } from './emulador.ts';
import {
  avanzar,
  cortar,
  imagenEnFranjas,
  imagenPorColumnas,
  iniciar,
  leerEstado,
  pedirEstado,
  pulsoDelCajon,
  pulsoEnTiempoReal,
  unir,
} from './escpos.ts';
import {
  aRgba,
  empaquetarFilas,
  mapaVacio,
  puntosDistintos,
  puntosNegros,
  type ImagenRgba,
  type MapaDeBits,
} from './mapa.ts';
import { aMonocromo, luzDelPixel } from './monocromo.ts';

/**
 * DP-20 · EL TICKET QUE SALE ES EL QUE SE DIBUJÓ, PUNTO POR PUNTO (refuerzo §1.5).
 *
 * El camino completo sin hardware: un mapa de 1 bit → los bytes ESC/POS → la impresora falsa
 * que los lee de vuelta → comparar contra el mapa original. Cero puntos de diferencia.
 */

/** Azar con semilla: la misma «imagen» en cada corrida. */
function azar(semilla: number): () => number {
  let estado = semilla >>> 0;
  return () => {
    estado = (Math.imul(estado, 1664525) + 1013904223) >>> 0;
    return estado / 0x1_0000_0000;
  };
}

function mapaAlAzar(ancho: number, alto: number, semilla: number): MapaDeBits {
  const siguiente = azar(semilla);
  const mapa = mapaVacio(ancho, alto);
  for (let i = 0; i < mapa.puntos.length; i += 1) mapa.puntos[i] = siguiente() < 0.35 ? 1 : 0;
  return mapa;
}

const recortar = (mapa: MapaDeBits, alto: number): MapaDeBits => ({
  ancho: mapa.ancho,
  alto,
  puntos: mapa.puntos.slice(0, mapa.ancho * alto),
});

describe('el mapa de 1 bit', () => {
  it('empaqueta ocho puntos por byte, el de la izquierda en el bit alto', () => {
    const mapa = mapaVacio(10, 1);
    mapa.puntos.set([1, 0, 0, 0, 0, 0, 0, 1, 1, 0]);
    expect(Array.from(empaquetarFilas(mapa, 0, 1))).toEqual([0b1000_0001, 0b1000_0000]);
  });

  it('cuenta los puntos distintos y se niega a comparar medidas distintas', () => {
    const a = mapaAlAzar(16, 4, 1);
    const b = { ...a, puntos: a.puntos.slice() };
    expect(puntosDistintos(a, b)).toBe(0);
    b.puntos[5] = b.puntos[5] === 1 ? 0 : 1;
    expect(puntosDistintos(a, b)).toBe(1);
    expect(puntosDistintos(a, mapaVacio(16, 5))).toBeNull();
  });

  it('la vista previa es negro puro sobre blanco', () => {
    const mapa = mapaVacio(2, 1);
    mapa.puntos.set([1, 0]);
    expect(Array.from(aRgba(mapa).datos)).toEqual([0, 0, 0, 255, 255, 255, 255, 255]);
  });
});

describe('de color a 1 bit', () => {
  const imagen = (pixeles: readonly (readonly number[])[], ancho: number): ImagenRgba => ({
    ancho,
    alto: pixeles.length / ancho,
    datos: Uint8ClampedArray.from(pixeles.flat()),
  });

  it('lo transparente es papel', () => {
    expect(luzDelPixel(0, 0, 0, 0)).toBe(255);
    expect(luzDelPixel(0, 0, 0, 255)).toBe(0);
  });

  it('el texto va con umbral: negro o blanco, sin puntos sueltos', () => {
    const gris = (tono: number): number[] => [tono, tono, tono, 255];
    const mapa = aMonocromo(imagen([gris(0), gris(149), gris(150), gris(255)], 4), { umbral: 150 });
    expect(Array.from(mapa.puntos)).toEqual([1, 1, 0, 0]);
  });

  it('el logo va con tramado: un gris medio queda mitad y mitad, y sólo en su zona', () => {
    const ancho = 16;
    const alto = 16;
    const datos = new Uint8ClampedArray(ancho * alto * 4).fill(255);
    for (let i = 0; i < ancho * alto; i += 1) datos.set([128, 128, 128, 255], i * 4);
    const zona = { x: 0, y: 0, ancho: 8, alto };
    const mapa = aMonocromo({ ancho, alto, datos }, { umbral: 100, zonasConTramado: [zona] });
    let dentro = 0;
    let fuera = 0;
    for (let y = 0; y < alto; y += 1) {
      for (let x = 0; x < ancho; x += 1) {
        const punto = mapa.puntos[y * ancho + x] ?? 0;
        if (x < 8) dentro += punto;
        else fuera += punto;
      }
    }
    // Dentro, el gris 128 se reparte en cerca de la mitad de los puntos; fuera, el umbral 100 lo deja blanco.
    expect(dentro).toBeGreaterThan(48);
    expect(dentro).toBeLessThan(80);
    expect(fuera).toBe(0);
  });

  it('rechaza una imagen que no trae cuatro bytes por pixel', () => {
    expect(() => aMonocromo({ ancho: 2, alto: 2, datos: new Uint8ClampedArray(3) })).toThrow(
      RangeError,
    );
  });
});

describe('la imagen en franjas (GS v 0), leída de vuelta punto por punto', () => {
  for (const [ancho, alto, franja] of [
    [384, 301, 64],
    [576, 1000, 64],
    [512, 97, 24],
    [576, 255, 255],
    [380, 50, 7],
  ] as const) {
    it(`${String(ancho)} × ${String(alto)} en franjas de ${String(franja)}: cero puntos distintos`, () => {
      const mapa = mapaAlAzar(ancho, alto, ancho + alto);
      const franjas = imagenEnFranjas(mapa, franja);
      expect(franjas).toHaveLength(Math.ceil(alto / franja));
      const papel = emular(unir(iniciar(), ...franjas), ancho);
      expect(papel.alto).toBe(alto);
      expect(puntosDistintos(papel, mapa)).toBe(0);
    });
  }

  it('ninguna franja pasa del alto pedido', () => {
    const franjas = imagenEnFranjas(mapaAlAzar(384, 100, 9), 32);
    const altos = franjas.map((franja) => (franja[6] ?? 0) | ((franja[7] ?? 0) << 8));
    expect(altos).toEqual([32, 32, 32, 4]);
  });

  it('una imagen más ancha que el papel no se imprime a medias: lanza', () => {
    const franjas = imagenEnFranjas(mapaAlAzar(576, 8, 3), 8);
    expect(() => emular(unir(...franjas), 384)).toThrow(RangeError);
  });
});

describe('la alternativa por columnas (ESC *)', () => {
  it('sale igual, con las filas que sobran de la última banda en blanco', () => {
    const mapa = mapaAlAzar(384, 50, 77);
    const papel = emular(unir(iniciar(), ...imagenPorColumnas(mapa)), 384);
    expect(papel.alto).toBe(72);
    expect(puntosDistintos(recortar(papel, 50), mapa)).toBe(0);
    expect(puntosNegros({ ...papel, puntos: papel.puntos.slice(384 * 50) })).toBe(0);
  });
});

describe('avance, corte y cajón', () => {
  it('el avance va antes del corte y el corte cae donde termina el papel', () => {
    const mapa = mapaAlAzar(384, 10, 5);
    const trabajo = unir(
      iniciar(),
      ...imagenEnFranjas(mapa),
      avanzar(3),
      cortar('parcial-con-avance'),
    );
    const papel = emular(trabajo, 384);
    expect(papel.alto).toBe(10 + 3 * 30);
    expect(papel.cortes).toEqual([{ fila: 100, parcial: true }]);
  });

  it('las cuatro variantes de GS V', () => {
    expect(Array.from(cortar('completo'))).toEqual([0x1d, 0x56, 0]);
    expect(Array.from(cortar('parcial'))).toEqual([0x1d, 0x56, 1]);
    expect(Array.from(cortar('completo-con-avance'))).toEqual([0x1d, 0x56, 65, 0]);
    expect(Array.from(cortar('parcial-con-avance'))).toEqual([0x1d, 0x56, 66, 0]);
    expect(cortar('ninguno')).toHaveLength(0);
  });

  it('el pulso del cajón por el pin 2 y por el 5, con sus tiempos en unidades de 2 ms', () => {
    expect(Array.from(pulsoDelCajon(2))).toEqual([0x1b, 0x70, 0, 25, 250]);
    expect(Array.from(pulsoDelCajon(5, 100, 200))).toEqual([0x1b, 0x70, 1, 50, 100]);
    expect(() => pulsoDelCajon(2, 0, 500)).toThrow(RangeError);
    expect(() => pulsoDelCajon(2, 50, 9999)).toThrow(RangeError);
  });

  it('la impresora falsa cuenta cada pulso, y distingue el de tiempo real', () => {
    const papel = emular(unir(pulsoDelCajon(2), pulsoEnTiempoReal(5)), 384);
    expect(papel.pulsos).toEqual([
      { pin: 2, enTiempoReal: false },
      { pin: 5, enTiempoReal: true },
    ]);
  });

  it('pregunta el estado y lee la respuesta', () => {
    expect(Array.from(pedirEstado(4))).toEqual([0x10, 0x04, 4]);
    expect(leerEstado(4, 0x12)).toEqual({ sinPapel: false });
    expect(leerEstado(4, 0x72)).toEqual({ sinPapel: true });
    expect(leerEstado(2, 0x12 | 0x04)).toEqual({ tapaAbierta: true, sinPapel: false });
    expect(leerEstado(1, 0x12 | 0x08)).toMatchObject({ enLinea: false });
  });
});

describe('la impresora falsa no adivina', () => {
  it('una orden que no conoce es un error, no basura impresa', () => {
    expect(() => emular(Uint8Array.from([0x1b, 0x99]), 384)).toThrow(OrdenDesconocida);
    expect(() => emular(Uint8Array.from([0x07]), 384)).toThrow(OrdenDesconocida);
  });

  it('un trabajo cortado a la mitad es un error', () => {
    const franja = imagenEnFranjas(mapaAlAzar(384, 8, 2), 8)[0] ?? new Uint8Array(0);
    expect(() => emular(franja.subarray(0, franja.length - 5), 384)).toThrow(RangeError);
  });

  it('el texto simple se guarda por renglones', () => {
    const texto = Uint8Array.from([0x48, 0x4f, 0x4c, 0x41, 0x0a]);
    expect(emular(texto, 384).texto).toEqual(['HOLA']);
  });
});
