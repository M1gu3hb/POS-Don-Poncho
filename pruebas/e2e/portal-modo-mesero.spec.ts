import { expect, type Locator, type Page, test, type TestInfo } from '@playwright/test';

import {
  abrirElQrDeLaMesa,
  CARTA,
  comandasDeLaCuenta,
  mesaEnElServidor,
  prepararElPortalDelComensal,
  type TelefonoDelComensal,
} from './ayudantes/mesas-heredadas.ts';
import { Equipo } from './ayudantes/roles.ts';
import {
  cabecerasDeEscrituraDePrueba,
  exigirDemostracion,
  vigilarFallos,
} from './ayudantes/sesion.ts';

/**
 * DP-12.2 · EL PORTAL CON LA MESA CERRADA Y EL MESERO QUE CONFIRMA, en escritorio, tableta (a
 * 1280 × 800) y teléfono, con tacto real donde se mantiene presionado.
 *
 * Dos teléfonos arman el pedido con la mesa cerrada y llaman al mesero. El mesero escanea el QR,
 * abre la mesa, quita una línea y lo manda a cocina a su nombre; los teléfonos ven «Pedido
 * enviado». Luego borra el pedido de unos comensales que se fueron. Y mantener presionada una mesa
 * abre «Ver mesa / Ver QR de la mesa»; el QR se cierra con «Cancelar».
 */

const SLUG = 'prueba-restaurante';
const MESA = 5;

function tarjetaDe(telefono: Page, nombre: string) {
  return telefono
    .locator('button.rounded-2xl')
    .filter({ has: telefono.getByText(nombre, { exact: true }) });
}

async function agregar(telefono: Page, nombre: string) {
  await tarjetaDe(telefono, nombre).click();
  await telefono.getByRole('button', { name: /^Agregar/ }).click();
  await expect(telefono.getByText(`${nombre} agregado al pedido de la mesa`)).toBeVisible();
}

/**
 * «Escanear QR» con lo que leería la cámara: en el navegador de pruebas no hay cámara, así que se
 * teclea en la entrada manual del lector (la que queda abierta si ya se usó).
 */
async function escanear(mesero: Page, leido: string) {
  await mesero.getByRole('button', { name: 'Escanear QR' }).click();
  const manual = mesero.getByRole('button', { name: 'Ingresar manual' });
  if (await manual.isVisible()) await manual.click();
  await mesero.getByPlaceholder('Escribe o escanea con lector USB...').fill(leido);
  await mesero.getByRole('button', { name: 'Confirmar código' }).click();
}

/** La tableta del encargo es de 1280 × 800; el proyecto `tablet` trae otra medida. */
async function aLaMedida(pagina: Page, info: TestInfo): Promise<void> {
  if (info.project.name === 'tablet') await pagina.setViewportSize({ width: 1280, height: 800 });
}

/** Mantener presionada con el dedo (tacto real por CDP) o, con ratón, el clic derecho. */
async function mantenerPresionada(pagina: Page, info: TestInfo, objetivo: Locator) {
  const caja = await objetivo.boundingBox();
  if (caja === null) throw new Error('La mesa no está a la vista.');
  const [x, y] = [caja.x + caja.width / 2, caja.y + caja.height / 2];
  if (info.project.use.hasTouch !== true) {
    await pagina.mouse.click(x, y, { button: 'right' });
    return;
  }
  const cdp = await pagina.context().newCDPSession(pagina);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  // Es el gesto mismo, no una espera de algo: el dedo se queda 700 ms sobre la mesa.
  await pagina.waitForTimeout(700);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}

