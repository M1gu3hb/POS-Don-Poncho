import { describe, expect, it } from 'vitest';

import { emular } from './emulador.ts';
import { mapaVacio, puntosDistintos, type MapaDeBits } from './mapa.ts';
import {
  cajonPorOmision,
  describirDestino,
  exportarPerfil,
  importarPerfil,
  leerPerfil,
  perfilPorOmision,
  type PerfilDeImpresion,
} from './perfil.ts';
import {
  aBase64,
  aHexadecimal,
  armarAperturaDelCajon,
  armarTrabajo,
  deBase64,
  nuevoIdDeTrabajo,
} from './trabajo.ts';

/**
 * DP-20 · EL TRABAJO COMPLETO, EN LA IMPRESORA FALSA: las copias, el avance antes del corte y
 * el cajón UNA sola vez (refuerzo §3 y §1.4).
 */

function dibujo(ancho: number, alto: number, paso: number): MapaDeBits {
  const mapa = mapaVacio(ancho, alto);
  for (let i = 0; i < mapa.puntos.length; i += paso) mapa.puntos[i] = 1;
  return mapa;
}

const perfil80 = (cambios: Partial<PerfilDeImpresion> = {}): PerfilDeImpresion => ({
  ...perfilPorOmision(80, { conexion: 'red', host: '192.168.1.50', puerto: 9100 }),
  ...cambios,
});

describe('el trabajo', () => {
  it('una copia: la imagen exacta, el avance y el corte al final', () => {
    const perfil = perfil80({ lineasAntesDelCorte: 4 });
    const mapa = dibujo(576, 120, 7);
    const papel = emular(armarTrabajo(perfil, [mapa]), 576);
    expect(papel.alto).toBe(120 + 4 * 30);
    expect(
      puntosDistintos({ ...papel, alto: 120, puntos: papel.puntos.slice(0, 576 * 120) }, mapa),
    ).toBe(0);
    expect(papel.cortes).toEqual([{ fila: 240, parcial: true }]);
    expect(papel.pulsos).toEqual([]);
  });

  it('dos copias: dos cortes, y el cajón se abre UNA sola vez', () => {
    const perfil = perfil80({ cajon: cajonPorOmision(), lineasAntesDelCorte: 2 });
    const original = dibujo(576, 40, 5);
    const copia = dibujo(576, 44, 3);
    const papel = emular(armarTrabajo(perfil, [original, copia], { abrirCajon: true }), 576);
    expect(papel.cortes).toHaveLength(2);
    expect(papel.pulsos).toEqual([{ pin: 2, enTiempoReal: false }]);
    expect(papel.alto).toBe(40 + 60 + 44 + 60);
  });

  it('sin cajón en el perfil no se manda ningún pulso aunque se pida', () => {
    const papel = emular(armarTrabajo(perfil80(), [dibujo(576, 8, 2)], { abrirCajon: true }), 576);
    expect(papel.pulsos).toEqual([]);
  });

  it('sin cortador: avanza y no corta', () => {
    const papel = emular(armarTrabajo(perfil80({ corte: 'ninguno' }), [dibujo(576, 8, 2)]), 576);
    expect(papel.cortes).toEqual([]);
    expect(papel.alto).toBe(8 + 4 * 30);
  });

  it('por columnas (ESC *) sale la misma imagen', () => {
    const perfil = perfil80({
      lenguaje: 'escpos-columnas',
      lineasAntesDelCorte: 0,
      corte: 'ninguno',
    });
    const mapa = dibujo(576, 48, 11);
    const papel = emular(armarTrabajo(perfil, [mapa]), 576);
    expect(puntosDistintos(papel, mapa)).toBe(0);
  });

  it('una imagen más ancha que la impresora no se manda', () => {
    const perfil = perfil80({ puntos: 512 });
    expect(() => armarTrabajo(perfil, [dibujo(576, 8, 2)])).toThrow(RangeError);
    expect(() => armarTrabajo(perfil, [])).toThrow(RangeError);
  });

  it('«Abrir cajón»: sólo el pulso, por el pin del perfil o en tiempo real', () => {
    expect(emular(armarAperturaDelCajon({ ...cajonPorOmision(), pin: 5 }), 576).pulsos).toEqual([
      { pin: 5, enTiempoReal: false },
    ]);
    expect(
      emular(armarAperturaDelCajon({ ...cajonPorOmision(), modo: 'tiempo-real' }), 576).pulsos,
    ).toEqual([{ pin: 2, enTiempoReal: true }]);
  });
});

