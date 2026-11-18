import type { Browser, Page, TestInfo } from '@playwright/test';

import { dialogoDeLaMesa, laMesa, yaAbierto } from '../ayudantes/mesas-heredadas.ts';
import { Equipo, opcionesDelProyecto, type RolDePrueba } from '../ayudantes/roles.ts';
import {
  cabecerasDeEscrituraDePrueba,
  consultarPuente,
  entradaDe,
  exigirDemostracion,
} from '../ayudantes/sesion.ts';

import type { Aparato } from './arnes/aparatos.ts';
import { Barrido, type Conocido } from './arnes/barrido.ts';
import { navegadorDe } from './arnes/ligero.ts';
import { expect, exigirServidor, test } from './arnes/prueba.ts';
import { toque } from './arnes/toque.ts';
import { vigilarPagina } from './arnes/vigilancia.ts';

/**
 * EL BARRIDO DE LAS PANTALLAS DE SERVICIO (DP-22 · Parte 6). En cada aparato, con TOQUE de verdad y
 * entrando con el PIN de prueba de cada puesto, recorre lo que se usa en el turno: la entrada con
 * PIN, la Caja (cerrada, recién abierta, con carrito, con el cobro abierto), el salón del mesero
 * (plano, cuenta abierta, selector de platillos, un platillo con modificadores), Cocina (vacía y con
 * comandas), Para llevar y el corte y el cierre de caja.
 *
 * En cada pantalla y estado corre `revisarPantalla` (scroll horizontal, texto cortado, tocables
 * encimados, tarjetas de igual alto, 44 px por componente, axe, consola y red) y guarda la captura
 * en `qa/qa-final/capturas/<pantalla>/<aparato>/<estado>.png`. Cada prueba termina en rojo, con
 * TODA la lista, si algo quedó sin explicar.
 *
 * Corre en serie y en ORDEN: la primera prueba deja el día en blanco (reseteo de la base
 * desechable); la de la Caja abre la caja; la del mesero manda comandas que la de Cocina ve.
 */

const SLUG = 'prueba-restaurante';
const MESA = 1;
const GRUPO = 'Temperatura';
const OPCION = 'Bien fría';
const CERVEZA = 'Cerveza clara 355 ml';
const GUACAMOLE = 'Guacamole con totopos';
const FONDO_PESOS = '1500.00';

/**
 * LO CONOCIDO que esta tanda NO arregla, con su razón. No tumba la prueba, pero sale en la salida
 * como `[conocido]`; lo que no esté aquí sí la tumba.
 */
const CONOCIDOS: readonly Conocido[] = [
  {
    patron:
      /caja · pestana-movimientos · \[campos-desalineados\] input#(turno-contado|turno-notas)/,
    razon:
      'Severidad baja. «Entregar el turno» y «Retirar» son dos tarjetas lado a lado con descripciones de distinto largo (3 y 2 renglones) y campos de distinta altura (CampoDeDinero y CampoDePesos): sus campos no quedan a la misma altura. Alinearlos pide una cuadrícula con subfilas (`subgrid`) o igualar descripciones: `src/venta/CorteDeTurno.tsx` y `RetiroDeCaja.tsx`. Se reporta, no se arregla en esta tanda.',
  },
];

// En orden (un worker), pero una prueba que cae no salta a las demás: cada pantalla cuenta.

/** Un comando del servidor con la sesión de la página. */
async function comando(page: Page, ruta: string, datos: Record<string, unknown>) {
  const respuesta = await page.request.post(ruta, {
    headers: cabecerasDeEscrituraDePrueba(),
    data: datos,
    timeout: 120_000,
  });
  return { estado: respuesta.status(), texto: await respuesta.text() };
}

/** La cerveza clara pide su temperatura (opción obligatoria): el «platillo con modificadores». */
async function pedirTemperaturaEnLaCerveza(duena: Page): Promise<void> {
  const [cerveza] = await consultarPuente<{ id: string }>(duena, 'ProductoTerminado', {
    filtro: { nombre: CERVEZA },
    limite: 1,
  });
  expect(cerveza, 'La siembra no trae la cerveza clara.').toBeDefined();
  const { estado, texto } = await comando(duena, '/api/catalogo/modificadores', {
    productoId: cerveza?.id ?? '',
    grupos: [{ nombre: GRUPO, obligatorio: true, opciones: [{ nombre: OPCION }] }],
  });
  expect(estado, `modificadores: ${texto.slice(0, 200)}`).toBe(200);
}

