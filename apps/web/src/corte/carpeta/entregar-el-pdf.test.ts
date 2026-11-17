import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ArchivosDeCortes, ResultadoDeGuardado } from '../../impresion/puente/contrato.ts';

import {
  entregarElPdfDelCorte,
  entregarSinEsperar,
  type Entrega,
  type PedidoDeEntrega,
} from './entregar-el-pdf.ts';

/**
 * DP-D153 · ¿DESCARGA O CARPETA? Con la app 1.0.2 el PDF va a la carpeta; en un navegador o con la
 * 1.0.1 va EXACTAMENTE por donde iba (la misma función de descarga, sin tocar nada). Un guardado que
 * falla NO cae a una descarga a escondidas: se avisa y se reintenta.
 */
const PDF = new Blob(['%PDF-1.4\n%%EOF\n']);
const DATOS = { folio: 'DPC-0102', fecha: '2026-11-16' };

function entorno(guardar: () => Promise<ResultadoDeGuardado>) {
  const espia = vi.fn(guardar);
  const archivos: ArchivosDeCortes = {
    guardar: espia,
    abrirCarpeta: async () => ({ ok: true, ruta: 'x' }),
  };
  const generar = vi.fn(async () => PDF);
  const descargar = vi.fn(async () => undefined);
  return { archivos, guardar: espia, generar, descargar };
}
const BIEN = async (): Promise<ResultadoDeGuardado> => ({
  ok: true,
  estado: 'guardado',
  ruta: 'C:\\Cortes\\a.pdf',
  bytes: 1,
});

afterEach(() => {
  vi.useRealTimers();
});

describe('entregarElPdfDelCorte', () => {
  it('con la app (capacidad de archivos): se guarda en la carpeta y NO se descarga', async () => {
    const e = entorno(BIEN);
    const r = await entregarElPdfDelCorte({
      archivos: e.archivos,
      datos: DATOS,
      generar: e.generar,
      descargar: e.descargar,
    });
    expect(r).toEqual({ via: 'carpeta', ok: true, estado: 'guardado', ruta: 'C:\\Cortes\\a.pdf' });
    expect(e.descargar).not.toHaveBeenCalled();
    expect(e.guardar).toHaveBeenCalledTimes(1);
  });

  it('sin app o con la 1.0.1 (archivos = null): descarga normal y nada se genera aparte', async () => {
    const e = entorno(BIEN);
    const r = await entregarElPdfDelCorte({
      archivos: null,
      datos: DATOS,
      generar: e.generar,
      descargar: e.descargar,
    });
    expect(r).toEqual({ via: 'descarga' });
    expect(e.descargar).toHaveBeenCalledTimes(1);
    expect(e.generar).not.toHaveBeenCalled();
    expect(e.guardar).not.toHaveBeenCalled();
  });

  it('la descarga que falla sigue fallando como hoy (el que llama ya la maneja)', async () => {
    const e = entorno(BIEN);
    const descargar = vi.fn(() => Promise.reject(new Error('el navegador no dejó')));
    await expect(
      entregarElPdfDelCorte({ archivos: null, datos: DATOS, generar: e.generar, descargar }),
    ).rejects.toThrow('el navegador no dejó');
  });

  it('guardar que falla: aviso con el motivo, SIN descarga a escondidas', async () => {
    const e = entorno(async () => ({
      ok: false,
      codigo: 'NO_SE_PUDO',
      mensaje: 'El archivo está abierto en otro programa.',
    }));
    const r = await entregarElPdfDelCorte({
      archivos: e.archivos,
      datos: DATOS,
      generar: e.generar,
      descargar: e.descargar,
    });
    expect(r).toEqual({
      via: 'carpeta',
      ok: false,
      mensaje: 'El archivo está abierto en otro programa.',
    });
    expect(e.descargar).not.toHaveBeenCalled();
  });

  it('si no se pudo armar el PDF, aviso (no excepción) y no se le pide nada a la app', async () => {
    const e = entorno(BIEN);
    const generar = vi.fn(() => Promise.reject(new Error('html2canvas')));
    const r = await entregarElPdfDelCorte({
      archivos: e.archivos,
      datos: DATOS,
      generar,
      descargar: e.descargar,
    });
    expect(r).toMatchObject({ via: 'carpeta', ok: false });
    expect(e.guardar).not.toHaveBeenCalled();
  });
});

describe('entregarSinEsperar: el cierre no espera al guardado', () => {
  it('vuelve al instante aunque guardar no termine; el resultado llega después', async () => {
    let terminar: (r: ResultadoDeGuardado) => void = () => undefined;
    const e = entorno(
      () =>
        new Promise<ResultadoDeGuardado>((resolver) => {
          terminar = resolver;
        }),
    );
    const llegadas: Entrega[] = [];
    // Se mira como «lo que devuelve»: tiene que ser nada (no una promesa que alguien pueda esperar).
    const pedido: PedidoDeEntrega = {
      archivos: e.archivos,
      datos: DATOS,
      generar: e.generar,
      descargar: e.descargar,
    };
    // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression -- justo lo que se prueba: no devuelve nada
    const devuelto = Reflect.apply(entregarSinEsperar, undefined, [
      pedido,
      (x: Entrega) => {
        llegadas.push(x);
      },
    ]) as unknown;
    expect(devuelto).toBeUndefined();
    expect(llegadas).toEqual([]);
    await vi.waitFor(() => {
      expect(e.guardar).toHaveBeenCalled();
    });
    expect(llegadas).toEqual([]);
    terminar({ ok: true, estado: 'guardado', ruta: 'r', bytes: 1 });
    await vi.waitFor(() => {
      expect(llegadas).toEqual([{ via: 'carpeta', ok: true, estado: 'guardado', ruta: 'r' }]);
    });
  });

  it('un guardado que nunca contesta termina en aviso por el plazo, sin colgar nada', async () => {
    vi.useFakeTimers();
    const e = entorno(() => new Promise<ResultadoDeGuardado>(() => undefined));
    const llegadas: Entrega[] = [];
    entregarSinEsperar(
      { archivos: e.archivos, datos: DATOS, generar: e.generar, descargar: e.descargar },
      (x) => {
        llegadas.push(x);
      },
    );
    await vi.advanceTimersByTimeAsync(60_000);
    expect(llegadas).toHaveLength(1);
    expect(llegadas[0]).toMatchObject({ via: 'carpeta', ok: false });
  });

  it('una descarga que falla en segundo plano no revienta: llega como aviso', async () => {
    const e = entorno(BIEN);
    const llegadas: Entrega[] = [];
    entregarSinEsperar(
      {
        archivos: null,
        datos: DATOS,
        generar: e.generar,
        descargar: () => Promise.reject(new Error('x')),
      },
      (x) => {
        llegadas.push(x);
      },
    );
    await vi.waitFor(() => {
      expect(llegadas).toHaveLength(1);
    });
    expect(llegadas[0]).toMatchObject({ via: 'descarga', ok: false });
  });
});
