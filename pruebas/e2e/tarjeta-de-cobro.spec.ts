import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';

import {
  abrirLaTarjeta,
  ANCHA,
  cajaTactil,
  cambio,
  CHICA,
  cobrarConElDedo as cobrar,
  MEDIANA,
  totalACobrar,
} from './ayudantes/caja-tactil.ts';
import { pedirLaCuenta } from './ayudantes/cancelar-desde-la-mesa.ts';
import { sesionDeLaCaja } from './ayudantes/conciliacion.ts';
import {
  abrirLaCaja,
  abrirLaMesa,
  alMapa,
  CARTA,
  cerrarElTicket,
  comandar,
  cuentaEnElServidor,
  importeDe,
  pagosDeLaCuenta,
  yaAbierto,
  type PlatilloPedido,
} from './ayudantes/mesas-heredadas.ts';
import { Equipo } from './ayudantes/roles.ts';
import {
  cabecerasDeEscrituraDePrueba,
  exigirDemostracion,
  vigilarFallos,
} from './ayudantes/sesion.ts';

/**
 * DP-24 · LA TARJETA DE COBRO, CON EL DEDO, en las pantallas de la caja (1024×768, 800×600 y 1280×800).
 *
 * «La Caja controla TODO al cobrar»: una sola vista —los platillos, el subtotal, la propina, las
 * formas de pago, lo recibido, el cambio y el total— sin diálogos encimados y sin desplazarse.
 * Aquí la cajera cobra tres mesas tocando la pantalla (`tap`, nunca el ratón), una por tamaño:
 *
 *   · 1024×768 · efectivo: la propina con un toque, un billete que NO alcanza (no se cobra), uno que
 *     sobra, el cambio que se deja de propina (y se deshace) y el teclado de la tarjeta;
 *   · 800×600 · varias tarjetas: dividir, el «Resto», lo que no cuadra no cobra, y tres tarjetas más
 *     efectivo; el ticket dice UNA sola línea «Tarjeta» con la suma;
 *   · 1280×800 · «Otro monto» de propina y transferencia.
 *
 * Y en las tres: todo cabe a la vista y ningún botón de la tarjeta mide menos de 44 px.
 * El dinero de cada cobro se comprueba contra el servidor, no contra la pantalla.
 */

const SLUG = 'prueba-restaurante';
const PEDIDO: readonly PlatilloPedido[] = [
  { nombre: CARTA.arrachera.nombre, veces: 1 },
  { nombre: CARTA.cerveza.nombre, veces: 2 },
  { nombre: CARTA.guacamole.nombre, veces: 1 },
];
/** $329 + 2 × $55 + $125 = $564.00 */
const TOTAL = importeDe(PEDIDO);
const CAPTURAS = process.env['MORPHIQPOS_CAPTURAS'];

async function retratar(caja: Page, info: TestInfo, nombre: string): Promise<void> {
  const carpeta = CAPTURAS ?? info.outputDir;
  mkdirSync(carpeta, { recursive: true });
  await caja.screenshot({ path: join(carpeta, `tarjeta-de-cobro-${nombre}.png`) });
}

/** Todo lo del cobro está a la vista, entero, sin desplazarse: es UNA vista. */
async function todoALaVista(tarjeta: Locator): Promise<void> {
  const piezas = [
    tarjeta.getByRole('heading', { name: /^Cobrar — Mesa/ }),
    tarjeta.getByRole('list', { name: 'Platillos de la cuenta' }),
    tarjeta.getByText('Subtotal', { exact: true }),
    tarjeta.getByRole('group', { name: /^Propina/ }),
    tarjeta.getByRole('group', { name: 'Forma de pago' }),
    tarjeta.getByLabel('Recibido', { exact: true }),
    tarjeta.getByRole('group', { name: 'Atajos de lo recibido' }),
    tarjeta.getByRole('group', { name: 'Teclado para Recibido' }),
    tarjeta.getByText('TOTAL A COBRAR', { exact: true }),
    tarjeta.getByRole('button', { name: /^Cobrar \$/ }),
    tarjeta.getByRole('button', { name: 'Cerrar', exact: true }),
  ];
  for (const pieza of piezas) await expect(pieza).toBeInViewport({ ratio: 1 });
}

