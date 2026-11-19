import {
  CARTA,
  abrirElQrDeLaMesa,
  comandasDeLaCuenta,
  cuentaEnElServidor,
  mesaEnElServidor,
  prepararElPortalDelComensal,
  unidadesPorPlatillo,
  type TelefonoDelComensal,
} from '../../ayudantes/mesas-heredadas.ts';
import { Equipo } from '../../ayudantes/roles.ts';
import { exigirDemostracion } from '../../ayudantes/sesion.ts';
import { navegadorDe, prepararContexto } from '../arnes/ligero.ts';
import { expect, exigirServidor, test } from '../arnes/prueba.ts';
import { toque } from '../arnes/toque.ts';
import { capturar, resetearLaDemo } from '../parte7/comun.ts';

import type { Page } from '@playwright/test';

/**
 * DIRECTA 2 · «CONFIRMAR PEDIDO DEL PORTAL» CON EL CARRITO ARMADO RÁPIDO (D22-007, 021, 023…).
 *
 * Dos aparatos: el teléfono del comensal (Pixel 7, sin sesión) y el teléfono del mesero (360×800 del
 * arnés). El comensal agrega TRES platillos seguidos, sin esperar los avisos, y llama al mesero; el
 * mesero entra por Solicitudes → Atender (como el bot) y abre «Portal de la mesa · modo mesero»:
 * deben estar los tres. Confirma: la cuenta trae los tres y el total correcto. Cinco rondas, en cinco
 * mesas CERRADAS (el camino de abrir-mesa + confirmar). Se cuentan los POST abortados.
 */
const SLUG = 'prueba-restaurante';
const MESAS = [1, 2, 3, 4, 5];
const PEDIDO = [CARTA.guacamole, CARTA.cerveza, CARTA.sopa] as const;
const TOTAL = PEDIDO.reduce((s, p) => s + p.centavos, 0);

function tarjetaDe(telefono: Page, nombre: string) {
  return telefono
    .locator('button.menu-tarjeta')
    .filter({ has: telefono.getByText(nombre, { exact: true }) });
}

test.describe('D2 · confirmar el pedido del portal armado rápido', () => {
  test.use({ actionTimeout: 45_000, navigationTimeout: 120_000 });

  test.beforeAll(async ({ playwright }, info) => {
    await exigirServidor(info.project.use.baseURL);
    await exigirDemostracion(playwright, info, SLUG);
  });

  test('D2 · tres platillos rápidos llegan completos al mesero y a la cuenta, cinco veces', async ({
    browser,
    aparato,
  }, info) => {
    test.setTimeout(20 * 60_000);
    const equipo = new Equipo(navegadorDe(browser, aparato), SLUG);
    const telefonos: TelefonoDelComensal[] = [];
    const abortados: string[] = [];
    try {
      const duena = await equipo.pagina(info, 'dueno');
      await prepararContexto(duena.context(), aparato);
      await resetearLaDemo(duena);
      await prepararElPortalDelComensal(duena, {
        mesa: MESAS[0] ?? 1,
        zona: 'Interior',
        mesero: null,
        pedidosDelComensal: true,
        envian: 'mesero',
      });

      const mesero = await equipo.pagina(info, 'mesero');
      await prepararContexto(mesero.context(), aparato);
      mesero.on('requestfailed', (p) => {
        if (p.url().includes('/api/'))
          abortados.push(
            `${p.method()} ${new URL(p.url()).pathname} ${p.failure()?.errorText ?? ''}`,
          );
      });
      await mesero.goto('/mesero', { waitUntil: 'domcontentloaded' });

      for (const mesa of MESAS) {
        await test.step(`ronda · mesa ${String(mesa)}`, async () => {
          const { qrToken, ordenId: antes } = await mesaEnElServidor(duena, mesa);
          expect(qrToken, `La mesa ${String(mesa)} no tiene QR.`).not.toBeNull();
          expect(antes, `La mesa ${String(mesa)} ya estaba abierta.`).toBeNull();
          const comensal = await abrirElQrDeLaMesa(browser, info, SLUG, qrToken ?? '');
          telefonos.push(comensal);
          const tel = comensal.page;

          // Tres platillos SEGUIDOS: sin esperar el aviso de «agregado» entre uno y otro.
          for (const p of PEDIDO) {
            await tarjetaDe(tel, p.nombre).click();
            await tel.getByRole('button', { name: /^Agregar/ }).click();
          }
          await tel.getByRole('button', { name: /^Pedido de la mesa \(3\)/ }).click();
          const hoja = tel.getByRole('dialog', { name: 'El pedido de la mesa' });
          await hoja.getByRole('button', { name: 'Llamar a mi mesero para confirmar' }).click();
          await expect(
            tel
              .getByText('Tu pedido está guardado. Tu mesero lo confirma y lo manda a cocina.')
              .first(),
          ).toBeVisible();

          // El mesero, con el dedo, por donde lo hace el bot.
          await toque(mesero, mesero.getByRole('button', { name: /^Solicitudes/ }));
          await toque(mesero, mesero.getByRole('button', { name: /^Atender/ }).first());
          await toque(mesero, mesero.getByRole('button', { name: 'Mesas', exact: true }));
          const portal = mesero.getByRole('dialog', { name: 'Portal de la mesa · modo mesero' });
          await portal.waitFor();
          const abrir = portal.getByRole('button', { name: 'Abrir la mesa' });
          const confirmar = portal.getByRole('button', { name: 'Confirmar y enviar a cocina' });
          await abrir.or(confirmar).first().waitFor({ timeout: 30_000 });
          // LA COMPROBACIÓN: están los tres, antes de hacer nada.
          const lineas = portal.getByRole('button', { name: /^Quitar / });
          await expect(lineas, 'El diálogo del mesero no trae los tres platillos.').toHaveCount(3);
          await capturar(
            mesero,
            'directas',
            aparato.id,
            `d2-mesa-${String(mesa)}-antes-de-confirmar`,
          );
          if (await abrir.isVisible()) {
            await portal
              .getByText('Personas', { exact: true })
              .locator('xpath=following::input[1]')
              .fill('2');
            await toque(mesero, abrir);
          }
          await confirmar.waitFor();
          await toque(mesero, confirmar);
          await expect(
            mesero.getByText(`Pedido de la mesa ${String(mesa)} enviado a cocina.`),
          ).toBeVisible();

          const { ordenId } = await mesaEnElServidor(duena, mesa);
          expect(ordenId).not.toBeNull();
          const comandas = await comandasDeLaCuenta(duena, ordenId ?? '');
          expect(unidadesPorPlatillo(comandas)).toEqual(
            [...PEDIDO].map((p) => [p.nombre, 1] as const).sort(([a], [b]) => a.localeCompare(b)),
          );
          const cuenta = await cuentaEnElServidor(duena, ordenId ?? '');
          expect(
            cuenta.totalCentavos,
            'El total de la cuenta no es el de los tres platillos.',
          ).toBe(TOTAL);
          await toque(mesero, mesero.getByRole('button', { name: 'Mesas', exact: true })).catch(
            () => undefined,
          );
          await comensal.cerrar();
          telefonos.pop();
        });
      }
      console.warn(
        `D2 abortados del mesero: ${abortados.length} ${JSON.stringify(abortados.slice(0, 10))}`,
      );
    } finally {
      for (const t of telefonos) await t.cerrar();
      await equipo.cerrar();
    }
  });
});
