import { ROLES } from '@morphiqpos/contracts';
import { describe, expect, it } from 'vitest';

import {
  MARGEN_DE_RENOVACION_SEGUNDOS,
  claseDeSesion,
  nuevaExpiracion,
  politicaDeSesion,
} from './politica.ts';

/**
 * DP-21 · Bloque 2 · CUÁNTO VIVE UNA SESIÓN, POR PUESTO (M14, O10 y A18).
 *
 * Antes: 8 h para todos, con cookie persistente. Al reabrir la app el administrador entraba sin
 * PIN, y a las 16:00 la jornada (8:00 a 19:00) le pedía el PIN a todos a media tarde.
 */
const MINUTO = 60;
const HORA = 60 * MINUTO;

describe('claseDeSesion', () => {
  it('quien manda: dueño, administrador y gerente', () => {
    expect(claseDeSesion('dueno')).toBe('mando');
    expect(claseDeSesion('administrador')).toBe('mando');
    expect(claseDeSesion('gerente')).toBe('mando');
  });

  it('quien toca dinero o inventario sin mandar: cajero y almacén', () => {
    expect(claseDeSesion('cajero')).toBe('caja');
    expect(claseDeSesion('almacen')).toBe('caja');
  });

  it('las estaciones: mesero y cocina', () => {
    expect(claseDeSesion('mesero')).toBe('estacion');
    expect(claseDeSesion('cocina')).toBe('estacion');
  });

  it('todo rol del sistema tiene su clase, y un rol nuevo cae en la más estricta', () => {
    for (const rol of ROLES) {
      expect(['mando', 'caja', 'estacion']).toContain(claseDeSesion(rol));
    }
    expect(claseDeSesion('inventado' as never)).toBe('mando');
  });
});

describe('politicaDeSesion', () => {
  it('mando: cookie de sesión, 30 minutos en el servidor que se renuevan, 12 h de tope', () => {
    expect(politicaDeSesion('administrador')).toEqual({
      clase: 'mando',
      cookieRecordada: false,
      vigenciaSegundos: 30 * MINUTO,
      seRenueva: true,
      topeSegundos: 12 * HORA,
    });
    expect(politicaDeSesion('dueno').vigenciaSegundos).toBe(30 * MINUTO);
    expect(politicaDeSesion('gerente').cookieRecordada).toBe(false);
  });

  it('cajero: cookie de sesión, la jornada entera (12 h) sin renovar', () => {
    expect(politicaDeSesion('cajero')).toEqual({
      clase: 'caja',
      cookieRecordada: false,
      vigenciaSegundos: 12 * HORA,
      seRenueva: false,
      topeSegundos: 12 * HORA,
    });
  });

  it('mesero y cocina: se recuerdan, 12 h que se renuevan con el uso', () => {
    for (const rol of ['mesero', 'cocina'] as const) {
      const politica = politicaDeSesion(rol);
      expect(politica.clase).toBe('estacion');
      expect(politica.cookieRecordada).toBe(true);
      expect(politica.vigenciaSegundos).toBe(12 * HORA);
      expect(politica.seRenueva).toBe(true);
      // El tope es de la cookie y del token: la vigencia de verdad es la del servidor.
      expect(politica.topeSegundos).toBeGreaterThanOrEqual(24 * HORA);
    }
  });

  it('ninguna vigencia pasa de su tope', () => {
    for (const rol of ROLES) {
      const { vigenciaSegundos, topeSegundos } = politicaDeSesion(rol);
      expect(vigenciaSegundos).toBeLessThanOrEqual(topeSegundos);
    }
  });
});

describe('nuevaExpiracion (la renovación con el uso)', () => {
  const ahora = new Date('2026-11-16T14:00:00Z');
  const enSegundos = (s: number): Date => new Date(ahora.getTime() + s * 1000);

  it('el mando que sigue usando el sistema corre su vencimiento a 30 minutos de ahora', () => {
    const renovada = nuevaExpiracion({
      rol: 'administrador',
      ahora,
      expiraEn: enSegundos(10 * MINUTO),
      topeDelToken: enSegundos(8 * HORA),
    });
    expect(renovada).toEqual(enSegundos(30 * MINUTO));
  });

  it('no se escribe en cada petición: si correría menos de un minuto, nada', () => {
    const casiIgual = enSegundos(30 * MINUTO - MARGEN_DE_RENOVACION_SEGUNDOS + 1);
    expect(
      nuevaExpiracion({
        rol: 'administrador',
        ahora,
        expiraEn: casiIgual,
        topeDelToken: enSegundos(8 * HORA),
      }),
    ).toBeNull();
    // Y justo en el margen, sí.
    expect(
      nuevaExpiracion({
        rol: 'administrador',
        ahora,
        expiraEn: enSegundos(30 * MINUTO - MARGEN_DE_RENOVACION_SEGUNDOS),
        topeDelToken: enSegundos(8 * HORA),
      }),
    ).toEqual(enSegundos(30 * MINUTO));
  });

  it('nunca pasa del tope del token: al final de las 12 h el mando vuelve a teclear su PIN', () => {
    const tope = enSegundos(5 * MINUTO);
    expect(
      nuevaExpiracion({
        rol: 'dueno',
        ahora,
        expiraEn: enSegundos(2 * MINUTO),
        topeDelToken: tope,
      }),
    ).toEqual(tope);
  });

  it('el cajero no se renueva: su jornada son 12 h desde el PIN', () => {
    expect(
      nuevaExpiracion({
        rol: 'cajero',
        ahora,
        expiraEn: enSegundos(1 * HORA),
        topeDelToken: enSegundos(11 * HORA),
      }),
    ).toBeNull();
  });

  it('el mesero que sigue trabajando corre su vencimiento a 12 h de ahora', () => {
    expect(
      nuevaExpiracion({
        rol: 'mesero',
        ahora,
        expiraEn: enSegundos(3 * HORA),
        topeDelToken: enSegundos(6 * 24 * HORA),
      }),
    ).toEqual(enSegundos(12 * HORA));
  });

  it('una renovación nunca ACORTA una sesión (las de antes del cambio duraban 8 h)', () => {
    expect(
      nuevaExpiracion({
        rol: 'administrador',
        ahora,
        expiraEn: enSegundos(7 * HORA),
        topeDelToken: enSegundos(7 * HORA),
      }),
    ).toBeNull();
  });
});
