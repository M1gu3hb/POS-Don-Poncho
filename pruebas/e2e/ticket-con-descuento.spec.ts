import { expect, test, type Locator, type Page } from '@playwright/test';

import { sesionDeLaCaja } from './ayudantes/conciliacion.ts';
import {
  abrirElCobro,
  abrirLaCaja,
  abrirLaMesa,
  alMapa,
  CARTA,
  cerrarElTicket,
  comandar,
  cuentaEnElServidor,
  enPantalla,
  leerElCobro,
  yaAbierto,
  type PlatilloPedido,
} from './ayudantes/mesas-heredadas.ts';
import { pedirLaCuenta } from './ayudantes/cancelar-desde-la-mesa.ts';
import { Equipo, personaDe } from './ayudantes/roles.ts';
import {
  cabecerasDeEscrituraDePrueba,
  exigirDemostracion,
  vigilarFallos,
} from './ayudantes/sesion.ts';

/**
 * DP-14 · ronda 2, bloqueante 1 · EL PAPEL RESTA EL DESCUENTO.
 *
 * El ticket calculaba TOTAL = la suma de los renglones + propina: con $50 de descuento imprimía el
 * total sin descontar y se cobraba menos. Ahora, de punta a punta: el descuento con el PIN de la
 * gerente; el cobro de la Caja enseña el subtotal en bruto, «Descuento −$50.00», quién lo autorizó y
 * el TOTAL A COBRAR; el cobro cobra eso; el ticket dice ese TOTAL; y la reimpresión desde Ventas, lo
 * mismo. Corre en serie (`--workers=1`): resetea la demo.
 */

const SLUG = 'prueba-restaurante';
const MESA = 3;
const PEDIDO: readonly PlatilloPedido[] = [
  { nombre: CARTA.arrachera.nombre, veces: 1 },
  { nombre: CARTA.cerveza.nombre, veces: 1 },
];
const BRUTO = CARTA.arrachera.centavos + CARTA.cerveza.centavos;
const DESCUENTO = 5_000;
const COBRADO = BRUTO - DESCUENTO;

/** El TOTAL de un papel (ticket o reimpresión), leído de su texto. */
async function totalDelPapel(papel: Locator): Promise<string> {
  const texto = (await papel.innerText()).replace(/\s+/g, ' ');
  const total = /TOTAL (\$[\d,]+\.\d{2})/.exec(texto)?.[1];
  if (total === undefined) throw new Error(`El papel no trae TOTAL: ${texto.slice(0, 400)}`);
  return total;
}

async function descontarConLaGerente(rosa: Page, cobro: Locator): Promise<void> {
  const gerente = personaDe(SLUG, 'gerente');
  await cobro.getByRole('button', { name: 'Descuento', exact: true }).click();
  const dialogo = rosa.getByRole('dialog', { name: 'Descuento' });
  await dialogo.locator('#descuento-importe').fill(String(DESCUENTO / 100));
  await dialogo.locator('#descuento-motivo').fill('Cliente frecuente');
  await dialogo
    .getByRole('group', { name: 'Quién autoriza' })
    .getByRole('button', { name: gerente.nombre })
    .click();
  await dialogo.locator('#descuento-pin').fill(gerente.pin);
  await dialogo.getByRole('button', { name: 'Autorizar' }).click();
  const aplicar = dialogo.getByRole('button', { name: 'Aplicar el descuento' });
  await expect(aplicar).toBeEnabled();
  const aplicado = rosa.waitForResponse(
    (r) => new URL(r.url()).pathname === '/api/restaurante/descontar-cuenta',
  );
  await aplicar.click();
  expect((await aplicado).status()).toBe(200);
}

