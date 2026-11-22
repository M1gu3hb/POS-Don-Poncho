import { describe, expect, it } from 'vitest';

import { seccionesDeLaHoja } from '../corte-heredado/extras-del-corte.ts';
import type { HojaDelServidor, PagoDeLaHoja } from './hoja.ts';
import { TITULO_DE_PAGOS, pagosUnoPorUno } from './pagos-uno-por-uno.ts';

const pago = (cambios: Partial<PagoDeLaHoja>): PagoDeLaHoja => ({
  id: 'p',
  metodo: 'tarjeta',
  montoCentavos: '0',
  propinaCentavos: '0',
  recibidoCentavos: null,
  cambioCentavos: '0',
  estado: 'confirmado',
  creadoEn: '2026-11-21T20:00:00.000Z',
  ...cambios,
});

const hojaCon = (ventas: { folio: string; pagos?: PagoDeLaHoja[] | null }[]) =>
  ({ ventas }) as unknown as HojaDelServidor;

describe('el corte lista cada pago, por separado', () => {
  it('una venta con dos tarjetas y efectivo: tres renglones con su folio, la propina de cada uno y lo recibido del efectivo', () => {
    const [seccion] = pagosUnoPorUno(
      hojaCon([
        {
          folio: 'DP-1005',
          pagos: [
            pago({ id: 'a', montoCentavos: '20000', creadoEn: '2026-11-21T20:00:01.000Z' }),
            pago({ id: 'b', montoCentavos: '10000', creadoEn: '2026-11-21T20:00:02.000Z' }),
            pago({
              id: 'c',
              metodo: 'efectivo',
              montoCentavos: '16400',
              propinaCentavos: '5640',
              recibidoCentavos: '50000',
              cambioCentavos: '27960',
              creadoEn: '2026-11-21T20:00:03.000Z',
            }),
          ],
        },
      ]),
    );
    expect(seccion?.titulo).toBe(TITULO_DE_PAGOS);
    if (seccion?.tipo !== 'tabla') throw new Error('se esperaba una tabla');
    expect(seccion.filas).toHaveLength(3);
    const textos = seccion.filas.map((fila) => JSON.stringify(fila));
    expect(textos[0]).toContain('Tarjeta 1');
    expect(textos[1]).toContain('Tarjeta 2');
    expect(textos[2]).toContain('Efectivo');
    expect(textos.every((t) => t.includes('DP-1005'))).toBe(true);
    // Lo recibido y el cambio sólo en el efectivo; la tarjeta dice «—».
    expect(textos[0]).toContain('—');
    expect(textos[2]).toContain('50000');
    expect(textos[2]).toContain('27960');
    expect(textos[2]).toContain('5640');
  });

  it('el visor del corte de Registros (las secciones extra del heredado) también los lista', () => {
    const titulos = seccionesDeLaHoja(
      hojaCon([{ folio: 'DP-7', pagos: [pago({ id: 'a', montoCentavos: '1000' })] }]),
    ).map((s) => s.titulo);
    expect(titulos).toContain(TITULO_DE_PAGOS);
  });

  it('sin pagos (o un servidor viejo que no los manda) la sección no sale', () => {
    expect(pagosUnoPorUno(hojaCon([{ folio: 'DP-1', pagos: null }, { folio: 'DP-2' }]))).toEqual(
      [],
    );
  });
});
