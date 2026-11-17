import { afterEach, describe, expect, it, vi } from 'vitest';

import type {
  ArchivosDeCortes,
  CorteParaGuardar,
  ResultadoDeGuardado,
} from '../../impresion/puente/contrato.ts';

import { guardarCorteEnLaCarpeta, TIEMPO_MAXIMO_DEL_GUARDADO_MS } from './guardar-en-la-carpeta.ts';

/**
 * DP-D153 · GUARDAR EL PDF EN LA CARPETA, con un `window.MorphiqApp` falso. Nunca lanza: o es
 * «guardado» o es un aviso con el motivo, y un guardado que tarda no se espera para siempre.
 */
const PDF = new Blob(['%PDF-1.4\n%%EOF\n'], { type: 'application/pdf' });
const CORTE = { folio: 'DPC-0102', fecha: '2026-11-16', pdf: PDF };

function archivosCon(guardar: (c: CorteParaGuardar) => Promise<ResultadoDeGuardado>) {
  const espia = vi.fn(guardar);
  const archivos: ArchivosDeCortes = {
    guardar: espia,
    abrirCarpeta: async () => ({ ok: true, ruta: 'x' }),
  };
  return { ...archivos, espia };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('guardarCorteEnLaCarpeta', () => {
  it('manda sólo folio, fecha y el PDF en base64 (ni ruta ni nombre) y devuelve dónde quedó', async () => {
    const archivos = archivosCon(async () => ({
      ok: true,
      estado: 'guardado',
      ruta: 'C:\\Docs\\Corte.pdf',
      bytes: 15,
    }));
    const r = await guardarCorteEnLaCarpeta(archivos, CORTE);
    expect(r).toEqual({ ok: true, estado: 'guardado', ruta: 'C:\\Docs\\Corte.pdf' });
    const enviado = archivos.espia.mock.calls[0]?.[0];
    expect(Object.keys(enviado ?? {}).sort()).toEqual(['base64', 'fecha', 'folio']);
    expect(enviado?.folio).toBe('DPC-0102');
    expect(enviado?.fecha).toBe('2026-11-16');
    expect(atob(enviado?.base64 ?? '').startsWith('%PDF-')).toBe(true);
  });

  it('guardar otra vez («ya-estaba», «reemplazado») también es guardado', async () => {
    for (const estado of ['ya-estaba', 'reemplazado'] as const) {
      const archivos = archivosCon(async () => ({ ok: true, estado, ruta: 'r', bytes: 1 }));
      expect(await guardarCorteEnLaCarpeta(archivos, CORTE)).toEqual({
        ok: true,
        estado,
        ruta: 'r',
      });
    }
  });

  it('si la app dice que no pudo, el aviso lleva SU motivo', async () => {
    const archivos = archivosCon(async () => ({
      ok: false,
      codigo: 'NO_SE_PUDO',
      mensaje: 'El archivo está abierto en otro programa.',
    }));
    expect(await guardarCorteEnLaCarpeta(archivos, CORTE)).toEqual({
      ok: false,
      mensaje: 'El archivo está abierto en otro programa.',
    });
  });

  it('si la promesa se rechaza (ORIGEN, mal uso, lo que sea), vuelve un aviso, no una excepción', async () => {
    for (const rechazo of [
      { name: 'ORIGEN', codigo: 'ORIGEN', message: 'Esta página no puede usar la app.' },
      new Error('boom'),
      undefined,
    ]) {
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
      const archivos = archivosCon(() => Promise.reject(rechazo));
      const r = await guardarCorteEnLaCarpeta(archivos, CORTE);
      expect(r.ok).toBe(false);
      expect(!r.ok && r.mensaje.length > 0).toBe(true);
    }
  });

  it('si guardar lanza de golpe (no es promesa), también vuelve un aviso', async () => {
    const archivos: ArchivosDeCortes = {
      guardar: () => {
        throw new Error('sync');
      },
      abrirCarpeta: async () => ({ ok: true, ruta: 'x' }),
    };
    expect((await guardarCorteEnLaCarpeta(archivos, CORTE)).ok).toBe(false);
  });

  it('si tarda más del plazo, avisa que tardó y NO espera más', async () => {
    vi.useFakeTimers();
    const archivos = archivosCon(() => new Promise<ResultadoDeGuardado>(() => undefined));
    let resultado: unknown = 'pendiente';
    void guardarCorteEnLaCarpeta(archivos, CORTE).then((r) => {
      resultado = r;
    });
    await vi.advanceTimersByTimeAsync(TIEMPO_MAXIMO_DEL_GUARDADO_MS - 1);
    expect(resultado).toBe('pendiente');
    await vi.advanceTimersByTimeAsync(2);
    expect(resultado).toMatchObject({ ok: false });
    expect(JSON.stringify(resultado)).toMatch(/tard/);
  });

  it('si guardó a tiempo, el plazo queda cancelado (no deja relojes vivos)', async () => {
    vi.useFakeTimers();
    const archivos = archivosCon(async () => ({
      ok: true,
      estado: 'guardado',
      ruta: 'r',
      bytes: 1,
    }));
    await guardarCorteEnLaCarpeta(archivos, CORTE);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('un PDF que no se puede leer vuelve un aviso', async () => {
    const archivos = archivosCon(async () => ({
      ok: true,
      estado: 'guardado',
      ruta: 'r',
      bytes: 1,
    }));
    const malo = { arrayBuffer: () => Promise.reject(new Error('x')) } as unknown as Blob;
    const r = await guardarCorteEnLaCarpeta(archivos, { ...CORTE, pdf: malo });
    expect(r.ok).toBe(false);
    expect(archivos.espia).not.toHaveBeenCalled();
  });
});