test.describe('el papel resta el descuento (DP-14 · ronda 2)', () => {
  test.use({ actionTimeout: 20_000, navigationTimeout: 30_000 });

  test.beforeAll(async ({ playwright }, info) => {
    await exigirDemostracion(playwright, info, SLUG);
  });

  test('descuento con PIN → cobro → ticket → reimpresión desde Ventas: todo dice lo cobrado', async ({
    browser,
  }, info) => {
    test.setTimeout(8 * 60_000);
    const equipo = new Equipo(browser, SLUG);
    const duena = await equipo.pagina(info, 'dueno');
    const reseteo = await duena.request.post('/api/pruebas/resetear', {
      headers: cabecerasDeEscrituraDePrueba(),
      data: { confirmacion: 'RESETEAR' },
      timeout: 120_000,
    });
    expect(reseteo.status(), await reseteo.text()).toBe(200);
    const rosa = await equipo.pagina(info, 'cajero');
    const lupita = await equipo.pagina(info, 'mesero');
    const fallos = [vigilarFallos(rosa), vigilarFallos(lupita), vigilarFallos(duena)];
    await rosa.goto('/');
    await rosa.waitForURL(/\/caja$/);
    await lupita.goto('/');
    await lupita.waitForURL(/\/mesero$/);
    if ((await sesionDeLaCaja(rosa)) === null) await abrirLaCaja(rosa, 150_000);

    const { ordenId } = await abrirLaMesa(lupita, duena, MESA, 2);
    await comandar(lupita, MESA, PEDIDO);
    await alMapa(lupita);
    await pedirLaCuenta(lupita, ordenId);

    const cobro = await abrirElCobro(rosa, MESA);
    let folio = '';
    await test.step('el cobro de la Caja: subtotal en bruto, el descuento con quién, y el total', async () => {
      await descontarConLaGerente(rosa, cobro);
      await expect
        .poll(async () => (await cuentaEnElServidor(duena, ordenId)).totalCentavos)
        .toBe(COBRADO);
      await expect(cobro.getByText(enPantalla(BRUTO)).first()).toBeVisible();
      await expect(cobro.getByText(`−${enPantalla(DESCUENTO)}`)).toBeVisible();
      await expect(cobro.getByText(/^Autorizó /)).toContainText(personaDe(SLUG, 'gerente').nombre);
      await expect(cobro.getByText(/^Autorizó /)).toContainText('Cliente frecuente');
      await expect(cobro.getByText(enPantalla(COBRADO)).first()).toBeVisible();
    });

    await test.step('se cobra lo descontado y el ticket dice ese TOTAL', async () => {
      await cobro.getByRole('button', { name: 'Efectivo', exact: true }).click();
      await cobro.getByPlaceholder('0.00').fill((COBRADO / 100).toFixed(2));
      const cobrado = rosa.waitForResponse(
        (r) => new URL(r.url()).pathname === '/api/venta/cobrar',
      );
      await cobro.getByRole('button', { name: /^Cobrar \$/ }).click();
      const resultado = await leerElCobro(await cobrado);
      expect(resultado.ok, resultado.mensaje ?? '').toBe(true);
      expect(resultado.datos?.totalCentavos).toBe(String(COBRADO));
      folio = resultado.datos?.folio ?? '';
      const ticket = rosa.getByRole('dialog').filter({ hasText: 'TICKET DE PAGO' });
      await yaAbierto(ticket);
      expect(await totalDelPapel(ticket)).toBe(enPantalla(COBRADO));
      await expect(ticket).toContainText(`-${enPantalla(DESCUENTO)}`);
      await cerrarElTicket(rosa);
    });

    await test.step('la reimpresión desde Ventas dice el mismo TOTAL', async () => {
      await duena.goto('/ventas');
      const fila = duena
        .locator('div')
        .filter({ hasText: folio })
        .filter({
          has: duena.getByRole('button', { name: 'Ver ticket' }),
        });
      await fila.last().getByRole('button', { name: 'Ver ticket' }).click();
      const papel = duena.getByRole('dialog').filter({ hasText: `Ticket · ${folio}` });
      await yaAbierto(papel);
      await expect(papel).toContainText(`-${enPantalla(DESCUENTO)}`);
      await expect.poll(() => totalDelPapel(papel)).toBe(enPantalla(COBRADO));
    });

    for (const exigir of fallos) exigir();
  });
});
