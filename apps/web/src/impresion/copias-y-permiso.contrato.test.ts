import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { ponerCopiasParaElNavegador } from './copias-en-el-navegador.ts';
import {
  darPermiso,
  TEXTO_PERMISO_CONCEDIDO,
  TEXTO_PERMISO_NEGADO,
  TEXTO_PERMISO_SIN_RESPUESTA,
} from './permiso-de-la-impresora.ts';
import { crearMesaDeTrabajos, falloDelPuente } from './trabajos.ts';

/**
 * DP-24 · Parte 6 · Contrato de las COPIAS en todos los caminos y del botón del PERMISO.
 *
 * Lee el código real (se valida mutándolo): ningún camino de impresión toma las copias de una
 * variable guardada, y el aviso de `SIN_PERMISO` trae el botón grande sin contraseña.
 */

const RAIZ = process.cwd().endsWith('web') ? process.cwd() : join(process.cwd(), 'apps', 'web');
const leer = (ruta: string): string => readFileSync(join(RAIZ, ruta), 'utf8');

describe('las copias se leen al imprimir, en TODOS los caminos', () => {
  it('la app (Windows y Android) las lee con la función compartida, no de una variable', () => {
    const imprimir = leer('src/impresion/imprimir-documento.ts');
    expect(imprimir).toMatch(/await copiasAlImprimir\(\)/);
    expect(imprimir).not.toMatch(/copiasDelNegocio|recordarCopias/);
  });

  it('el diálogo del navegador (print.js) también', () => {
    const print = leer('heredado/lib/print.js');
    expect(print).toMatch(/await ponerCopiasParaElNavegador\(/);
    expect(leer('src/impresion/copias-en-el-navegador.ts')).toMatch(/await copiasAlImprimir\(\)/);
  });

  it('no queda ninguna copia guardada en una variable del módulo ni una consulta que la llene', () => {
    expect(leer('src/impresion/copias.ts')).not.toMatch(
      /recordarCopias|copiasDelNegocio|let delNegocio/,
    );
    const barra = leer('src/impresion/BarraDeImpresion.tsx');
    expect(barra).not.toMatch(/recordarCopias|copias_de_impresion|useQuery/);
  });

  it('la función compartida pregunta al servidor y no se queda con staleTime', () => {
    const f = leer('src/impresion/copias-al-imprimir.ts');
    expect(f).toMatch(/consultarPuente[^;]*'ConfiguracionNegocio'/s);
    expect(f).not.toMatch(/staleTime/);
  });
});

describe('copias en el diálogo del navegador', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function hojaFalsa(): Record<string, unknown> {
    const hijos: unknown[] = [];
    const hoja: Record<string, unknown> = {
      hijos,
      style: { setProperty: () => undefined } as Record<string, unknown>,
      append: (nodo: unknown) => hijos.push(nodo),
      cloneNode: () => hojaFalsa(),
      after: () => undefined,
      remove: () => undefined,
    };
    return hoja;
  }

  it('2 copias del ticket = el original y un clon con su pie, cada uno en su página', async () => {
    const creados: string[] = [];
    vi.stubGlobal('document', {
      createElement: () => ({
        style: {},
        setAttribute: () => undefined,
        textContent: '',
      }),
    });
    vi.stubGlobal('localStorage', undefined);
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              ok: true,
              datos: [{ copias_de_impresion: { ticket: 2, precuenta: 1, corte: 1 } }],
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          ),
        ),
      ),
    );
    const original = hojaFalsa();
    const clon = hojaFalsa();
    let clonados = 0;
    original['cloneNode'] = () => {
      clonados += 1;
      return clon;
    };
    original['after'] = (nodo: unknown) => creados.push(nodo === clon ? 'clon' : 'otro');
    const quitar = await ponerCopiasParaElNavegador(original as never, 'ticket', 80);
    // Si el formato de la respuesta del puente cambiara, el clon no se crearía y esto avisa.
    expect(clonados).toBe(1);
    expect(creados).toEqual(['clon']);
    expect((clon['style'] as Record<string, unknown>)['breakBefore']).toBe('page');
    expect((original['hijos'] as unknown[]).length).toBe(1);
    expect((clon['hijos'] as unknown[]).length).toBe(1);
    quitar();
  });
});

