import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import {
  avisoDeLosDescuentosCortados,
  cuentaDelDescuento,
  leerDescuentosDelCorte,
  tituloDeLosDescuentos,
  type DescuentoDelCorte,
} from './descuentos-del-corte';

/**
 * DP-14.2 · El corte heredado lee cada descuento del servidor. Lo que se defiende: que un fallo NO
 * se convierte en «sin descuentos» (la sección lo dice), que la cuenta se nombra como la reconoce
 * quien lee el corte, y que el Cierre del día se titula como tal.
 */

const fila = (cambios: Partial<DescuentoDelCorte> = {}): DescuentoDelCorte => ({
  ordenId: 'orden-1',
  folio: '12',
  mesa: 4,
  montoCentavos: '2000',
  autorizo: 'La Gerente',
  motivo: 'Cliente frecuente',
  cuando: null,
  ...cambios,
});

describe('los descuentos del corte heredado', () => {
  it('leídos: las filas, el total en centavos y de qué hablan', async () => {
    const leidos = await leerDescuentosDelCorte('sesion-1', () =>
      Promise.resolve({ descuentos: [fila()], cuantos: 1, totalCentavos: '2000', alcance: 'dia' }),
    );
    expect(leidos).toEqual({
      filas: [fila()],
      cuantos: 1,
      totalCentavos: 2000,
      alcance: 'dia',
      noSePudieronLeer: false,
    });
  });

  it('si el servidor no contesta, se dice y se registra: no es «sin descuentos»', async () => {
    const registrar = vi.fn();
    const leidos = await leerDescuentosDelCorte(
      'sesion-1',
      () => Promise.reject(new Error('sin red')),
      registrar,
    );
    expect(leidos).toEqual({
      filas: [],
      cuantos: 0,
      totalCentavos: 0,
      alcance: null,
      noSePudieronLeer: true,
    });
    expect(registrar).toHaveBeenCalledTimes(1);
  });

  it('la cuenta es «Mesa 4 · folio 12», y sin mesa ni folio, una raya', () => {
    expect(cuentaDelDescuento(fila())).toBe('Mesa 4 · folio 12');
    expect(cuentaDelDescuento(fila({ mesa: null }))).toBe('folio 12');
    expect(cuentaDelDescuento(fila({ mesa: null, folio: null }))).toBe('—');
  });

  it('el Cierre del día se titula como tal', () => {
    expect(tituloDeLosDescuentos('dia')).toBe('Descuentos del día');
    expect(tituloDeLosDescuentos('caja')).toBe('Descuentos de esta caja');
  });

  it('ronda 2 · si la lista se cortó, el papel lo dice: «se muestran X de N», con el total completo', () => {
    const base = {
      filas: [fila()],
      totalCentavos: 9000,
      alcance: 'dia',
      noSePudieronLeer: false,
    } as const;
    expect(avisoDeLosDescuentosCortados({ ...base, cuantos: 1 })).toBeNull();
    expect(avisoDeLosDescuentosCortados({ ...base, cuantos: 1001 })).toBe(
      'Sólo se muestran 1 de 1001 descuentos; el total del corte los incluye a todos.',
    );
    expect(
      avisoDeLosDescuentosCortados({ ...base, noSePudieronLeer: true, cuantos: 5 }),
    ).toBeNull();
  });
});

/**
 * Ronda 2 (menor) · Y el papel del corte lo pinta: sin esto el aviso existía y nadie lo veía. Pantalla
 * heredada: el contrato lee su texto (se valida mutándolo).
 */
describe('el ticket del corte con la lista de descuentos cortada', () => {
  const ticket = () =>
    readFileSync(
      join(__dirname, '..', '..', 'heredado', 'components', 'tickets', 'CorteTicket.jsx'),
      'utf8',
    );

  it('pinta «Sólo se muestran X de N…» bajo la tabla de los descuentos', () => {
    expect(ticket()).toMatch(
      /import \{[^}]*avisoDeLosDescuentosCortados[^}]*\} from '~\/corte-heredado\/descuentos-del-corte'/,
    );
    expect(ticket()).toMatch(
      /<\/table>\s*(?:\{\/\*[\s\S]*?\*\/\}\s*)?\{avisoDeLosDescuentosCortados\(descuentos\) !== null && \(\s*<p[^>]*>\s*\{avisoDeLosDescuentosCortados\(descuentos\)\}\s*<\/p>\s*\)\}/,
    );
  });
});
