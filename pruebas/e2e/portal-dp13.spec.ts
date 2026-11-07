import { expect, type Page, test, type TestInfo } from '@playwright/test';

import {
  abrirElQrDeLaMesa,
  CARTA,
  comandasDeLaCuenta,
  contarPeticiones,
  mesaEnElServidor,
  prepararElPortalDelComensal,
  type TelefonoDelComensal,
} from './ayudantes/mesas-heredadas.ts';
import { escribir } from './ayudantes/modo-espera.ts';
import { enviarElPedidoDeLaMesa } from './ayudantes/pedido-de-la-mesa.ts';
import { Equipo } from './ayudantes/roles.ts';
import {
  cabecerasDeEscrituraDePrueba,
  exigirDemostracion,
  vigilarFallos,
} from './ayudantes/sesion.ts';

/**
 * DP-13.3 · EL PORTAL DEL COMENSAL, lo que se ve (teléfono, tableta y escritorio):
 *
 *   · el comensal se entera cuando el mesero vacía su pedido («Tu mesero vació el pedido», una vez);
 *   · «Abrir la mesa y enviar» es UN comando: si el envío se rechaza no queda una mesa abierta sin
 *     pedido, y el que sale abre y manda sin llamar aparte a abrir la mesa;
 *   · con la cuenta ya pedida el comensal lee «Tu cuenta ya se pidió: tu mesero lo revisa» (no un
 *     error) y el mesero puede reabrirla y enviar el pedido desde «Pedido del portal».
 */

const SLUG = 'prueba-restaurante';
const MESA = 5;
const CUENTA_PEDIDA = 'Tu cuenta ya se pidió: tu mesero lo revisa.';

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

/** «Escanear QR» sin cámara: el lector ofrece elegir la mesa de una lista. */
async function escanear(mesero: Page, mesa: number) {
  await mesero.getByRole('button', { name: 'Escanear QR' }).click();
  const deLaLista = mesero.getByRole('button', { name: `Mesa ${String(mesa)}`, exact: true });
  const elegir = mesero.getByRole('button', { name: 'Elegir la mesa' });
  await expect(deLaLista.or(elegir)).toBeVisible();
  if (await elegir.isVisible()) await elegir.click();
  await deLaLista.click();
}

/** La tableta del encargo es de 1280 × 800; el proyecto `tablet` trae otra medida. */
async function aLaMedida(pagina: Page, info: TestInfo): Promise<void> {
  if (info.project.name === 'tablet') await pagina.setViewportSize({ width: 1280, height: 800 });
}

async function empezar(
  equipo: Equipo,
  info: TestInfo,
  que: { readonly envian: 'mesero' | 'comensales' },
) {
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
    envian: que.envian,
    // Con los comensales enviando, también abren su mesa (si no, sólo piden que los atiendan).
    abrenMesa: que.envian === 'comensales',
  });
  return { duena, token };
}