test.describe('el barrido de servicio', () => {
  test.use({ actionTimeout: 30_000, navigationTimeout: 60_000 });

  test.beforeAll(async ({ playwright }, info) => {
    await exigirServidor(info.project.use.baseURL);
    await exigirDemostracion(playwright, info, SLUG);
  });

  let equipo: Equipo | null = null;
  const equipoDe = (browser: Browser, aparato: Aparato): Equipo => {
    equipo ??= new Equipo(navegadorDe(browser, aparato), SLUG);
    return equipo;
  };
  test.afterAll(async () => {
    await equipo?.cerrar();
    equipo = null;
  });

  /** La página del puesto, con PIN de prueba, vigilada y ya en su ruta. */
  async function irA(
    browser: Browser,
    aparato: Aparato,
    info: TestInfo,
    rol: RolDePrueba,
    ruta: string,
  ): Promise<Page> {
    const pagina = await equipoDe(browser, aparato).pagina(info, rol);
    pagina.setDefaultTimeout(30_000);
    vigilarPagina(pagina);
    await pagina.goto(ruta, { waitUntil: 'domcontentloaded' });
    await expect(pagina.locator('main')).toBeVisible({ timeout: 60_000 });
    await expect(pagina.getByRole('heading', { level: 1 }).first()).toBeVisible({
      timeout: 60_000,
    });
    return pagina;
  }

  test('0 · el día en blanco', async ({ browser, aparato }, info) => {
    test.setTimeout(6 * 60_000);
    const duena = await equipoDe(browser, aparato).pagina(info, 'dueno');
    const reseteo = await comando(duena, '/api/pruebas/resetear', { confirmacion: 'RESETEAR' });
    expect(reseteo.estado, `resetear: ${reseteo.texto.slice(0, 200)}`).toBe(200);
    await pedirTemperaturaEnLaCerveza(duena);
  });

  test('1 · la entrada con PIN', async ({ browser, aparato }, info) => {
    test.setTimeout(3 * 60_000);
    const barrido = new Barrido(info, CONOCIDOS);
    // Un contexto SIN sesión: la pantalla a la que llega quien enciende el aparato.
    const contexto = await navegadorDe(browser, aparato).newContext(opcionesDelProyecto(info));
    try {
      const page = await contexto.newPage();
      page.setDefaultTimeout(30_000);
      page.setDefaultNavigationTimeout(90_000);
      vigilarPagina(page);
      await page.goto(entradaDe(SLUG), { waitUntil: 'domcontentloaded' });
      const tarjetas = page.getByRole('button', { name: /Lupita/ });
      await expect(tarjetas.first()).toBeVisible();
      await barrido.revisar(page, 'entrada-con-pin', 'teclado-y-personas');
      await toque(page, tarjetas.first());
      await expect(page.getByText(/Iniciando como/)).toBeVisible();
      await barrido.revisar(page, 'entrada-con-pin', 'persona-elegida');
      await toque(page, page.getByRole('button', { name: '1', exact: true }));
      await expect(page.getByRole('textbox', { name: 'PIN' })).toHaveValue('1');
      await barrido.revisar(page, 'entrada-con-pin', 'un-digito');
    } finally {
      await contexto.close();
    }
    barrido.exigirLimpio();
  });

  test('2 · Caja: cerrada, recién abierta, con carrito y con el cobro abierto', async ({
    browser,
    aparato,
  }, info) => {
    test.setTimeout(8 * 60_000);
    const barrido = new Barrido(info, CONOCIDOS);
    const caja = await irA(browser, aparato, info, 'cajero', '/caja');
    await expect(caja.getByText('Caja cerrada').first()).toBeVisible();
    await barrido.revisar(caja, 'caja', 'cerrada');

    await toque(caja, caja.getByRole('button', { name: /^Abrir( caja)?$/ }).first());
    const apertura = caja.getByRole('dialog').filter({ hasText: 'Efectivo inicial contado' });
    await yaAbierto(apertura);
    await barrido.revisar(caja, 'caja', 'abrir-caja-dialogo');
    await apertura.getByPlaceholder('0.00').fill(FONDO_PESOS);
    await toque(caja, apertura.getByRole('button', { name: 'Abrir caja' }));
    await expect(caja.getByText(/abierta. Ya puedes cobrar./).first()).toBeVisible();
    await expect(caja.getByRole('dialog')).toHaveCount(0);
    await barrido.revisar(caja, 'caja', 'recien-abierta', { conAvisos: true });

    // Para llevar: el pedido vacío, con carrito y con el cobro abierto.
    await toque(caja, caja.getByRole('button', { name: /^Para llevar/ }));
    const pedido = caja.getByRole('dialog').filter({ hasText: 'Pedido para llevar' }).first();
    await yaAbierto(pedido);
    await barrido.revisar(caja, 'para-llevar', 'vacio');
    await toque(caja, pedido.getByRole('button', { name: new RegExp(`^${GUACAMOLE}`) }).first());
    await expect(pedido.getByRole('button', { name: /^Cobrar \$/ }).first()).toBeEnabled();
    await barrido.revisar(caja, 'para-llevar', 'con-carrito');
    await toque(caja, pedido.getByRole('button', { name: /^Cobrar \$/ }).first());
    const cobro = caja
      .getByRole('dialog')
      .filter({ hasText: /Cobrar|Método de pago|Efectivo/ })
      .last();
    await yaAbierto(cobro);
    await barrido.revisar(caja, 'caja', 'cobro-abierto');
    await caja.keyboard.press('Escape');
    await barrido.revisar(caja, 'para-llevar', 'tras-cerrar-el-cobro');
    await caja.keyboard.press('Escape');
    barrido.exigirLimpio();
  });

  test('3 · Cocina vacía, con la pregunta del anuncio y sin ella', async ({
    browser,
    aparato,
  }, info) => {
    test.setTimeout(6 * 60_000);
    const barrido = new Barrido(info, CONOCIDOS);
    const cocina = await irA(browser, aparato, info, 'cocina', '/cocina');
    const pregunta = cocina.getByRole('region', { name: 'Esta pantalla anuncia las comandas' });
    await expect(pregunta).toBeVisible();
    await barrido.revisar(cocina, 'cocina', 'vacia-con-la-pregunta');
    await toque(cocina, pregunta.getByRole('button', { name: /^No, ya hay otra/ }));
    await expect(pregunta).toHaveCount(0);
    await barrido.revisar(cocina, 'cocina', 'vacia');
    barrido.exigirLimpio();
  });

  test('4 · Mesero: plano, cuenta abierta, selector de platillos y modificadores', async ({
    browser,
    aparato,
  }, info) => {
    test.setTimeout(8 * 60_000);
    const barrido = new Barrido(info, CONOCIDOS);
    const mesero = await irA(browser, aparato, info, 'mesero', '/mesero');
    await expect(laMesa(mesero, MESA)).toBeVisible();
    await barrido.revisar(mesero, 'mesero', 'plano-de-mesas');

    await toque(mesero, laMesa(mesero, MESA));
    const apertura = mesero.getByRole('dialog', { name: `Abrir mesa ${String(MESA)}` });
    await yaAbierto(apertura);
    await barrido.revisar(mesero, 'mesero', 'abrir-mesa');
    await apertura.getByRole('spinbutton').first().fill('3');
    await toque(mesero, apertura.getByRole('button', { name: 'Abrir mesa' }));
    const mesa = dialogoDeLaMesa(mesero, MESA);
    await yaAbierto(mesa);
    await barrido.revisar(mesero, 'mesero', 'selector-de-platillos');

    await toque(mesero, mesa.getByRole('button', { name: new RegExp(`^${GUACAMOLE} \\$`) }));
    await barrido.revisar(mesero, 'mesero', 'cuenta-abierta');

    await toque(mesero, mesa.getByRole('button', { name: new RegExp(`^${CERVEZA} \\$`) }));
    const personalizar = mesero.getByRole('dialog', { name: 'Personalizar producto' });
    await yaAbierto(personalizar);
    await barrido.revisar(mesero, 'mesero', 'platillo-con-modificadores');
    await toque(mesero, personalizar.getByRole('button', { name: OPCION, exact: true }));
    await toque(mesero, personalizar.getByRole('button', { name: /^Agregar · \$/ }));
    await expect(personalizar).toHaveCount(0);
    await barrido.revisar(mesero, 'mesero', 'cuenta-con-platillos');

    const enviar = mesa
      .getByRole('button', { name: 'Enviar a Cocina', exact: true })
      .filter({ visible: true });
    const carrito = mesero
      .getByRole('button', { name: /\d+ productos? .*Ver pedido|^Mesa abierta\b/ })
      .filter({ visible: true });
    await expect(enviar.or(carrito).first()).toBeVisible();
    if ((await enviar.count()) === 0) await toque(mesero, carrito.last());
    const enviada = mesero.waitForResponse(
      (r) =>
        new URL(r.url()).pathname === '/api/restaurante/enviar-pedido' &&
        r.request().method() === 'POST',
    );
    await toque(
      mesero,
      mesero
        .getByRole('button', { name: 'Enviar a Cocina', exact: true })
        .filter({ visible: true })
        .last(),
    );
    expect((await enviada).status(), 'enviar-pedido').toBe(200);
    await expect(mesero.getByText('¡Pedido enviado a cocina!').first()).toBeVisible();
    await barrido.revisar(mesero, 'mesero', 'pedido-enviado');
    barrido.exigirLimpio();
  });

  test('5 · Cocina con comandas', async ({ browser, aparato }, info) => {
    test.setTimeout(6 * 60_000);
    const barrido = new Barrido(info, CONOCIDOS);
    const cocina = await irA(browser, aparato, info, 'cocina', '/cocina');
    await expect(
      cocina.getByRole('button', { name: 'Preparar', exact: true }).first(),
    ).toBeVisible();
    await barrido.revisar(cocina, 'cocina', 'con-comandas');
    await toque(cocina, cocina.getByRole('button', { name: 'Preparar', exact: true }).first());
    await expect(cocina.getByRole('button', { name: 'Listo', exact: true }).first()).toBeVisible();
    await barrido.revisar(cocina, 'cocina', 'en-preparacion');
    barrido.exigirLimpio();
  });

  test('5b · Cocina vista desde el aparato de la dueña: dice por qué no suena', async ({
    browser,
    aparato,
  }, info) => {
    test.setTimeout(6 * 60_000);
    const barrido = new Barrido(info, CONOCIDOS);
    const duena = await irA(browser, aparato, info, 'dueno', '/cocina');
    await expect(duena.getByRole('heading', { name: /^Cocina/ }).first()).toBeVisible();
    await barrido.revisar(duena, 'cocina', 'vista-por-la-duena');
    // DP-D151: el aparato de la dueña no anuncia sin que lo enciendan; la pantalla tiene que decirlo.
    await expect(
      duena
        .getByText(/no (suena|anuncia)|Configuración → Este aparato/i)
        .filter({ visible: true })
        .first(),
      'La dueña abre Cocina y nada explica por qué su pantalla no suena',
    ).toBeVisible();
    barrido.exigirLimpio();
  });

  test('6 · Caja: pestañas, corte de turno y cierre del día', async ({
    browser,
    aparato,
  }, info) => {
    test.setTimeout(8 * 60_000);
    const barrido = new Barrido(info, CONOCIDOS);
    const caja = await irA(browser, aparato, info, 'cajero', '/caja');
    await expect(caja.getByText(/Caja abierta desde/).first()).toBeVisible();
    for (const [nombre, estado] of [
      [/^Pendientes/, 'pestana-pendientes'],
      [/^Buscar/, 'pestana-buscar'],
      [/^Resumen/, 'pestana-resumen'],
      [/^Historial/, 'pestana-historial'],
      [/^Movimientos/, 'pestana-movimientos'],
    ] as const) {
      await toque(caja, caja.getByRole('tab', { name: nombre }));
      await barrido.revisar(caja, 'caja', estado);
    }
    await toque(caja, caja.getByRole('tab', { name: /^Pendientes/ }));
    await toque(caja, caja.getByRole('button', { name: /^(Corte de turno|Turno)/ }).first());
    await yaAbierto(caja.getByRole('dialog').first());
    await barrido.revisar(caja, 'corte', 'corte-de-turno');
    await caja.keyboard.press('Escape');
    await expect(caja.getByRole('dialog')).toHaveCount(0);
    await toque(caja, caja.getByRole('button', { name: /^Cierre( diario)?/ }).first());
    await yaAbierto(caja.getByRole('dialog').first());
    await barrido.revisar(caja, 'corte', 'cierre-del-dia');
    await caja.keyboard.press('Escape');
    barrido.exigirLimpio();
  });
});