/** Ningún botón de la tarjeta mide menos de 44 px de alto ni de ancho (con el dedo). */
async function blancosDe44(tarjeta: Locator): Promise<void> {
  const chicos = await tarjeta.locator('button:visible').evaluateAll((botones) =>
    botones
      .map((boton) => {
        const caja = boton.getBoundingClientRect();
        return {
          nombre: (boton.getAttribute('aria-label') ?? boton.textContent ?? '').trim().slice(0, 40),
          ancho: Math.round(caja.width),
          alto: Math.round(caja.height),
        };
      })
      .filter((boton) => boton.alto < 44 || boton.ancho < 44),
  );
  expect(chicos, 'botones de menos de 44 px').toEqual([]);
}

async function teclear(tarjeta: Locator, campo: string, teclas: readonly string[]): Promise<void> {
  const teclado = tarjeta.getByRole('group', { name: `Teclado para ${campo}` });
  for (const tecla of teclas) await teclado.getByRole('button', { name: tecla, exact: true }).tap();
}

test.describe('la tarjeta de cobro, con el dedo', () => {
  test.use({ actionTimeout: 20_000, navigationTimeout: 30_000 });

  test.beforeAll(async ({ playwright }, info) => {
    await exigirDemostracion(playwright, info, SLUG);
  });

  test('tres mesas en tres pantallas: efectivo, varias tarjetas y otro monto', async ({
    browser,
  }, info) => {
    test.skip(
      info.project.name !== 'escritorio',
      'La caja es la PC táctil: la prueba pone su tamaño.',
    );
    test.setTimeout(10 * 60_000);
    const equipo = new Equipo(browser, SLUG);
    const duena = await equipo.pagina(info, 'dueno');
    const reinicio = await duena.request.post('/api/pruebas/resetear', {
      headers: cabecerasDeEscrituraDePrueba(),
      data: { confirmacion: 'RESETEAR' },
      timeout: 120_000,
    });
    expect(reinicio.status(), `resetear: ${await reinicio.text()}`).toBe(200);
    const rosa = await equipo.pagina(info, 'cajero');
    const lupita = await equipo.pagina(info, 'mesero');
    await rosa.goto('/');
    await rosa.waitForURL(/\/caja$/);
    await lupita.goto('/');
    await lupita.waitForURL(/\/mesero$/);
    if ((await sesionDeLaCaja(rosa)) === null) await abrirLaCaja(rosa, 150_000);

    const servir = async (mesa: number): Promise<string> => {
      const { ordenId } = await abrirLaMesa(lupita, duena, mesa, 2);
      await comandar(lupita, mesa, PEDIDO);
      await alMapa(lupita);
      await pedirLaCuenta(lupita, ordenId);
      return ordenId;
    };

    await test.step('1024×768 · efectivo: propina, billete que no alcanza, cambio de propina y teclado', async () => {
      const ordenId = await servir(2);
      const caja = await cajaTactil(browser, info, rosa, MEDIANA);
      const fallos = vigilarFallos(caja);
      const tarjeta = await abrirLaTarjeta(caja, 2);
      await todoALaVista(tarjeta);
      await blancosDe44(tarjeta);
      await retratar(caja, info, `${MEDIANA.nombre}-1-al-abrir`);
      await expect(totalACobrar(tarjeta)).toHaveText('$564.00');

      // La propina con un toque: 10 % de $564.00 = $56.40. No hay diálogo de propina.
      await tarjeta.getByRole('button', { name: '10%', exact: true }).tap();
      await expect(tarjeta.getByText('Propina (10%)')).toBeVisible();
      await expect(totalACobrar(tarjeta)).toHaveText('$620.40');
      await expect(caja.getByText('¿Desean agregar propina?')).toHaveCount(0);

      // RECIBIDO MENOR AL TOTAL: no se cobra como exacto ni con «Cambio $0.00».
      await tarjeta.getByRole('button', { name: '$500', exact: true }).tap();
      await expect(tarjeta.getByRole('alert')).toHaveText('Faltan $120.40 en efectivo.');
      await expect(tarjeta.getByRole('button', { name: /^Cobrar \$/ })).toBeDisabled();
      await expect(cambio(tarjeta)).toHaveCount(0);

      // Un billete que sobra: cambio, y la oferta de dejarlo de propina.
      await tarjeta.getByRole('button', { name: '$1,000', exact: true }).tap();
      await expect(cambio(tarjeta)).toContainText('$379.60');
      const dejar = tarjeta.getByRole('button', {
        name: 'Dejar los $379.60 de cambio como propina',
      });
      await dejar.tap();
      await expect(dejar).toHaveAttribute('aria-pressed', 'true');
      await expect(cambio(tarjeta)).toContainText('$0.00');
      await expect(totalACobrar(tarjeta)).toHaveText('$1,000.00');
      // Dice que no: se entrega el cambio y la propina vuelve a ser la elegida.
      await dejar.tap();
      await expect(cambio(tarjeta)).toContainText('$379.60');
      await expect(totalACobrar(tarjeta)).toHaveText('$620.40');

      // El teclado de la tarjeta escribe en «Recibido» (el del sistema no sale).
      await expect(tarjeta.getByLabel('Recibido', { exact: true })).toHaveAttribute(
        'inputmode',
        'none',
      );
      await teclear(tarjeta, 'Recibido', ['Borrar todo', '7', '0', '0']);
      await expect(tarjeta.getByLabel('Recibido', { exact: true })).toHaveValue('700');
      await expect(cambio(tarjeta)).toContainText('$79.60');
      await todoALaVista(tarjeta);
      await retratar(caja, info, `${MEDIANA.nombre}-2-antes-de-cobrar`);

      expect((await cobrar(caja, tarjeta)).ok).toBe(true);
      await cerrarElTicket(caja);
      const cuenta = await cuentaEnElServidor(duena, ordenId);
      expect([cuenta.estado, cuenta.totalCentavos, cuenta.propinaTipo]).toEqual([
        'pagada',
        TOTAL,
        'porcentaje',
      ]);
      const pagos = await pagosDeLaCuenta(duena, ordenId);
      expect(pagos).toMatchObject({
        efectivo: 62_040,
        propinaEfectivo: 5_640,
        tarjeta: 0,
        cambio: 7_960,
        cobradoConPropina: 62_040,
      });
      fallos();
      await caja.context().close();
    });

    await test.step('800×600 · varias tarjetas: dividir, lo que no cuadra no cobra, y tres tarjetas más efectivo', async () => {
      const ordenId = await servir(3);
      const caja = await cajaTactil(browser, info, rosa, CHICA);
      const fallos = vigilarFallos(caja);
      const tarjeta = await abrirLaTarjeta(caja, 3);
      await todoALaVista(tarjeta);
      await blancosDe44(tarjeta);
      await retratar(caja, info, `${CHICA.nombre}-1-al-abrir`);

      await tarjeta.getByRole('button', { name: 'Sin propina', exact: true }).tap();
      await expect(
        tarjeta.getByRole('button', { name: 'Sin propina', exact: true }),
      ).toHaveAttribute('aria-pressed', 'true');
      await tarjeta.getByRole('button', { name: 'Tarjeta', exact: true }).tap();
      await expect(tarjeta.getByText('Una tarjeta con todo:')).toContainText('$564.00');
      await tarjeta.getByRole('button', { name: 'Dividir en tarjetas' }).tap();
      await teclear(tarjeta, 'Tarjeta 1', ['2', '0', '0']);
      await tarjeta.getByRole('button', { name: 'Poner el resto en la tarjeta 2' }).tap();
      await expect(tarjeta.getByLabel('Tarjeta 2', { exact: true })).toHaveValue('364');
      await expect(tarjeta.getByRole('button', { name: /^Cobrar \$564\.00/ })).toBeEnabled();

      // Si no cuadra, no deja cobrar y dice cuánto falta.
      await teclear(tarjeta, 'Tarjeta 2', ['Borrar todo', '1', '0', '0']);
      await expect(tarjeta.getByRole('alert')).toHaveText(
        'Faltan $264.00 por repartir entre las tarjetas.',
      );
      await expect(tarjeta.getByRole('button', { name: /^Cobrar \$/ })).toBeDisabled();

      // Se combina con efectivo: tres tarjetas ($200, $100 y $100) y el resto en billete.
      await tarjeta.getByRole('button', { name: 'Mixto', exact: true }).tap();
      await tarjeta.getByRole('button', { name: 'Agregar tarjeta' }).tap();
      await teclear(tarjeta, 'Tarjeta 3', ['1', '0', '0']);
      await expect(tarjeta.locator('[data-resto-en-efectivo]')).toHaveText(
        'El resto, en efectivo: $164.00',
      );
      await tarjeta.getByRole('button', { name: '$200', exact: true }).tap();
      await expect(cambio(tarjeta)).toContainText('$36.00');
      // Con varias tarjetas los campos se desplazan; el cambio y el botón de cobrar, no.
      await expect(cambio(tarjeta)).toBeInViewport({ ratio: 1 });
      await expect(tarjeta.getByRole('button', { name: /^Cobrar \$564\.00/ })).toBeInViewport({
        ratio: 1,
      });
      await blancosDe44(tarjeta);
      await retratar(caja, info, `${CHICA.nombre}-2-tres-tarjetas-y-efectivo`);

      expect((await cobrar(caja, tarjeta)).ok).toBe(true);
      // El ticket: UNA sola línea «Tarjeta», con la suma de las tres.
      const ticket = caja.getByRole('dialog').filter({ hasText: 'TICKET DE PAGO' });
      await yaAbierto(ticket);
      await expect(ticket.getByText('Tarjeta:', { exact: true })).toHaveCount(1);
      await expect(ticket.getByText('$400.00', { exact: true })).toBeVisible();
      await cerrarElTicket(caja);
      const pagos = await pagosDeLaCuenta(duena, ordenId);
      expect(pagos).toMatchObject({
        tarjeta: 40_000,
        efectivo: 16_400,
        cambio: 3_600,
        cobradoConPropina: TOTAL,
      });
      expect((await cuentaEnElServidor(duena, ordenId)).estado).toBe('pagada');
      fallos();
      await caja.context().close();
    });

    await test.step('1280×800 · «Otro monto» de propina y transferencia', async () => {
      const ordenId = await servir(5);
      const caja = await cajaTactil(browser, info, rosa, ANCHA);
      const fallos = vigilarFallos(caja);
      const tarjeta = await abrirLaTarjeta(caja, 5);
      await todoALaVista(tarjeta);
      await blancosDe44(tarjeta);

      await tarjeta.getByRole('button', { name: 'Otro monto', exact: true }).tap();
      await teclear(tarjeta, 'Otro monto de propina', ['3', '0']);
      await tarjeta.getByRole('button', { name: 'Poner', exact: true }).tap();
      await expect(totalACobrar(tarjeta)).toHaveText('$594.00');
      await tarjeta.getByRole('button', { name: 'Transferencia', exact: true }).tap();
      await expect(tarjeta.getByText('Todo por transferencia:')).toContainText('$594.00');
      await retratar(caja, info, `${ANCHA.nombre}-otro-monto-y-transferencia`);

      expect((await cobrar(caja, tarjeta)).ok).toBe(true);
      await cerrarElTicket(caja);
      const cuenta = await cuentaEnElServidor(duena, ordenId);
      expect([cuenta.estado, cuenta.propinaTipo, cuenta.propinaOrigen]).toEqual([
        'pagada',
        'monto_manual',
        'caja',
      ]);
      const pagos = await pagosDeLaCuenta(duena, ordenId);
      expect(pagos).toMatchObject({
        transferencia: 59_400,
        propinaTransferencia: 3_000,
        efectivo: 0,
        cambio: 0,
      });
      fallos();
      await caja.context().close();
    });
  });
});
