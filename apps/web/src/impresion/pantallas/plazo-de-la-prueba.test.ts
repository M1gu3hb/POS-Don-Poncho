import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PLAZO_PARA_ENVIAR_MS } from '../trabajos.ts';
import { RESULTADO_SIN_RESPUESTA, conPlazoDeSilencio } from './plazo-de-la-prueba.ts';

/**
 * Sobra del lote 1 · La prueba del laboratorio de impresión TIENE PLAZO.
 *
 * `imprimirElementoDePrueba` esperaba a la app sin límite: con la app colgada el botón se quedaba en
 * «Enviando…» para siempre. Ahora usa el MISMO plazo que los trabajos de la Caja
 * (`PLAZO_PARA_ENVIAR_MS`, de SILENCIO: cada aviso de avance lo renueva) y, vencido, dice qué pasó.
 */

const RESUELTA = { ok: true, texto: 'Impreso ✓' } as const;

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('el plazo de silencio', () => {
  it('si la app contesta a tiempo, entrega SU resultado y no deja un reloj vivo', async () => {
    const salida = conPlazoDeSilencio(
      () => Promise.resolve(RESUELTA),
      PLAZO_PARA_ENVIAR_MS,
      () => RESULTADO_SIN_RESPUESTA,
    );
    await expect(salida).resolves.toBe(RESUELTA);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('si la app no contesta, al vencer el plazo falla con un mensaje claro', async () => {
    const salida = conPlazoDeSilencio(
      () => new Promise<never>(() => undefined),
      PLAZO_PARA_ENVIAR_MS,
      () => RESULTADO_SIN_RESPUESTA,
    );
    await vi.advanceTimersByTimeAsync(PLAZO_PARA_ENVIAR_MS - 1);
    // Todavía dentro del plazo: no se ha rendido.
    const antes = await Promise.race([salida, Promise.resolve('esperando')]);
    expect(antes).toBe('esperando');
    await vi.advanceTimersByTimeAsync(1);
    await expect(salida).resolves.toBe(RESULTADO_SIN_RESPUESTA);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('cada aviso de avance de la app renueva el plazo (es de silencio, no de duración)', async () => {
    let renovar: () => void = () => undefined;
    let terminar: (r: typeof RESUELTA) => void = () => undefined;
    const salida = conPlazoDeSilencio(
      (alAvanzar) => {
        renovar = alAvanzar;
        return new Promise<typeof RESUELTA>((resolver) => {
          terminar = resolver;
        });
      },
      PLAZO_PARA_ENVIAR_MS,
      () => RESULTADO_SIN_RESPUESTA,
    );
    // Tres cuartos del plazo, un aviso, otros tres cuartos: sin renovar ya habría vencido.
    await vi.advanceTimersByTimeAsync(PLAZO_PARA_ENVIAR_MS * 0.75);
    renovar();
    await vi.advanceTimersByTimeAsync(PLAZO_PARA_ENVIAR_MS * 0.75);
    terminar(RESUELTA);
    await expect(salida).resolves.toBe(RESUELTA);
  });

  it('lo que la app conteste DESPUÉS de vencido ya no cuenta', async () => {
    let terminar: (r: typeof RESUELTA) => void = () => undefined;
    const salida = conPlazoDeSilencio(
      () =>
        new Promise<typeof RESUELTA>((resolver) => {
          terminar = resolver;
        }),
      PLAZO_PARA_ENVIAR_MS,
      () => RESULTADO_SIN_RESPUESTA,
    );
    await vi.advanceTimersByTimeAsync(PLAZO_PARA_ENVIAR_MS);
    terminar(RESUELTA);
    await expect(salida).resolves.toBe(RESULTADO_SIN_RESPUESTA);
  });

  it('si la app rechaza, el error pasa (no se confunde con «no contestó»)', async () => {
    const salida = conPlazoDeSilencio(
      () => Promise.reject(new Error('se cayó el puente')),
      PLAZO_PARA_ENVIAR_MS,
      () => RESULTADO_SIN_RESPUESTA,
    );
    await expect(salida).rejects.toThrow('se cayó el puente');
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('el mensaje de «no contestó»', () => {
  it('es un fallo, dice cuántos segundos y qué hacer', () => {
    expect(RESULTADO_SIN_RESPUESTA.ok).toBe(false);
    expect(RESULTADO_SIN_RESPUESTA.texto).toContain('no contestó');
    expect(RESULTADO_SIN_RESPUESTA.texto).toContain(`${String(PLAZO_PARA_ENVIAR_MS / 1000)} s`);
    expect(RESULTADO_SIN_RESPUESTA.texto).toContain('reintenta');
  });
});

describe('imprimir-prueba usa ese plazo en sus dos caminos', () => {
  const RAIZ = process.cwd().endsWith('web') ? process.cwd() : join(process.cwd(), 'apps', 'web');
  const fuente = readFileSync(
    join(RAIZ, 'src', 'impresion', 'pantallas', 'imprimir-prueba.ts'),
    'utf8',
  )
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\s+/g, ' ');

  it('el driver (imprimirEnLaApp) y el crudo (app.imprimir) esperan con conPlazoDeSilencio', () => {
    expect(fuente.match(/conPlazoDeSilencio\(/g)).toHaveLength(2);
    expect(fuente).toMatch(/conPlazoDeSilencio\( \(renovar\) => imprimirEnLaApp\(/);
    expect(fuente).toMatch(/conPlazoDeSilencio\( \(\) => app\.imprimir\(/);
  });

  it('el aviso de avance del driver renueva el plazo', () => {
    expect(fuente).toContain('{ id, avanzar: renovar }');
  });

  it('no inventa un plazo propio: usa el de los trabajos de la Caja', () => {
    expect(fuente).toContain('PLAZO_PARA_ENVIAR_MS');
    expect(fuente).not.toMatch(/\d_?\d{3}\s*,?\s*\(\) =>|setTimeout/);
  });
});
