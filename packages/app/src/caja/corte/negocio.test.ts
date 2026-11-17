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

  it('descargar_pdf_corte_auto: el PDF del corte se baja solo al cerrar, salvo que el negocio lo apague (DP-22)', () => {
    expect(negocioDe('Café', {}, SUCURSAL).descargarAlCerrar).toBe(true);
    expect(negocioDe('Café', { descargar_pdf_corte_auto: true }, SUCURSAL).descargarAlCerrar).toBe(
      true,
    );
    expect(negocioDe('Café', { descargar_pdf_corte_auto: false }, SUCURSAL).descargarAlCerrar).toBe(
      false,
    );
  });

  it('el encabezado del corte lleva el nombre, la dirección, el teléfono, el correo, el logo y la marca del negocio (DP-22)', () => {
    const negocio = negocioDe(
      'Café',
      {
        direccion: 'Calle Rosal 12',
        telefono: '55 2468 1357',
        correo: 'hola@cafe.example',
        logo_pdf_url: 'https://x.example/pdf.png',
        logo_url: 'https://x.example/logo.png',
        platform_brand: 'Mi Sistema',
      },
      SUCURSAL,
    );
    expect(negocio).toMatchObject({
      nombre: 'Café',
      direccion: 'Calle Rosal 12',
      telefono: '55 2468 1357',
      correo: 'hola@cafe.example',
      logoUrl: 'https://x.example/pdf.png',
      marca: 'Mi Sistema',
    });
    // Sin logo de los PDF, el del negocio; sin dirección ni teléfono, los de la sucursal.
    const sin = negocioDe('Café', { logo_url: 'https://x.example/logo.png' }, SUCURSAL);
    expect(sin.logoUrl).toBe('https://x.example/logo.png');
    expect(sin.direccion).toBe('Av. Siempre Viva 1');
    expect(sin.telefono).toBe('5555555555');
    expect(sin.marca).toBe('POS Don Poncho');
  });
});
