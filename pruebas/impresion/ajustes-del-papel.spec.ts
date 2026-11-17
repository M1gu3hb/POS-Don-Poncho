import { expect, test, type Page } from '@playwright/test';

import { leerArnes } from './empaquetar.ts';

/**
 * DP-22 · EL EFECTO DE CADA AJUSTE DE PAPEL, UNO POR UNO.
 *
 * La auditoría pide que cada ajuste de Configuración tenga una prueba que demuestre su efecto. Estos
 * son los que acaban en el papel: el ticket y la precuenta (`PreCuentaTicket`, el MISMO componente
 * que la app manda a la impresora) y el corte en hoja (`CorteTicket`, el de los PDF). Cada prueba
 * cambia UN ajuste, mira lo que se dibuja y, lo que importa, también el caso contrario: sin el
 * ajuste, el papel no lo dice. Así una lectura que ignore el ajuste hace caer la prueba por los dos
 * lados (el mutante de cada una está en el informe de la corrida).
 *
 * Sin servidor ni base: el arnés (`arnes.jsx`) carga los componentes en una página en blanco.
 */

type Configuracion = Record<string, unknown>;

interface Montado {
  readonly ancho: number;
  readonly texto: string;
}

interface DelTicket {
  readonly puntos: number;
  readonly logos: readonly (string | null)[];
}

interface DelCorte {
  readonly texto: string;
  readonly logos: readonly (string | null)[];
}

interface Arnes {
  montar(caso: { papelMm: 58 | 80; conLogo: boolean; config?: Configuracion }): Promise<Montado>;
  ticketMontado(): DelTicket;
  montarCorte(config: Configuracion): DelCorte;
}

/** Un PNG de un punto: un logo que carga sin red. */
const LOGO_A =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const LOGO_B =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const guion = leerArnes();

async function abrir(page: Page): Promise<void> {
  await page.setViewportSize({ width: 900, height: 700 });
  await page.setContent('<!doctype html><html lang="es"><body style="margin:0"></body></html>');
  await page.addScriptTag({ content: guion });
}

/** El ticket con la configuración de base del arnés y el ajuste (o los ajustes) que se cambian. */
async function ticket(
  page: Page,
  config: Configuracion,
  papelMm: 58 | 80 = 80,
): Promise<Montado & DelTicket> {
  return page.evaluate(
    async (datos) => {
      const arnes = (window as unknown as { arnes: Arnes }).arnes;
      const montado = await arnes.montar({
        papelMm: datos.papelMm,
        conLogo: false,
        config: datos.config,
      });
      return { ...montado, ...arnes.ticketMontado() };
    },
    { papelMm, config },
  );
}

const corte = (page: Page, config: Configuracion): Promise<DelCorte> =>
  page.evaluate((c) => (window as unknown as { arnes: Arnes }).arnes.montarCorte(c), config);

test.describe('el ticket y la precuenta', () => {
  test.beforeEach(async ({ page }) => {
    await abrir(page);
  });

  test('ancho_papel_ticket: 58 mm dibuja 384 puntos y 80 mm, 576', async ({ page }) => {
    // El papel del aparato se deja en 80: lo que cambia el dibujo es el AJUSTE del negocio.
    const angosto = await ticket(page, { ancho_papel_ticket: 58 });
    expect(angosto.puntos).toBe(384);
    expect(angosto.ancho).toBe(384);
    const ancho = await ticket(page, { ancho_papel_ticket: 80 });
    expect(ancho.puntos).toBe(576);
    expect(ancho.ancho).toBe(576);
    // Un valor que no es un rollo conocido vale lo de siempre (80), no un ancho inventado.
    const raro = await ticket(page, { ancho_papel_ticket: 63 });
    expect(raro.puntos).toBe(576);
  });

  test('mensaje_ticket: el mensaje del negocio cierra el ticket; vacío, el de siempre', async ({
    page,
  }) => {
    const con = await ticket(page, { mensaje_ticket: 'Gracias, vuelva pronto a la barbacoa' });
    expect(con.texto).toContain('Gracias, vuelva pronto a la barbacoa');
    expect(con.texto).not.toContain('¡Gracias por tu visita!');
    const sin = await ticket(page, { mensaje_ticket: '' });
    expect(sin.texto).toContain('¡Gracias por tu visita!');
  });

  test('ticket_footer: el pie del ticket sale debajo del mensaje; vacío, no sale nada', async ({
    page,
  }) => {
    const con = await ticket(page, { ticket_footer: 'Factura en 72 horas con tu folio' });
    expect(con.texto).toContain('Factura en 72 horas con tu folio');
    expect(con.texto.indexOf('Factura en 72 horas')).toBeGreaterThan(
      con.texto.indexOf('¡Gracias por tu visita'),
    );
    const sin = await ticket(page, { ticket_footer: '' });
    expect(sin.texto).not.toContain('Factura en 72 horas');
  });

  test('nombre_negocio: encabezado del ticket; sin nombre, el de la casa', async ({ page }) => {
    const con = await ticket(page, { nombre_negocio: 'Barbacoa La Güera' });
    expect(con.texto).toContain('Barbacoa La Güera');
    expect(con.texto).not.toContain('Don Poncho');
    const sin = await ticket(page, { nombre_negocio: '' });
    expect(sin.texto).toContain('Don Poncho');
  });

  test('direccion y telefono: salen en el encabezado si están escritos y no salen si están vacíos', async ({
    page,
  }) => {
    const con = await ticket(page, {
      direccion: 'Calle Rosal 12, Atemoaya',
      telefono: '55 2468 1357',
    });
    expect(con.texto).toContain('Calle Rosal 12, Atemoaya');
    expect(con.texto).toContain('Tel: 55 2468 1357');
    const sin = await ticket(page, { direccion: '', telefono: '' });
    expect(sin.texto).not.toContain('Calle Rosal');
    expect(sin.texto).not.toContain('Tel:');
  });

  test('logo_ticket_url y mostrar_logo_ticket: el logo del ticket sale, el interruptor lo quita y, sin logo propio, vale el del negocio', async ({
    page,
  }) => {
    const propio = await ticket(page, {
      mostrar_logo_ticket: true,
      logo_ticket_url: LOGO_A,
      logo_url: LOGO_B,
    });
    expect(propio.logos).toEqual([LOGO_A]);

    // Sin logo del ticket, el logo del negocio ocupa su lugar.
    const delNegocio = await ticket(page, {
      mostrar_logo_ticket: true,
      logo_ticket_url: '',
      logo_url: LOGO_B,
    });
    expect(delNegocio.logos).toEqual([LOGO_B]);

    // «No llevar logo» gana sobre los dos.
    const apagado = await ticket(page, {
      mostrar_logo_ticket: false,
      logo_ticket_url: LOGO_A,
      logo_url: LOGO_B,
    });
    expect(apagado.logos).toEqual([]);

    // Sin ninguno, ni hueco ni imagen rota.
    const ninguno = await ticket(page, {
      mostrar_logo_ticket: true,
      logo_ticket_url: '',
      logo_url: '',
    });
    expect(ninguno.logos).toEqual([]);
  });
});

