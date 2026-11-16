import { expect, test, type Locator, type Page } from '@playwright/test';

import { sesionDeLaCaja } from './ayudantes/conciliacion.ts';
import { pedirLaCuenta } from './ayudantes/cancelar-desde-la-mesa.ts';
import {
  abrirElCobro,
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
 *       la Caja elige 10 %. El teléfono se entera solo, cierra esa pantalla y dice «Tu propina ya
 *       quedó registrada en caja». Y la propina que se cobra es la de la Caja.
 *   B · EL COMENSAL ELIGE PRIMERO. La Caja tiene el cobro abierto, sin propina elegida; el comensal
 *       confirma 10 %. La Caja recibe un aviso que INTERRUMPE («Los comensales eligieron 10 % de
 *       propina (…)») con «Usar ésa» y «Cambiarla». «Usar ésa» deja la del comensal y el cobro
 *       cobra esa propina.
 *
 * Lo que se afirma se lee al SERVIDOR (la cuenta y la respuesta del cobro), no al aviso. Corre en
 * serie (`--workers=1`): resetea la demo.
 */

const SLUG = 'prueba-restaurante';
const ZONA = 'Interior';
const MESA_A = 6;
const MESA_B = 5;
const FONDO_CENTAVOS = 150_000;
const PEDIDO: readonly PlatilloPedido[] = [
  { nombre: CARTA.arrachera.nombre, veces: 1 },
  { nombre: CARTA.cerveza.nombre, veces: 1 },
];
const VENTA = importeDe(PEDIDO);
/** El 10 % del total de la cuenta, en centavos: lo que la propina de cualquiera de las dos vale. */
const PROPINA = Math.round(VENTA * 0.1);

/** El diálogo de «¿Desean agregar propina?» (el mismo del mesero y de la Caja). */
function preguntaDePropina(page: Page): Locator {
  return page.getByRole('dialog').filter({ hasText: '¿Desean agregar propina?' });
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

  test('la Caja elige primero y el portal se cierra solo; el comensal elige primero y la Caja lo avisa', async ({
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
      });
      const tokenA = (await mesaEnElServidor(duena, MESA_A)).qrToken ?? '';
      const tokenB = (await mesaEnElServidor(duena, MESA_B)).qrToken ?? '';
      expect(tokenA, 'La mesa A no tiene su código QR.').not.toBe('');
      expect(tokenB, 'La mesa B no tiene su código QR.').not.toBe('');

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
        const cobro = await abrirElCobro(rosa, MESA_A);
        const pregunta = preguntaDePropina(rosa);
        await yaAbierto(pregunta);
        await pregunta.getByText('10%', { exact: true }).click();
        const fijada = rosa.waitForResponse(
          (r) => new URL(r.url()).pathname === '/api/venta/fijar-propina',
        );
        await pregunta.getByRole('button', { name: 'Aplicar' }).click();
        expect((await fijada).status(), 'El servidor no guardó la propina de la Caja.').toBe(200);

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
      await test.step('B: la Caja tiene el cobro abierto; el comensal confirma 10 %: aviso que interrumpe, «Usar ésa»', async () => {
        const ordenB = await mesaConLaCuentaPedida(lupita, duena, MESA_B, true);
        const comensal = await abrirElQrDeLaMesa(browser, info, SLUG, tokenB);
        telefonos.push(comensal);
        const telefono = comensal.page;
        fallos.push(vigilarFallos(telefono));
        const hoja = await abrirLaPantallaDePropina(telefono, MESA_B);

        // La Caja abre el cobro y deja sin elegir la propina: cierra la pregunta sin decidir.
        const cobro = await abrirElCobro(rosa, MESA_B);
        const pregunta = preguntaDePropina(rosa);
        if (await pregunta.isVisible()) {
          await rosa.keyboard.press('Escape');
          await expect(pregunta).toBeHidden();
        }

        // El comensal confirma primero: 10 %.
        await hoja.getByRole('button', { name: /^10%/ }).click();
        await hoja.getByRole('button', { name: 'Confirmar' }).click();
        await expect(telefono.getByText('¡Cuenta solicitada!')).toBeVisible();
        expect(await cuentaEnElServidor(duena, ordenB)).toMatchObject({
          propinaTipo: 'porcentaje',
          propinaOrigen: 'portal_qr',
          propinaPorcentaje: 10,
        });

        // La Caja, con el cobro abierto, recibe el aviso que interrumpe (no un toast).
        const aviso = rosa.getByRole('alertdialog');
        await expect(
          aviso,
          'La Caja no avisó que los comensales eligieron la propina.',
        ).toBeVisible({ timeout: 30_000 });
        await expect(aviso).toContainText(
          /Los comensales eligieron 10 % de propina \(\$\d+\.\d{2}\)/,
        );
        await expect(aviso.getByRole('button', { name: 'Usar ésa' })).toBeVisible();
        await expect(aviso.getByRole('button', { name: 'Cambiarla' })).toBeVisible();
        await aviso.getByRole('button', { name: 'Usar ésa' }).click();
        await expect(aviso).toBeHidden();

        // El cobro cobra la propina del comensal, y el servidor la sigue teniendo suya.
        expect(await cobrarEnEfectivo(rosa, cobro)).toBe(String(PROPINA));
        expect(await cuentaEnElServidor(duena, ordenB)).toMatchObject({
          estado: 'pagada',
          propinaTipo: 'porcentaje',
          propinaOrigen: 'portal_qr',
          propinaPorcentaje: 10,
        });
      });

      for (const exigir of fallos) exigir();
    } finally {
      for (const telefono of telefonos) await telefono.cerrar();
      await equipo.cerrar();
    }
  });
});