test.describe('el portal en modo mesero (DP-12.2)', () => {
  test.use({ actionTimeout: 20_000, navigationTimeout: 30_000 });

  test.beforeAll(async ({ playwright }, info) => {
    await exigirDemostracion(playwright, info, SLUG);
  });

  test('la mesa cerrada arma su pedido, el mesero escanea, confirma, envía y borra', async ({
    browser,
  }, info) => {
    test.setTimeout(6 * 60_000);
    const equipo = new Equipo(browser, SLUG);
    const telefonos: TelefonoDelComensal[] = [];
    const fallos: (() => void)[] = [];
    try {
      const duena = await equipo.pagina(info, 'dueno');
      const reseteo = await duena.request.post('/api/pruebas/resetear', {
        headers: cabecerasDeEscrituraDePrueba(),
        data: { confirmacion: 'RESETEAR' },
      });
      expect(reseteo.status(), `resetear_demo: ${await reseteo.text()}`).toBe(200);
      const token = await prepararElPortalDelComensal(duena, {
        mesa: MESA,
        zona: 'Interior',
        mesero: null,
        pedidosDelComensal: true,
        envian: 'mesero',
      });

      const uno = await abrirElQrDeLaMesa(browser, info, SLUG, token);
      const dos = await abrirElQrDeLaMesa(browser, info, SLUG, token);
      telefonos.push(uno, dos);
      const [a, b] = [uno.page, dos.page];
      fallos.push(vigilarFallos(a), vigilarFallos(b));

      await test.step('con la mesa cerrada, dos teléfonos arman el pedido y llaman al mesero', async () => {
        await agregar(a, CARTA.cerveza.nombre);
        await agregar(b, CARTA.arrachera.nombre);
        expect((await mesaEnElServidor(duena, MESA)).ordenId, 'Se abrió la mesa.').toBeNull();
        await a.getByRole('button', { name: /^Pedido de la mesa \(2\)/ }).click();
        const hoja = a.getByRole('dialog', { name: 'El pedido de la mesa' });
        await expect(hoja.getByText(/abre la mesa/i)).toHaveCount(0);
        await hoja.getByRole('button', { name: 'Llamar a mi mesero para confirmar' }).click();
        await expect(
          a
            .getByText('Tu pedido está guardado. Tu mesero lo confirma y lo manda a cocina.')
            .first(),
        ).toBeVisible();
      });

      const mesero = await equipo.pagina(info, 'mesero');
      await aLaMedida(mesero, info);
      fallos.push(vigilarFallos(mesero));

      await test.step('el mesero ve el aviso como globo y escanea el QR de la mesa', async () => {
        await mesero.goto('/mesero');
        await expect(
          mesero.getByRole('button', { name: new RegExp(`^Mesa ${String(MESA)}: `) }),
        ).toBeVisible();
        await escanear(mesero, `${new URL(mesero.url()).origin}/qr/${token}`);
      });

      const portal = mesero.getByRole('dialog', { name: 'Portal de la mesa · modo mesero' });
      await test.step('abre la mesa, quita una línea y lo manda a cocina a su nombre', async () => {
        await expect(portal.getByText('Teléfono 1')).toBeVisible();
        await expect(portal.getByText('Teléfono 2')).toBeVisible();
        await portal.getByRole('button', { name: 'Abrir la mesa' }).click();
        await expect.poll(async () => (await mesaEnElServidor(duena, MESA)).ordenId).not.toBeNull();
        await portal.getByRole('button', { name: `Quitar ${CARTA.arrachera.nombre}` }).click();
        await expect(portal.getByText(CARTA.arrachera.nombre)).toHaveCount(0);
        await portal.getByRole('button', { name: 'Confirmar y enviar a cocina' }).click();
        await expect(
          mesero.getByText(`Pedido de la mesa ${String(MESA)} enviado a cocina.`),
        ).toBeVisible();
        for (const telefono of [a, b]) {
          await expect(telefono.getByText(/Pedido enviado: la cocina ya lo tiene/)).toBeVisible();
        }
        const { ordenId } = await mesaEnElServidor(duena, MESA);
        const comandas = await comandasDeLaCuenta(duena, ordenId ?? '');
        expect(comandas.flatMap((c) => c.items.map((i) => i.nombre))).toEqual([
          CARTA.cerveza.nombre,
        ]);
        expect(comandas.map((c) => c.origen)).not.toContain('portal_qr');
      });

      await test.step('la cocina lo recibe', async () => {
        const cocina = await equipo.pagina(info, 'cocina');
        fallos.push(vigilarFallos(cocina));
        await cocina.goto('/cocina');
        await expect(cocina.getByText(/pedido\(s\) activos/)).toBeVisible();
        if (info.project.name !== 'telefono') {
          await expect(cocina.getByText(CARTA.cerveza.nombre).first()).toBeVisible();
        }
      });

      await test.step('unos comensales se fueron: el mesero borra lo que dejaron', async () => {
        await agregar(a, CARTA.cerveza.nombre);
        await mesero.goto('/mesero');
        await escanear(mesero, token);
        await portal.getByRole('button', { name: 'Borrar el pedido' }).click();
        await mesero
          .getByRole('alertdialog')
          .getByRole('button', { name: 'Borrar el pedido' })
          .click();
        await expect(portal.getByText('Los comensales todavía no han armado nada.')).toBeVisible();
        await expect(a.getByRole('button', { name: /^Pedido de la mesa/ })).toBeHidden();
      });

      for (const sinFallos of fallos) sinFallos();
    } finally {
      for (const telefono of telefonos) await telefono.cerrar();
      await equipo.cerrar();
    }
  });

  test('mantener presionada una mesa: «Ver QR de la mesa» y «Cancelar»; un toque abre la mesa', async ({
    browser,
  }, info) => {
    test.setTimeout(3 * 60_000);
    const equipo = new Equipo(browser, SLUG);
    try {
      const duena = await equipo.pagina(info, 'dueno');
      await prepararElPortalDelComensal(duena, {
        mesa: MESA,
        zona: 'Interior',
        mesero: null,
        pedidosDelComensal: true,
        envian: 'mesero',
      });
      const mesero = await equipo.pagina(info, 'mesero');
      await aLaMedida(mesero, info);
      const sinFallos = vigilarFallos(mesero);
      await mesero.goto('/mesero');
      const mesa = mesero
        .locator(`[data-mesa-id]`)
        .filter({ hasText: String(MESA) })
        .first();
      await expect(mesa).toBeVisible();

      await mantenerPresionada(mesero, info, mesa);
      const globo = mesero.getByRole('menu', { name: `Mesa ${String(MESA)}` });
      await expect(globo).toBeVisible();
      await globo.getByRole('menuitem', { name: 'Ver QR de la mesa' }).click();
      const qr = mesero.getByRole('dialog', { name: `QR de la mesa ${String(MESA)}` });
      await expect(qr.locator('img[data-qr-de-la-mesa]')).toBeVisible();
      await qr.getByRole('button', { name: 'Cancelar' }).click();
      await expect(qr).toBeHidden();
      // El toque de siempre: la mesa libre pregunta cuántas personas son.
      await (info.project.use.hasTouch === true ? mesa.tap() : mesa.click());
      await expect(mesero.getByRole('dialog').first()).toBeVisible();
      sinFallos();
    } finally {
      await equipo.cerrar();
    }
  });
});