describe('los bytes cruzan el puente en base64', () => {
  it('ida y vuelta sin perder un byte, también con trabajos grandes', () => {
    const datos = Uint8Array.from({ length: 100_000 }, (_, i) => (i * 31) & 0xff);
    expect(Array.from(deBase64(aBase64(datos)))).toEqual(Array.from(datos));
  });

  it('el hexadecimal del laboratorio: 16 por renglón y un tope', () => {
    expect(aHexadecimal(Uint8Array.from([0x1b, 0x40, 0xff]))).toBe('000000  1b 40 ff');
    expect(aHexadecimal(new Uint8Array(40), 16)).toMatch(/… 24 bytes más$/);
  });

  it('cada trabajo trae su id', () => {
    expect(nuevoIdDeTrabajo('ticket')).toMatch(/^ticket-[0-9a-f-]{36}$/);
    expect(nuevoIdDeTrabajo('ticket')).not.toBe(nuevoIdDeTrabajo('ticket'));
  });
});

describe('el perfil del aparato', () => {
  it('por omisión: 576 puntos en 80 mm, 384 en 58, imagen ESC/POS', () => {
    expect(perfil80()).toMatchObject({ puntos: 576, lenguaje: 'escpos-imagen', dpi: 203 });
    expect(perfilPorOmision(58, { conexion: 'usb', vendorId: 1, productId: 2 }).puntos).toBe(384);
    expect(perfilPorOmision(80, { conexion: 'driver', nombre: 'POS-80' }).lenguaje).toBe('driver');
  });

  it('se exporta y se importa igual en otro POS', () => {
    const perfil = perfil80({ nombre: 'Caja 1', cajon: cajonPorOmision(), puntos: 512 });
    const importado = importarPerfil(exportarPerfil(perfil));
    expect(importado).toEqual({ ok: true, perfil });
  });

  it('rechaza lo que no es un perfil, diciendo por qué', () => {
    expect(importarPerfil('hola')).toMatchObject({ ok: false });
    expect(importarPerfil('{"tipo":"otra-cosa"}')).toMatchObject({ ok: false });
    const roto = JSON.stringify({
      tipo: 'morphiq-perfil-de-impresion',
      perfil: { ...perfil80(), puntos: 5 },
    });
    expect(importarPerfil(roto)).toEqual({
      ok: false,
      motivo: 'El perfil trae un dato que no se entiende (puntos).',
    });
  });

  it('lo guardado que ya no es válido no se usa', () => {
    expect(leerPerfil(null)).toBeNull();
    expect(leerPerfil({ ...perfil80(), corte: 'con-tijeras' })).toBeNull();
    expect(leerPerfil(perfil80())).toEqual(perfil80());
  });

  it('dice la impresora para una persona', () => {
    expect(describirDestino({ conexion: 'red', host: '10.0.0.9' })).toBe('Red 10.0.0.9:9100');
    expect(describirDestino({ conexion: 'spooler', nombre: 'POS-80' })).toBe(
      'POS-80 · directo (RAW)',
    );
    expect(describirDestino({ conexion: 'bluetooth', direccion: '00:11:22:33:44:55' })).toBe(
      'Bluetooth 00:11:22:33:44:55',
    );
  });
});
