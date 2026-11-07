import { describe, expect, it, vi } from 'vitest';

import {
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
      Promise.resolve({ descuentos: [fila()], totalCentavos: '2000', alcance: 'dia' }),
    );
    expect(leidos).toEqual({
      filas: [fila()],
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
    expect(leidos).toEqual({ filas: [], totalCentavos: 0, alcance: null, noSePudieronLeer: true });
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
});
