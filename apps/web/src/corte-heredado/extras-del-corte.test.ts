import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import type { HojaDelServidor } from '../corte/hoja.ts';

import { AVISO_SIN_EXTRAS, leerExtrasDelCorte, seccionesDeLaHoja } from './extras-del-corte.ts';

/**
 * DP-16 (QA-J, H3) · REGISTROS → CORTES → «VER PDF» TRAE LO MISMO QUE EL DOCUMENTO AL CERRAR.
 *
 * El visor de Registros arma su corte aparte (`CorteViewerDialog`) y no traía «Opciones vendidas ·
 * cuánto sumaron» (DP-D104) ni «Retiros con PIN de gerente · quién autorizó» (DP-D101): sólo el
 * documento que sale al cerrar. Ahora el visor lee la hoja del servidor y pinta las mismas
 * secciones; si sólo eso falla, el corte sale igual y lo dice.
 */

const HOJA = {
  opciones: [{ grupo: 'Extras', opcion: 'Queso', veces: '6', importeCentavos: '9000' }],
  retirosConPin: [
    {
      registradoEn: '2026-11-10T15:41:00.000Z',
      quien: 'Caja 2',
      autorizo: 'Gerente',
      motivo: 'Pago a proveedor de tortilla',
      montoCentavos: '65000',
    },
  ],
} as unknown as HojaDelServidor;

describe('las secciones de la hoja que el visor no armaba', () => {
  it('opciones vendidas y retiros con PIN, con los títulos del documento al cerrar', () => {
    const titulos = seccionesDeLaHoja(HOJA).map((s) => s.titulo);
    expect(titulos).toEqual([
      'Opciones vendidas · cuánto sumaron',
      'Retiros con PIN de gerente · quién autorizó',
    ]);
  });

  it('sin opciones ni retiros, ninguna sección (no tablas vacías)', () => {
    expect(seccionesDeLaHoja({} as HojaDelServidor)).toEqual([]);
  });

  it('las lee de la hoja del servidor de ESA caja', async () => {
    const leer = vi.fn().mockResolvedValue(HOJA);
    const extras = await leerExtrasDelCorte('caja-1', leer);
    expect(leer).toHaveBeenCalledWith('caja-1');
    expect(extras.noSePudieronLeer).toBe(false);
    expect(extras.secciones).toHaveLength(2);
  });

  it('si sólo eso falla, el corte sale igual y lo dice (no una lista vacía que parezca «no hubo»)', async () => {
    const registrar = vi.fn();
    const extras = await leerExtrasDelCorte(
      'caja-1',
      () => Promise.reject(new Error('red')),
      registrar,
    );
    expect(extras).toEqual({ secciones: [], noSePudieronLeer: true });
    expect(registrar).toHaveBeenCalledOnce();
    expect(AVISO_SIN_EXTRAS).toMatch(/No se pudieron leer/);
  });
});

describe('el visor de Registros las pinta', () => {
  const RAIZ_WEB = process.cwd().endsWith('web')
    ? process.cwd()
    : join(process.cwd(), 'apps', 'web');
  const sinEspacios = (ruta: string) =>
    readFileSync(join(RAIZ_WEB, ruta), 'utf8')
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
      .replace(/^\s*\/\/.*$/gm, '')
      .replace(/\s+/g, '');

  it('el visor las lee con lo demás y se las pasa al ticket del corte', () => {
    const c = sinEspacios('heredado/components/cortes/CorteViewerDialog.jsx');
    expect(c).toContain('leerExtrasDelCorte(corteId),');
    expect(c).toContain('extras={data.extras}');
  });

  it('el ticket del corte las pinta antes de las firmas', () => {
    const c = sinEspacios('heredado/components/tickets/CorteTicket.jsx');
    expect(c).toContain(
      '{extras?.secciones.map((seccion)=>(<SeccionPintadakey={seccion.titulo}seccion={seccion}/>))}',
    );
    expect(c).toContain('{extras?.noSePudieronLeer===true&&(');
  });
});
