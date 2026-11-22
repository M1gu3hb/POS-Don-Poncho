import { expect, test, type Locator, type Page } from '@playwright/test';

import { sesionDeLaCaja } from './ayudantes/conciliacion.ts';
import {
  abrirElQrDeLaMesa,
  abrirLaCaja,
  abrirLaMesa,
  alMapa,
  CARTA,
  cerrarElTicket,
  comandar,
  cuentaEnElServidor,
  importeDe,
  leerElCobro,
  mesaEnElServidor,
  prepararElPortalDelComensal,
  yaAbierto,
  type PlatilloPedido,
  type TelefonoDelComensal,
} from './ayudantes/mesas-heredadas.ts';
import { Equipo } from './ayudantes/roles.ts';
import {
  cabecerasDeEscrituraDePrueba,
  exigirDemostracion,
  vigilarFallos,
} from './ayudantes/sesion.ts';

/**
 * DP-21 · Bloque 4 · LA PROPINA, UNA SOLA VERDAD: dos pantallas, una propina.
 *
 * «¿Quién puede elegir la propina?» queda por omisión (comensales y caja, sin mesero). La mesera
 * pide la cuenta sin propina (por el servidor: no se le pregunta) y quedan dos pantallas con la
 * decisión por tomar, la de la Caja y la del teléfono del comensal. La primera que se confirma gana:
 *
 *   A · LA CAJA ELIGE PRIMERO. El comensal tiene abierta su pantalla de propina («Pedir cuenta»);
 *       la Caja toca 10 % en su tarjeta de cobro. El teléfono se entera solo, cierra esa pantalla y
 *       dice «Tu propina ya quedó registrada en caja». Y la propina que se cobra es la de la Caja.
 *   B · EL COMENSAL ELIGE PRIMERO. La Caja tiene el cobro abierto, sin propina elegida; el comensal
 *       confirma 10 %. La propina llega YA PUESTA a la tarjeta de cobro, que lo dice ahí mismo («Los
 *       comensales eligieron 10 % de propina (…). Ya está puesta en la cuenta; aquí la puedes
 *       cambiar.»), sin un diálogo encima (DP-24), y el cobro cobra esa propina.
 *   C · LA DEL PORTAL, CAMBIADA EN LA CAJA (DP-24). El comensal pide su cuenta con 10 %; la Caja
 *       abre el cobro, la ve puesta y toca 15 %: la cuenta pasa a ser de la Caja y se cobra el 15 %.
 *
 * Lo que se afirma se lee al SERVIDOR (la cuenta y la respuesta del cobro), no al aviso. Corre en
 * serie (`--workers=1`): resetea la demo.
 */

const SLUG = 'prueba-restaurante';
const ZONA = 'Interior';
const MESA_A = 6;
const MESA_B = 5;
const MESA_C = 4;
const FONDO_CENTAVOS = 150_000;
const PEDIDO: readonly PlatilloPedido[] = [
  { nombre: CARTA.arrachera.nombre, veces: 1 },
  { nombre: CARTA.cerveza.nombre, veces: 1 },
];
const VENTA = importeDe(PEDIDO);
/** El 10 % del total de la cuenta, en centavos: lo que la propina de cualquiera de las dos vale. */
const PROPINA = Math.round(VENTA * 0.1);
const PROPINA_DE_15 = Math.round(VENTA * 0.15);
/** «$422.40», como lo pinta la tarjeta de cobro (importes de menos de mil pesos). */
const enPantalla = (centavos: number): string => `$${(centavos / 100).toFixed(2)}`;

/**
 * La mesera pide la cuenta como lo hace su pantalla SIN la casilla del mesero: no pregunta la
 * propina y la deja pendiente para quien sí la elige (`Mesero.jsx`, `propina_tipo: 'pendiente'`).
 */
async function pedirLaCuenta(mesera: Page, ordenId: string): Promise<void> {
  const respuesta = await mesera.request.post('/api/restaurante/solicitar-cuenta', {
    headers: cabecerasDeEscrituraDePrueba(),
    data: { aunConPendientes: true, ordenId, propinaTipo: 'pendiente', propinaPuntosBase: 0 },
  });
  expect(respuesta.status(), `solicitar-cuenta: ${await respuesta.text()}`).toBe(200);
}

/** Rosa toca la cuenta en «Pendientes»: se abre su tarjeta de cobro, con la propina dentro. */
async function tocarLaCuenta(rosa: Page, mesa: number): Promise<void> {
  await rosa.getByRole('tab', { name: /^Pendientes/ }).click();
  await rosa.getByRole('button', { name: new RegExp(`^Mesa ${String(mesa)} Cuenta`) }).click();
}

