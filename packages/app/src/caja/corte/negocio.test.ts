import { describe, expect, it } from 'vitest';

import { negocioDe } from './documento.ts';

/** El encabezado del corte, y la tasa de la terminal con la que se estima su comisión. */
const SUCURSAL = { sucursalDireccion: 'Av. Siempre Viva 1', sucursalTelefono: '5555555555' };

describe('negocioDe', () => {
  it('la tasa de la terminal viaja al corte cuando el negocio la declaró (C.10 de la 2.4)', () => {
    expect(negocioDe('Café', { comision_terminal_bp: 360 }, SUCURSAL).comisionTerminalBp).toBe(360);
  });

  it('sin tasa, o con una que no es tasa, el corte no estima nada', () => {
    expect(negocioDe('Café', {}, SUCURSAL).comisionTerminalBp).toBeNull();
    expect(
      negocioDe('Café', { comision_terminal_bp: '360' }, SUCURSAL).comisionTerminalBp,
    ).toBeNull();
    expect(
      negocioDe('Café', { comision_terminal_bp: 5_000 }, SUCURSAL).comisionTerminalBp,
    ).toBeNull();
  });

  it('el texto legal y el pie de los PDF salen juntos en el pie del corte; sin ninguno, no hay pie', () => {
    expect(negocioDe('Café', { footer_text: 'RFC ABC850101AB1' }, SUCURSAL).pie).toBe(
      'RFC ABC850101AB1',
    );
    expect(negocioDe('Café', { pdf_footer: 'Confidencial' }, SUCURSAL).pie).toBe('Confidencial');
    expect(
      negocioDe('Café', { footer_text: 'Texto legal', pdf_footer: 'Confidencial' }, SUCURSAL).pie,
    ).toBe('Texto legal · Confidencial');
    expect(negocioDe('Café', { footer_text: '  ' }, SUCURSAL).pie).toBeNull();
  });
});
