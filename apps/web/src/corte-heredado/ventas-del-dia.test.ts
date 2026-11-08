import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { celdasDelDia, leerVentasDelDia, type VentasDelDiaLeidas } from './ventas-del-dia.ts';

/**
 * DP-15 · QA de la jornada, J-H6 · El Cierre del día del corte heredado dice las ventas del día.
 * La lectura y las celdas, y el cableado del papel y de sus dos diálogos (contrato de texto).
 */

const DIA: VentasDelDiaLeidas = {
  cajas: 2,
  tickets: 14,
  totalCentavos: '407715',
  propinasCentavos: '32751',
  metodos: [
    { metodo: 'efectivo', ventasCentavos: '300000' },
    { metodo: 'tarjeta', ventasCentavos: '107715' },
  ],
};

describe('las ventas del día del corte heredado', () => {
  it('las lee del servidor; sin corte no pregunta', async () => {
    expect(await leerVentasDelDia('s1', () => Promise.resolve(DIA))).toEqual(DIA);
    expect(await leerVentasDelDia(null, () => Promise.reject(new Error('no')))).toBeNull();
  });

  it('si la lectura falla, el PDF sale sin ellas y el fallo se registra', async () => {
    const fallos: unknown[] = [];
    const leidas = await leerVentasDelDia(
      's1',
      () => Promise.reject(new Error('se cayó')),
      (e) => fallos.push(e),
    );
    expect(leidas).toBeNull();
    expect(fallos).toHaveLength(1);
  });

  it('las celdas: el total del día, los tickets, las cajas, cada método y las propinas', () => {
    expect(celdasDelDia(DIA)).toEqual([
      { etiqueta: 'Total ventas', pesos: 4077.15, fuerte: true },
      { etiqueta: 'N° tickets', texto: '14' },
      { etiqueta: 'Cajas', texto: '2' },
      { etiqueta: 'Efectivo', pesos: 3000 },
      { etiqueta: 'Tarjeta', pesos: 1077.15 },
      { etiqueta: 'Propinas', pesos: 327.51 },
    ]);
  });

  const RAIZ = process.cwd().endsWith('web') ? process.cwd() : join(process.cwd(), 'apps', 'web');
  const sinEspacios = (ruta: string) =>
    readFileSync(join(RAIZ, ruta), 'utf8')
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
      .replace(/^\s*\/\/.*$/gm, '')
      .replace(/\s+/g, '');

  it('el papel las pinta cuando el corte cierra el día, y el resumen dice que es de esta caja', () => {
    const papel = sinEspacios('heredado/components/tickets/CorteTicket.jsx');
    expect(papel).toContain('{ventasDelDia&&(<Sectiontitle={TITULO_DEL_DIA}>');
    expect(papel).toContain('celdasDelDia(ventasDelDia).map(');
    expect(papel).toContain("ventasDelDia?'Resumendeestacaja'");
  });

  it('los dos diálogos que arman el PDF las leen y se las pasan al papel', () => {
    for (const ruta of [
      'heredado/components/cortes/CorteViewerDialog.jsx',
      'heredado/components/cortes/CorteAutoDownloader.jsx',
    ]) {
      const c = sinEspacios(ruta);
      expect(c, ruta).toContain('leerVentasDelDia(corteId)');
      expect(c, ruta).toContain('ventasDelDia={');
    }
  });
});