/** El diálogo de cobro de la mesa. */
function cobroDe(rosa: Page, mesa: number): Locator {
  return rosa.getByRole('dialog').filter({ hasText: `Cobrar — Mesa ${String(mesa)}` });
}

/** Los botones de la propina en la tarjeta de cobro (DP-24: ya no hay una pregunta aparte). */
function propinaDe(cobro: Locator): Locator {
  return cobro.getByRole('group', { name: /^Propina/ });
}

/** Rosa toca un porcentaje en la tarjeta y el servidor lo guarda. */
async function elegirEnLaCaja(
  rosa: Page,
  cobro: Locator,
  porcentaje: '10%' | '15%',
): Promise<void> {
  const fijada = rosa.waitForResponse(
    (r) => new URL(r.url()).pathname === '/api/venta/fijar-propina',
  );
  await propinaDe(cobro).getByRole('button', { name: porcentaje, exact: true }).click();
  expect((await fijada).status(), 'El servidor no guardó la propina de la Caja.').toBe(200);
  await expect(
    propinaDe(cobro).getByRole('button', { name: porcentaje, exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
}

/** La mesera abre la mesa para dos, comanda, y pide la cuenta SIN propina (por el servidor). */
async function mesaConLaCuentaPedida(
  lupita: Page,
  lector: Page,
  mesa: number,
  pedirla: boolean,
): Promise<string> {
  const { ordenId } = await abrirLaMesa(lupita, lector, mesa, 2);
  await comandar(lupita, mesa, PEDIDO);
  await alMapa(lupita);
  if (pedirla) await pedirLaCuenta(lupita, ordenId);
  return ordenId;
}

/** El comensal toca «Pedir cuenta» y deja abierta su pantalla de propina (sin confirmar). */
async function abrirLaPantallaDePropina(telefono: Page, mesa: number): Promise<Locator> {
  await telefono.getByRole('button', { name: 'Atención' }).click();
  await telefono.getByRole('button', { name: 'Pedir cuenta' }).click();
  const hoja = telefono
    .locator('div.fixed.inset-0')
    .filter({ hasText: `Pedir cuenta — Mesa ${String(mesa)}` });
  await expect(hoja).toBeVisible();
  await expect(hoja.getByText('¿Quieres dejar propina?')).toBeVisible();
  return hoja;
}

/** La cuenta de la mesa, pedida por el COMENSAL con 10 % desde su teléfono. */
async function pedidaPorElComensal(telefono: Page, mesa: number): Promise<void> {
  const hoja = await abrirLaPantallaDePropina(telefono, mesa);
  await hoja.getByRole('button', { name: /^10%/ }).click();
  await hoja.getByRole('button', { name: 'Confirmar' }).click();
  await expect(telefono.getByText('¡Cuenta solicitada!')).toBeVisible();
}

/** La Caja cobra en efectivo la cuenta que tiene abierta y devuelve la propina que cobró. */
async function cobrarEnEfectivo(rosa: Page, cobro: Locator): Promise<string> {
  await cobro.getByRole('button', { name: 'Efectivo', exact: true }).click();
  await cobro.getByPlaceholder('0.00').fill('600.00');
  const respuesta = rosa.waitForResponse((r) => new URL(r.url()).pathname === '/api/venta/cobrar');
  await cobro.getByRole('button', { name: /^Cobrar \$/ }).click();
  const resultado = await leerElCobro(await respuesta);
  expect(resultado.ok, `El cobro: ${resultado.mensaje ?? ''}`).toBe(true);
  expect(resultado.datos?.totalCentavos).toBe(String(VENTA));
  await cerrarElTicket(rosa);
  return resultado.datos?.propinaCentavos ?? '';
}

test.describe('la propina, una sola verdad (DP-21 · Bloque 4)', () => {
  test.use({ actionTimeout: 20_000, navigationTimeout: 30_000 });

  test.beforeAll(async ({ playwright }, info) => {
    await exigirDemostracion(playwright, info, SLUG);
  });

  test('la Caja elige primero y el portal se cierra solo; el comensal elige primero y llega puesta; y la Caja la cambia', async ({
    browser,
  }, info) => {
    test.setTimeout(12 * 60_000);
    const equipo = new Equipo(browser, SLUG);
    const telefonos: TelefonoDelComensal[] = [];
    try {
      const duena = await equipo.pagina(info, 'dueno');
      const fallos = [vigilarFallos(duena)];
      await test.step('reseteo de la demo y el portal encendido, sin asignación de mesas', async () => {
        const reseteo = await duena.request.post('/api/pruebas/resetear', {
          headers: cabecerasDeEscrituraDePrueba(),
          data: { confirmacion: 'RESETEAR' },
          timeout: 120_000,
        });
        expect(reseteo.status(), await reseteo.text()).toBe(200);
        await prepararElPortalDelComensal(duena, { mesa: MESA_A, zona: ZONA, mesero: null });
        // Lo de omisión de un negocio (y lo de Don Poncho): eligen los comensales y la Caja, no
        // el mesero. El restaurante de prueba nace con el mesero encendido; aquí se apaga.
        const quienElige = await duena.request.post('/api/configuracion/quien-elige-la-propina', {
          headers: cabecerasDeEscrituraDePrueba(),
          data: { comensales: true, mesero: false, caja: true },
        });
        expect(quienElige.status(), await quienElige.text()).toBe(200);
      });
      const tokenA = (await mesaEnElServidor(duena, MESA_A)).qrToken ?? '';
      const tokenB = (await mesaEnElServidor(duena, MESA_B)).qrToken ?? '';
      const tokenC = (await mesaEnElServidor(duena, MESA_C)).qrToken ?? '';
      expect(tokenA, 'La mesa A no tiene su código QR.').not.toBe('');
      expect(tokenB, 'La mesa B no tiene su código QR.').not.toBe('');
      expect(tokenC, 'La mesa C no tiene su código QR.').not.toBe('');

      // Se entra DESPUÉS de dejar listo el portal: las pantallas leen la configuración al cargar.
      const rosa = await equipo.pagina(info, 'cajero');
      const lupita = await equipo.pagina(info, 'mesero');
      fallos.push(vigilarFallos(rosa), vigilarFallos(lupita));
      await rosa.goto('/');
      await rosa.waitForURL(/\/caja$/);
      await lupita.goto('/');
      await lupita.waitForURL(/\/mesero$/);
      if ((await sesionDeLaCaja(rosa)) === null) await abrirLaCaja(rosa, FONDO_CENTAVOS);

      // ── A · LA CAJA ELIGE PRIMERO ────────────────────────────────────────────
      await test.step('A: el comensal tiene abierta su pantalla de propina; la Caja elige 10 %: el portal se cierra solo', async () => {
        const ordenA = await mesaConLaCuentaPedida(lupita, duena, MESA_A, false);
        const comensal = await abrirElQrDeLaMesa(browser, info, SLUG, tokenA);
        telefonos.push(comensal);
        const telefono = comensal.page;
        fallos.push(vigilarFallos(telefono));
        const hoja = await abrirLaPantallaDePropina(telefono, MESA_A);

        // Cuenta pedida por la mesera, sin propina (no se le pregunta): la Caja la ve en Pendientes.
        await pedirLaCuenta(lupita, ordenA);
        await tocarLaCuenta(rosa, MESA_A);
        const cobro = cobroDe(rosa, MESA_A);
        await yaAbierto(cobro);
        // Nadie la ha elegido: la tarjeta lo dice y cobraría sólo la venta. Sin pregunta encima.
        await expect(propinaDe(cobro)).toContainText('sin elegir');
        await expect(cobro.locator('[data-total-a-cobrar]')).toHaveText(enPantalla(VENTA));
        await expect(rosa.getByText('¿Desean agregar propina?')).toHaveCount(0);
        await elegirEnLaCaja(rosa, cobro, '10%');
        await expect(cobro.locator('[data-total-a-cobrar]')).toHaveText(
          enPantalla(VENTA + PROPINA),
        );

        // El servidor la tiene decidida, y es de la Caja.
        expect(await cuentaEnElServidor(duena, ordenA)).toMatchObject({
          propinaTipo: 'porcentaje',
          propinaOrigen: 'caja',
          propinaPorcentaje: 10,
        });
        // El teléfono se entera solo: la pantalla de propina se cierra y lo dice.
        await expect(
          telefono.getByText('Tu propina ya quedó registrada en caja'),
          'El portal no avisó que la Caja ya eligió la propina.',
        ).toBeVisible({ timeout: 30_000 });
        await expect(hoja.getByText('¿Quieres dejar propina?')).toHaveCount(0);

        // Y lo que se cobra es la propina de la Caja: nunca la del comensal ni una distinta.
        expect(await cobrarEnEfectivo(rosa, cobro)).toBe(String(PROPINA));
        expect(await cuentaEnElServidor(duena, ordenA)).toMatchObject({
          estado: 'pagada',
          propinaOrigen: 'caja',
        });
      });

      // ── B · EL COMENSAL ELIGE PRIMERO ────────────────────────────────────────
      await test.step('B: la Caja tiene el cobro abierto; el comensal confirma 10 %: llega ya puesta a la tarjeta, con su aviso', async () => {
        const ordenB = await mesaConLaCuentaPedida(lupita, duena, MESA_B, true);
        const comensal = await abrirElQrDeLaMesa(browser, info, SLUG, tokenB);
        telefonos.push(comensal);
        const telefono = comensal.page;
        fallos.push(vigilarFallos(telefono));
        const hoja = await abrirLaPantallaDePropina(telefono, MESA_B);

        // La Caja abre el cobro y deja sin elegir la propina.
        await tocarLaCuenta(rosa, MESA_B);
        const cobro = cobroDe(rosa, MESA_B);
        await yaAbierto(cobro);
        await expect(propinaDe(cobro)).toContainText('sin elegir');

        // El comensal confirma primero: 10 %.
        await hoja.getByRole('button', { name: /^10%/ }).click();
        await hoja.getByRole('button', { name: 'Confirmar' }).click();
        await expect(telefono.getByText('¡Cuenta solicitada!')).toBeVisible();
        expect(await cuentaEnElServidor(duena, ordenB)).toMatchObject({
          propinaTipo: 'porcentaje',
          propinaOrigen: 'portal_qr',
          propinaPorcentaje: 10,
        });

        // La Caja, con el cobro abierto, se entera sola: la propina llega YA PUESTA a la tarjeta
        // y se dice ahí mismo, sin un diálogo encima (DP-24).
        const aviso = cobro.getByRole('status').filter({ hasText: 'Los comensales eligieron' });
        await expect(
          aviso,
          'La Caja no avisó que los comensales eligieron la propina.',
        ).toBeVisible({ timeout: 30_000 });
        await expect(aviso).toContainText(
          /Los comensales eligieron 10 % de propina \(\$\d+\.\d{2}\)/,
        );
        await expect(aviso).toContainText('aquí la puedes cambiar');
        await expect(rosa.getByRole('alertdialog')).toHaveCount(0);
        await expect(
          propinaDe(cobro).getByRole('button', { name: '10%', exact: true }),
        ).toHaveAttribute('aria-pressed', 'true');
        await expect(cobro.locator('[data-total-a-cobrar]')).toHaveText(
          enPantalla(VENTA + PROPINA),
        );

        // El cobro cobra la propina del comensal, y el servidor la sigue teniendo suya.
        expect(await cobrarEnEfectivo(rosa, cobro)).toBe(String(PROPINA));
        expect(await cuentaEnElServidor(duena, ordenB)).toMatchObject({
          estado: 'pagada',
          propinaTipo: 'porcentaje',
          propinaOrigen: 'portal_qr',
          propinaPorcentaje: 10,
        });
      });

      // ── C · LA DEL PORTAL, CAMBIADA EN LA CAJA ───────────────────────────────
      await test.step('C: el comensal pidió su cuenta con 10 %; la Caja la ve puesta y la cambia a 15 %', async () => {
        const ordenC = await mesaConLaCuentaPedida(lupita, duena, MESA_C, false);
        const comensal = await abrirElQrDeLaMesa(browser, info, SLUG, tokenC);
        telefonos.push(comensal);
        fallos.push(vigilarFallos(comensal.page));
        await pedidaPorElComensal(comensal.page, MESA_C);
        expect(await cuentaEnElServidor(duena, ordenC)).toMatchObject({
          propinaTipo: 'porcentaje',
          propinaOrigen: 'portal_qr',
          propinaPorcentaje: 10,
        });

        // La Caja abre el cobro: la del comensal ya está puesta, y lo dice.
        await tocarLaCuenta(rosa, MESA_C);
        const cobro = cobroDe(rosa, MESA_C);
        await yaAbierto(cobro);
        await expect(
          propinaDe(cobro).getByRole('button', { name: '10%', exact: true }),
        ).toHaveAttribute('aria-pressed', 'true');
        await expect(cobro.locator('[data-total-a-cobrar]')).toHaveText(
          enPantalla(VENTA + PROPINA),
        );

        // La cambia con un toque: ahora la decidió la Caja, y eso es lo que se cobra.
        await elegirEnLaCaja(rosa, cobro, '15%');
        expect(await cuentaEnElServidor(duena, ordenC)).toMatchObject({
          propinaTipo: 'porcentaje',
          propinaOrigen: 'caja',
          propinaPorcentaje: 15,
        });
        await expect(cobro.locator('[data-total-a-cobrar]')).toHaveText(
          enPantalla(VENTA + PROPINA_DE_15),
        );
        expect(await cobrarEnEfectivo(rosa, cobro)).toBe(String(PROPINA_DE_15));
        expect(await cuentaEnElServidor(duena, ordenC)).toMatchObject({
          estado: 'pagada',
          propinaOrigen: 'caja',
        });
      });

      for (const exigir of fallos) exigir();
    } finally {
      for (const telefono of telefonos) await telefono.cerrar();
      await equipo.cerrar();
    }
  });
});
