import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import type { CancelacionDelCorte } from '~/corte/cancelaciones';

import {
  AVISO_SIN_CANCELACIONES,
  EXPLICACION_SIN_CANCELACIONES,
  leerCancelacionesSinTrabar,
} from './cancelaciones-sin-trabar';

/**
 * DP-13.4 · Si las cancelaciones fallan, el corte se pinta igual y lo dice en su sección.
 *
 * Los `.jsx` heredados no se pintan en estas pruebas: su contrato lee el texto (modelo:
 * `corte/cancelaciones-heredado.contrato.test.ts`) y la lógica vive aquí, probada de verdad.
 */

const fila = (parte: Partial<CancelacionDelCorte> = {}): CancelacionDelCorte =>
  ({
    tipo: 'orden',
    montoCentavos: '15000',
    perdida: false,
    ...parte,
  }) as CancelacionDelCorte;

describe('leer las cancelaciones sin tumbar el corte', () => {
  it('si el servidor contesta, devuelve las filas tal cual y no registra nada', async () => {
    const filas = [fila(), fila({ tipo: 'linea', perdida: true })];
    const registrar = vi.fn();
    const leidas = await leerCancelacionesSinTrabar(
      () => Promise.resolve({ filas, alcance: 'caja' as const }),
      registrar,
    );
    // DP-13.2: con el alcance del servidor (las de esta caja, o el Cierre del día).
    expect(leidas).toEqual({ filas, alcance: 'caja', noSePudieronLeer: false });
    expect(registrar).not.toHaveBeenCalled();
  });

  it('un corte con cero cancelaciones SÍ se pudo leer (no es lo mismo que fallar)', async () => {
    const leidas = await leerCancelacionesSinTrabar(
      () => Promise.resolve({ filas: [], alcance: 'dia' as const }),
      vi.fn(),
    );
    expect(leidas).toEqual({ filas: [], alcance: 'dia', noSePudieronLeer: false });
  });

  it('si falla, no lanza: dice que no se pudieron leer y deja las filas vacías', async () => {
    const leidas = await leerCancelacionesSinTrabar(
      () => Promise.reject(new Error('503')),
      vi.fn(),
    );
    expect(leidas).toEqual({ filas: [], alcance: null, noSePudieronLeer: true });
  });

  it('si falla, registra el error que causó la falla (una sola vez)', async () => {
    const causa = new Error('El servidor no mandó las cancelaciones con la forma esperada.');
    const registrar = vi.fn();
    await leerCancelacionesSinTrabar(() => Promise.reject(causa), registrar);
    expect(registrar).toHaveBeenCalledTimes(1);
    expect(registrar).toHaveBeenCalledWith(causa);
  });

  it('también cuenta si la lectura lanza al llamarla, no sólo al esperarla', async () => {
    const registrar = vi.fn();
    const leidas = await leerCancelacionesSinTrabar(() => {
      throw new Error('sin red');
    }, registrar);
    expect(leidas.noSePudieronLeer).toBe(true);
    expect(registrar).toHaveBeenCalledTimes(1);
  });

  it('sin registrador propio, el error va a la consola', async () => {
    const consola = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const causa = new Error('timeout');
      await leerCancelacionesSinTrabar(() => Promise.reject(causa));
      expect(consola).toHaveBeenCalledTimes(1);
      expect(consola.mock.calls[0]).toContain(causa);
    } finally {
      consola.mockRestore();
    }
  });
});

describe('lo que dice el corte', () => {
  it('empieza como se pidió y explica qué hacer', () => {
    expect(AVISO_SIN_CANCELACIONES).toBe('No se pudieron leer las cancelaciones');
    expect(EXPLICACION_SIN_CANCELACIONES).toMatch(/no dice si las hubo/);
  });
});

/** El contrato de texto de las tres pantallas heredadas. */
const RAIZ = process.cwd().endsWith('web') ? process.cwd() : join(process.cwd(), 'apps', 'web');
const leer = (ruta: string): string => readFileSync(join(RAIZ, ruta), 'utf8');

const VISOR = 'heredado/components/cortes/CorteViewerDialog.jsx';
const DESCARGA = 'heredado/components/cortes/CorteAutoDownloader.jsx';
const TICKET = 'heredado/components/tickets/CorteTicket.jsx';

describe.each([VISOR, DESCARGA])('%s', (archivo) => {
  it('pide las cancelaciones por el lector que no lanza, con la caja del corte', () => {
    expect(leer(archivo)).toMatch(
      /leerCancelacionesSinTrabar\(\s*\(\)\s*=>\s*cancelacionesDeLaCaja\(\s*corteId\s*\)\s*\)/,
    );
  });

  it('ya no mete la lectura pelada en el Promise.all (un fallo suyo tumbaba el corte)', () => {
    expect(leer(archivo)).not.toMatch(/^\s*cancelacionesDeLaCaja\(corteId\),/m);
  });

  it('le dice al ticket si no se pudieron leer', () => {
    const texto = leer(archivo);
    expect(texto).toMatch(/noSePudieronLeer/);
    expect(texto).toMatch(/cancelacionesNoLeidas=\{data\.cancelacionesNoLeidas\}/);
  });
});

describe('el ticket del corte', () => {
  it('en lugar de la sección dice que no se pudieron leer, con su aviso', () => {
    const texto = leer(TICKET);
    expect(texto).toMatch(/cancelacionesNoLeidas\s*=\s*false/);
    expect(texto).toMatch(/\{cancelacionesNoLeidas \? \(/);
    expect(texto).toMatch(/\{AVISO_SIN_CANCELACIONES\}/);
    expect(texto).toMatch(/\{EXPLICACION_SIN_CANCELACIONES\}/);
    expect(texto).toMatch(/from '~\/corte-heredado\/cancelaciones-sin-trabar'/);
  });

  it('el aviso es una sección con título, no una lista vacía que parezca «sin cancelaciones»', () => {
    expect(leer(TICKET)).toMatch(/<Section title="Cancelaciones">/);
  });

  it('con las cancelaciones leídas sigue pintando las secciones del servidor', () => {
    expect(leer(TICKET)).toMatch(
      /seccionesDeCancelaciones\(\s*cancelaciones\s*,\s*alcanceDeCancelaciones/,
    );
  });
});