test.describe('el portal del comensal (DP-13.3)', () => {
  test.use({ actionTimeout: 20_000, navigationTimeout: 30_000 });

  test.beforeAll(async ({ playwright }, info) => {
    await exigirDemostracion(playwright, info, SLUG);
  });

  test('el mesero vacía el pedido y el comensal se entera, una sola vez', async ({
    browser,
  }, info) => {
    test.setTimeout(5 * 60_000);
    const equipo = new Equipo(browser, SLUG);
    const telefonos: TelefonoDelComensal[] = [];
    const fallos: (() => void)[] = [];
    try {
      const { token } = await empezar(equipo, info, { envian: 'mesero' });
      const [a, b] = [
        await abrirElQrDeLaMesa(browser, info, SLUG, token),
        await abrirElQrDeLaMesa(browser, info, SLUG, token),
      ];
      telefonos.push(a, b);
      fallos.push(vigilarFallos(a.page), vigilarFallos(b.page));
      await agregar(a.page, CARTA.cerveza.nombre);
      await expect(b.page.getByRole('button', { name: /^Pedido de la mesa \(1\)/ })).toBeVisible();

      const mesero = await equipo.pagina(info, 'mesero');
      await aLaMedida(mesero, info);
      fallos.push(vigilarFallos(mesero));
      await mesero.goto('/mesero');
      await escanear(mesero, MESA);
      await mesero.getByRole('button', { name: 'Borrar el pedido' }).click();
      await mesero
        .getByRole('alertdialog')
        .getByRole('button', { name: 'Borrar el pedido' })
        .click();

      for (const telefono of [a.page, b.page]) {
        await expect(telefono.getByText('Tu mesero vació el pedido')).toBeVisible();
        await expect(telefono.getByRole('button', { name: /^Pedido de la mesa/ })).toBeHidden();
      }
      // DP-14.6: el aviso se queda fijo hasta que el comensal lo cierra, y cerrado no vuelve por
      // más sondeos que haya.
      const aviso = a.page.getByText('Tu mesero vació el pedido');
      for (let i = 0; i < 2; i++) {
        await a.page.waitForResponse(
          (r) =>
            r.url().endsWith(`/api/publico/qr/${token}/carrito`) && r.request().method() === 'POST',
        );
      }
      await expect(aviso).toBeVisible();
      await a.page.locator('[data-cerrar-aviso-vaciado]').click();
      await expect(aviso).toBeHidden();
      for (let i = 0; i < 2; i++) {
        await a.page.waitForResponse(
          (r) =>
            r.url().endsWith(`/api/publico/qr/${token}/carrito`) && r.request().method() === 'POST',
        );
      }
      await expect(aviso).toHaveCount(0);
      for (const sinFallos of fallos) sinFallos();
    } finally {
      for (const telefono of telefonos) await telefono.cerrar();
      await equipo.cerrar();
    }
  });

  test('«Abrir la mesa y enviar» es un solo comando: si se rechaza, la mesa no queda abierta', async ({
    browser,
  }, info) => {
    test.setTimeout(5 * 60_000);
    const equipo = new Equipo(browser, SLUG);
    const telefonos: TelefonoDelComensal[] = [];
    const fallos: (() => void)[] = [];
    // El rechazo que la pantalla ESPERA (un 422 de negocio) se perdona sólo mientras se espera.
    let esperandoElRechazo = false;
    try {
      const { duena, token } = await empezar(equipo, info, { envian: 'comensales' });
      const telefono = await abrirElQrDeLaMesa(browser, info, SLUG, token);
      telefonos.push(telefono);
      const a = telefono.page;
      fallos.push(vigilarFallos(duena), vigilarFallos(a, { sondeando: () => esperandoElRechazo }));
      const abrirAparte = contarPeticiones(a, `/api/publico/qr/${token}/mesa`);
      const envios = contarPeticiones(a, `/api/publico/qr/${token}/carrito/enviar`);
      await agregar(a, CARTA.arrachera.nombre);

      await a.getByRole('button', { name: /^Pedido de la mesa/ }).click();
      await a
        .getByRole('dialog', { name: 'El pedido de la mesa' })
        .getByRole('button', { name: 'Abrir la mesa y enviar' })
        .click();
      await a.getByRole('spinbutton').first().fill('3');

      await test.step('el envío se rechaza: ni mesa abierta ni pedido', async () => {
        esperandoElRechazo = true;
        await a.route(`**/api/publico/qr/${token}/carrito/enviar`, (ruta) =>
          ruta.fulfill({
            status: 422,
            contentType: 'application/json',
            body: JSON.stringify({
              ok: false,
              error: {
                codigo: 'REGLA_DE_NEGOCIO',
                mensaje: 'Prueba: el envío se rechazó.',
                datos: { regla: 'QR_CARRITO_LLENO' },
              },
            }),
          }),
        );
        await a.getByRole('button', { name: 'Abrir mesa', exact: true }).click();
        await expect(a.getByText('Prueba: el envío se rechazó.')).toBeVisible();
        expect((await mesaEnElServidor(duena, MESA)).ordenId, 'Quedó una mesa abierta.').toBeNull();
        expect(abrirAparte.enviadas(), 'La pantalla abrió la mesa por su lado.').toBe(0);
        await a.unroute(`**/api/publico/qr/${token}/carrito/enviar`);
        esperandoElRechazo = false;
      });

      await test.step('el reintento abre y manda en una sola petición', async () => {
        const enviado = a.waitForResponse(
          (r) => r.url().endsWith(`/carrito/enviar`) && r.request().method() === 'POST',
        );
        await a.getByRole('button', { name: 'Abrir mesa', exact: true }).click();
        expect((await enviado).status()).toBe(200);
        await expect(
          a.getByText(`¡Pedido enviado a cocina! Mesa ${String(MESA)} abierta.`),
        ).toBeVisible();
        expect(abrirAparte.enviadas(), 'La pantalla abrió la mesa por su lado.').toBe(0);
        expect(envios.enviadas()).toBe(2);
        const { ordenId } = await mesaEnElServidor(duena, MESA);
        expect(ordenId, 'La mesa no quedó abierta.').not.toBeNull();
        const comandas = await comandasDeLaCuenta(duena, ordenId ?? '');
        expect(comandas.flatMap((c) => c.items.map((i) => i.nombre))).toEqual([
          CARTA.arrachera.nombre,
        ]);
      });
      for (const sinFallos of fallos) sinFallos();
    } finally {
      for (const telefono of telefonos) await telefono.cerrar();
      await equipo.cerrar();
    }
  });

  test('con la cuenta ya pedida: mensaje claro al comensal; el mesero reabre y envía', async ({
    browser,
  }, info) => {
    test.setTimeout(6 * 60_000);
    const equipo = new Equipo(browser, SLUG);
    const telefonos: TelefonoDelComensal[] = [];
    const fallos: (() => void)[] = [];
    try {
      const { duena, token } = await empezar(equipo, info, { envian: 'comensales' });
      const telefono = await abrirElQrDeLaMesa(browser, info, SLUG, token);
      telefonos.push(telefono);
      const a = telefono.page;
      fallos.push(vigilarFallos(duena), vigilarFallos(a));

      await agregar(a, CARTA.arrachera.nombre);
      const primero = await enviarElPedidoDeLaMesa(a, token, 2);
      expect(primero.status()).toBe(200);
      const { ordenId } = await mesaEnElServidor(duena, MESA);
      expect(ordenId).not.toBeNull();

      await test.step('piden la cuenta con un platillo más armado en el teléfono', async () => {
        await agregar(a, CARTA.cerveza.nombre);
        await escribir(duena, '/api/restaurante/solicitar-cuenta', { ordenId });
        // El pedido armado no desaparece: se sigue viendo, con el mensaje y sin botón de enviar.
        await a.getByRole('button', { name: /^Pedido de la mesa \(1\)/ }).click();
        const hoja = a.getByRole('dialog', { name: 'El pedido de la mesa' });
        await expect(hoja.getByText(CUENTA_PEDIDA)).toBeVisible();
        await expect(hoja.getByRole('button', { name: 'Llamar a mi mesero' })).toBeVisible();
        await expect(hoja.getByRole('button', { name: 'Enviar a cocina' })).toHaveCount(0);
        await hoja.getByRole('button', { name: 'Seguir viendo el menú' }).click();
      });

      const mesero = await equipo.pagina(info, 'mesero');
      await aLaMedida(mesero, info);
      fallos.push(vigilarFallos(mesero));
      await test.step('el mesero reabre la cuenta y envía desde «Pedido del portal»', async () => {
        await mesero.goto('/mesero');
        await escanear(mesero, MESA);
        const portal = mesero.getByRole('dialog', { name: 'Portal de la mesa · modo mesero' });
        await expect(portal.getByText(/La cuenta de esta mesa ya se pidió/)).toBeVisible();
        await portal.getByRole('button', { name: 'Reabrir la cuenta y enviar' }).click();
        await mesero
          .getByRole('alertdialog')
          .getByRole('button', { name: 'Reabrir y enviar' })
          .click();
        await expect(
          mesero.getByText(`Pedido de la mesa ${String(MESA)} enviado a cocina.`),
        ).toBeVisible();
        await expect(a.getByText(/Pedido enviado: la cocina ya lo tiene/)).toBeVisible();
        await expect(a.getByRole('button', { name: /^Pedido de la mesa/ })).toBeHidden();
        expect((await mesaEnElServidor(duena, MESA)).estado).not.toBe('cuenta_solicitada');
        const comandas = await comandasDeLaCuenta(duena, ordenId ?? '');
        expect(comandas.flatMap((c) => c.items.map((i) => i.nombre)).sort()).toEqual(
          [CARTA.arrachera.nombre, CARTA.cerveza.nombre].sort(),
        );
      });
      for (const sinFallos of fallos) sinFallos();
    } finally {
      for (const telefono of telefonos) await telefono.cerrar();
      await equipo.cerrar();
    }
  });
});