test.describe('el corte en hoja y los PDF', () => {
  test.beforeEach(async ({ page }) => {
    await abrir(page);
  });

  test('nombre_negocio, direccion, telefono y correo: el encabezado del corte los dice y calla los vacíos', async ({
    page,
  }) => {
    const con = await corte(page, {
      nombre_negocio: 'Barbacoa La Güera',
      direccion: 'Calle Rosal 12, Atemoaya',
      telefono: '55 2468 1357',
      correo: 'hola@laguera.example',
    });
    expect(con.texto).toContain('Barbacoa La Güera');
    expect(con.texto).toContain('Calle Rosal 12, Atemoaya');
    expect(con.texto).toContain('Tel: 55 2468 1357');
    expect(con.texto).toContain('hola@laguera.example');

    const sin = await corte(page, { nombre_negocio: '', direccion: '', telefono: '', correo: '' });
    expect(sin.texto).toContain('Don Poncho');
    expect(sin.texto).not.toContain('Calle Rosal');
    expect(sin.texto).not.toContain('Tel:');
    expect(sin.texto).not.toContain('@');
  });

  test('logo_pdf_url y logo_url: el corte lleva el logo de los PDF y, sin él, el del negocio', async ({
    page,
  }) => {
    expect((await corte(page, { logo_pdf_url: LOGO_A, logo_url: LOGO_B })).logos).toEqual([LOGO_A]);
    expect((await corte(page, { logo_pdf_url: '', logo_url: LOGO_B })).logos).toEqual([LOGO_B]);
    expect((await corte(page, { logo_pdf_url: '', logo_url: '' })).logos).toEqual([]);
  });

  test('platform_brand: la firma de plataforma sale bajo el folio; la marca anterior se lee como el producto', async ({
    page,
  }) => {
    // El pie lleva `nombre_sistema` (o, sin él, la marca): se fija uno para que la marca sólo pueda salir del encabezado.
    const propia = await corte(page, {
      platform_brand: 'Cocina de Doña Lupe',
      nombre_sistema: 'Sistema de la casa',
    });
    expect(propia.texto).toContain('Cocina de Doña Lupe');
    const vacia = await corte(page, { platform_brand: '', nombre_sistema: 'Sistema de la casa' });
    expect(vacia.texto).toContain('POS Don Poncho');
    expect(vacia.texto).not.toContain('Cocina de Doña Lupe');
  });

  test('pdf_footer: el pie de los PDF sale al final del corte; vacío, no sale', async ({
    page,
  }) => {
    const con = await corte(page, { pdf_footer: 'Documento sin valor fiscal' });
    expect(con.texto).toContain('Documento sin valor fiscal');
    const sin = await corte(page, { pdf_footer: '' });
    expect(sin.texto).not.toContain('Documento sin valor fiscal');
  });

  test('nombre_sistema: firma «Documento interno · …» al pie del corte; vacío, el nombre del producto', async ({
    page,
  }) => {
    const propio = await corte(page, { nombre_sistema: 'Sistema de la Güera', platform_brand: '' });
    expect(propio.texto).toContain('Documento interno · Sistema de la Güera');
    const vacio = await corte(page, { nombre_sistema: '', platform_brand: '' });
    expect(vacio.texto).toContain('Documento interno · POS Don Poncho');
  });
});