describe('«Dar permiso a la impresora»', () => {
  it('concedido: dice «Permiso concedido ✓»', async () => {
    expect(await darPermiso(() => Promise.resolve({ concedido: true }))).toEqual({
      concedido: true,
      texto: TEXTO_PERMISO_CONCEDIDO,
    });
    expect(TEXTO_PERMISO_CONCEDIDO).toBe('Permiso concedido ✓');
  });

  it('negado: dice por qué (el de la app, o uno por omisión)', async () => {
    expect(
      await darPermiso(() => Promise.resolve({ concedido: false, mensaje: 'Revisa el cable.' })),
    ).toEqual({ concedido: false, texto: 'Revisa el cable.' });
    expect(await darPermiso(() => Promise.resolve({ concedido: false }))).toEqual({
      concedido: false,
      texto: TEXTO_PERMISO_NEGADO,
    });
  });

  it('si el puente rechaza, no lanza: lo dice', async () => {
    const rechazo = { codigo: 'ORIGEN', message: 'Esta página no puede usar la app.' };
    expect(await darPermiso(() => Promise.reject(rechazo))).toEqual({
      concedido: false,
      texto: 'Esta página no puede usar la app.',
    });
    expect(await darPermiso(() => Promise.reject(new Error('')))).toEqual({
      concedido: false,
      texto: TEXTO_PERMISO_SIN_RESPUESTA,
    });
  });

  it('un fallo SIN_PERMISO del puente es el que trae el botón', () => {
    expect(falloDelPuente('SIN_PERMISO', undefined).codigo).toBe('SIN_PERMISO');
    expect(falloDelPuente('SIN_PERMISO', undefined).queHacer).toMatch(/Dar permiso a la impresora/);
  });

  it('el botón sólo sale con SIN_PERMISO, mide 56 px, no pide contraseña y reintenta la misma impresión', () => {
    const barra = leer('src/impresion/BarraDeImpresion.tsx');
    expect(barra).toMatch(
      /estado\.fallo\.codigo === 'SIN_PERMISO' && salidas\.darPermiso !== undefined/,
    );
    expect(barra).toMatch(/Dar permiso a la impresora/);
    expect(barra).toMatch(/min-h-\[3\.5rem\]/);
    expect(barra).toMatch(/if \(resultado\.concedido\) MESA_DE_TRABAJOS\.reintentar\(clave\)/);
    expect(barra).not.toMatch(/proveedor|contrase/i);
  });

  it('el permiso que se pide es el de la impresora del perfil del aparato', () => {
    const imprimir = leer('src/impresion/imprimir-documento.ts');
    expect(imprimir).toMatch(/darPermiso: pedirElPermisoDe\(app, perfil\.destino\)/);
    expect(leer('src/impresion/permiso-de-la-impresora.ts')).toMatch(
      /app\.pedirPermiso\(destino\)/,
    );
  });

  it('reintentar tras el permiso repite el MISMO trabajo (mismo id) y lleva el aviso de copias', async () => {
    const mesa = crearMesaDeTrabajos();
    const ids: string[] = [];
    let intento = 0;
    await mesa.lanzar(
      'ticket:1',
      () => `id-${String(ids.length + 1)}`,
      (controles) => {
        ids.push(controles.id);
        intento += 1;
        return Promise.resolve(
          intento === 1
            ? { ok: false as const, fallo: falloDelPuente('SIN_PERMISO', undefined) }
            : { ok: true as const, estado: 'impreso' as const, aviso: 'sin lectura' },
        );
      },
    );
    expect(mesa.leer('ticket:1').fallo?.codigo).toBe('SIN_PERMISO');
    mesa.reintentar('ticket:1');
    await vi.waitFor(() => {
      expect(mesa.leer('ticket:1').fase).toBe('impreso');
    });
    expect(ids).toEqual(['id-1', 'id-1']);
    expect(mesa.leer('ticket:1').aviso).toBe('sin lectura');
  });
});
