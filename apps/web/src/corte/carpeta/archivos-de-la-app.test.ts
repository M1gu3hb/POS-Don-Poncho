import { describe, expect, it, vi } from 'vitest';

import type { ArchivosDeCortes, MorphiqApp } from '../../impresion/puente/contrato.ts';

import {
  abrirLaCarpetaDeCortes,
  archivosDeLaApp,
  archivosDeLaVentana,
} from './archivos-de-la-app.ts';

/**
 * DP-D153 · ¿ESTA PÁGINA PUEDE GUARDAR LOS CORTES EN LA CARPETA?
 *
 * Sólo dentro de la app de Windows 1.0.2 o más nueva, que lo ANUNCIA (`capacidades` con
 * `'archivos'`) y trae `archivos`. En un navegador, en la app 1.0.1 o en Android no existe nada de
 * eso, y la página sigue como hoy: descarga normal y sin botones nuevos.
 */

const archivosFalsos = (): ArchivosDeCortes => ({
  guardar: vi.fn(async () => ({
    ok: true as const,
    estado: 'guardado' as const,
    ruta: 'C:\\x.pdf',
    bytes: 1,
  })),
  abrirCarpeta: vi.fn(async () => ({ ok: true as const, ruta: 'C:\\Cortes' })),
});

/** Una app «con la forma» que pide cada caso; lo que no se nombra, no existe. */
const appCon = (forma: Record<string, unknown>): MorphiqApp =>
  ({ contrato: 1, ...forma }) as unknown as MorphiqApp;

describe('archivosDeLaApp: sólo con la capacidad anunciada y el objeto completo', () => {
  it('la app 1.0.2 (capacidades + archivos) → los usa', () => {
    const archivos = archivosFalsos();
    expect(archivosDeLaApp(appCon({ capacidades: ['archivos'], archivos }))).toBe(archivos);
  });

  it('sin app (navegador o PWA) → nada', () => {
    expect(archivosDeLaApp(null)).toBeNull();
    expect(archivosDeLaApp(undefined)).toBeNull();
  });

  it('la app 1.0.1 (ni capacidades ni archivos) → nada', () => {
    expect(archivosDeLaApp(appCon({}))).toBeNull();
  });

  it('un objeto «archivos» SIN anunciar la capacidad no vale (la capacidad es la que manda)', () => {
    expect(archivosDeLaApp(appCon({ archivos: archivosFalsos() }))).toBeNull();
    expect(archivosDeLaApp(appCon({ capacidades: [], archivos: archivosFalsos() }))).toBeNull();
    expect(
      archivosDeLaApp(appCon({ capacidades: ['otra'], archivos: archivosFalsos() })),
    ).toBeNull();
  });

  it('la capacidad anunciada pero con el objeto roto o incompleto → nada, sin lanzar', () => {
    const roto = [
      { capacidades: ['archivos'] },
      { capacidades: ['archivos'], archivos: null },
      { capacidades: ['archivos'], archivos: {} },
      { capacidades: ['archivos'], archivos: { guardar: () => undefined } },
      { capacidades: ['archivos'], archivos: { abrirCarpeta: () => undefined } },
      { capacidades: ['archivos'], archivos: { guardar: 'x', abrirCarpeta: 'y' } },
      { capacidades: 'archivos', archivos: archivosFalsos() },
    ];
    for (const forma of roto)
      expect(archivosDeLaApp(appCon(forma)), JSON.stringify(Object.keys(forma))).toBeNull();
  });

  it('por la ventana: sólo si el puente es del contrato 1 (otro contrato no se entiende)', () => {
    const archivos = archivosFalsos();
    expect(
      archivosDeLaVentana({ MorphiqApp: { contrato: 1, capacidades: ['archivos'], archivos } }),
    ).toBe(archivos);
    expect(
      archivosDeLaVentana({ MorphiqApp: { contrato: 2, capacidades: ['archivos'], archivos } }),
    ).toBeNull();
    expect(archivosDeLaVentana({})).toBeNull();
    expect(archivosDeLaVentana(undefined)).toBeNull();
  });
});

describe('abrirLaCarpetaDeCortes: nunca lanza y no manda ninguna ruta', () => {
  it('abre y devuelve la ruta; la llamada va SIN argumentos', async () => {
    const abrirCarpeta = vi.fn(async () => ({ ok: true as const, ruta: 'C:\\Cortes' }));
    expect(await abrirLaCarpetaDeCortes({ ...archivosFalsos(), abrirCarpeta })).toEqual({
      ok: true,
      ruta: 'C:\\Cortes',
    });
    expect(abrirCarpeta.mock.calls).toEqual([[]]);
  });

  it('si la app dice que no pudo, se ve el motivo', async () => {
    const archivos: ArchivosDeCortes = {
      ...archivosFalsos(),
      abrirCarpeta: async () => ({
        ok: false,
        codigo: 'NO_SE_PUDO',
        mensaje: 'No se pudo abrir la carpeta de cortes.',
      }),
    };
    expect(await abrirLaCarpetaDeCortes(archivos)).toEqual({
      ok: false,
      mensaje: 'No se pudo abrir la carpeta de cortes.',
    });
  });

  it('si la promesa se rechaza (objeto plano del puente o Error), vuelve un resultado', async () => {
    for (const rechazo of [
      { name: 'ORIGEN', codigo: 'ORIGEN', message: 'Esta página no puede usar la app.' },
      new Error('boom'),
      'texto',
      undefined,
    ]) {
      // El puente rechaza con objetos planos y la página no controla qué llega: se prueba con lo que sea.
      const archivos: ArchivosDeCortes = {
        ...archivosFalsos(),
        // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
        abrirCarpeta: () => Promise.reject(rechazo),
      };
      const r = await abrirLaCarpetaDeCortes(archivos);
      expect(r.ok).toBe(false);
      expect(!r.ok && r.mensaje.length > 0).toBe(true);
    }
  });
});
