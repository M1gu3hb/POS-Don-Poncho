import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';

import { describe, expect, it } from 'vitest';

import { cajonVacio, esperadoDelCajon } from '../bots/caja-cobro.ts';
import { pngSolido } from '../pantallas/png.ts';
import { dinero, pesos } from '../pantallas/comun.ts';
import { asegurarPin, pinNuevo, pinValido } from './pines.ts';
import { MESAS_EN_TOTAL, MESAS_NUEVAS, PRODUCTOS_DE_PRUEBA, USUARIOS } from './datos.ts';

describe('los PIN de prueba', () => {
  it('rechaza repetidos y escaleras, y siempre son de 4 cifras', () => {
    for (const malo of ['1111', '0123', '1234', '12', 'abcd', '12345'])
      expect(pinValido(malo), malo).toBe(false);
    expect(pinValido('4721')).toBe(true);
  });

  it('nunca repite uno usado y sale de la semilla (mismo nombre, mismo PIN)', () => {
    const usados = new Set(['4721']);
    const a = pinNuevo(usados, 'Mesero 3');
    expect(a).toBe(pinNuevo(usados, 'Mesero 3'));
    expect(usados.has(a)).toBe(false);
    expect(pinValido(a)).toBe(true);
  });

  it('es idempotente: la segunda vez devuelve el mismo PIN y no lo marca nuevo', () => {
    const carpeta = mkdtempSync(join(tmpdir(), 'pines-'));
    try {
      const archivo = join(carpeta, 'pines.json');
      writeFileSync(archivo, JSON.stringify({ Gerente: '3902' }));
      const uno = asegurarPin(archivo, 'Mesero 3');
      const dos = asegurarPin(archivo, 'Mesero 3');
      expect(uno.nuevo).toBe(true);
      expect(dos).toEqual({ pin: uno.pin, nuevo: false });
      expect(uno.pin).not.toBe('3902');
      expect(JSON.parse(readFileSync(archivo, 'utf8'))).toMatchObject({
        Gerente: '3902',
        'Mesero 3': uno.pin,
      });
    } finally {
      rmSync(carpeta, { recursive: true, force: true });
    }
  });
});

describe('lo que el día 0 promete', () => {
  it('deja 6 meseros, 3 cajeras y un cocinero por estación nueva, con 20 mesas y 10 productos de un tipo cada uno', () => {
    const nuevos = (puesto: string) => USUARIOS.filter((u) => u.puesto === puesto).length;
    expect(2 + nuevos('Mesero')).toBe(6);
    expect(2 + nuevos('Cajero')).toBe(3);
    expect(USUARIOS.filter((u) => u.estacion !== undefined).map((u) => u.estacion)).toEqual([
      'Parrilla',
      'Postres',
      'Pulques',
    ]);
    expect(10 + MESAS_NUEVAS.length).toBe(MESAS_EN_TOTAL);
    expect(PRODUCTOS_DE_PRUEBA).toHaveLength(10);
    expect(new Set(PRODUCTOS_DE_PRUEBA.map((p) => p.tipo)).size).toBe(10);
  });

  it('las opciones traen precios positivos y negativos, y un grupo obligatorio con mínimo y máximo', () => {
    const grupos = PRODUCTOS_DE_PRUEBA.flatMap((p) => p.grupos);
    const deltas = grupos.flatMap((g) => g.opciones.map((o) => o.deltaPesos));
    expect(deltas.some((d) => d > 0)).toBe(true);
    expect(deltas.some((d) => d < 0)).toBe(true);
    expect(grupos.some((g) => g.tipo === 'unica' && g.obligatorio)).toBe(true);
    expect(
      grupos.some((g) => g.tipo === 'multiple' && g.minimo !== undefined && g.maximo !== undefined),
    ).toBe(true);
  });
});

describe('el cajón del libro', () => {
  it('fondo + efectivo + entradas − retiros − gastos', () => {
    const c = {
      ...cajonVacio(80_000),
      efectivoNetoCentavos: 123_450,
      entradasCentavos: 30_000,
      retirosCentavos: 60_000,
      gastosCentavos: 5_000,
    };
    expect(esperadoDelCajon(c)).toBe(80_000 + 123_450 + 30_000 - 60_000 - 5_000);
  });

  it('los pesos se teclean con dos decimales y se leen con miles', () => {
    expect(pesos(123_450)).toBe('1234.50');
    expect(dinero(123_450)).toBe('$1,234.50');
    expect(dinero(5)).toBe('$0.05');
  });
});

describe('el PNG de prueba', () => {
  it('es un PNG válido del tamaño pedido y de un solo color', () => {
    const png = pngSolido(8, 4, [196, 120, 60]);
    expect([...png.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(png.readUInt32BE(16)).toBe(8);
    expect(png.readUInt32BE(20)).toBe(4);
    const idat = png.indexOf('IDAT');
    const largo = png.readUInt32BE(idat - 4);
    const pixeles = inflateSync(png.subarray(idat + 4, idat + 4 + largo));
    expect(pixeles).toHaveLength(4 * (1 + 8 * 3));
    expect([...pixeles.subarray(1, 4)]).toEqual([196, 120, 60]);
  });
});
