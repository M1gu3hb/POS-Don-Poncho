import { expect, test, type Page } from '@playwright/test';

import { altaDeLaBarbacoa, BARBACOA, lineasDeBarbacoa } from './ayudantes/barbacoa.ts';
import {
  abrirElQrDeLaMesa,
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
 * DP-14.2 · LA BARBACOA POR KILO EN EL PORTAL DEL COMENSAL (teléfono, carrito compartido).
 *
 * El comensal elige ¼ kg con el atajo y 1.5 kg tecleándolo; el carrito de la mesa dice «¼ kg» y
 * «1.5 kg» (no «0.25» ni «1.5 ×»). Llama al mesero, que escanea el QR, confirma y manda a cocina.
 * El servidor guarda cada peso exacto, con su importe a $795/kg.
 */

const SLUG = 'prueba-restaurante';
const MESA = 5;

async function escanear(mesero: Page, mesa: number) {
  await mesero.getByRole('button', { name: 'Escanear QR' }).click();
  const deLaLista = mesero.getByRole('button', { name: `Mesa ${String(mesa)}`, exact: true });
  const elegir = mesero.getByRole('button', { name: 'Elegir la mesa' });
  await expect(deLaLista.or(elegir)).toBeVisible();
  if (await elegir.isVisible()) await elegir.click();
  await deLaLista.click();
}

async function agregarPeso(telefono: Page, atajo: string | null, kilos: number) {
  await telefono
    .locator('button.menu-tarjeta')
    .filter({ has: telefono.getByText(BARBACOA.nombre, { exact: true }) })
    .click();
  if (atajo !== null) {
    await telefono.getByRole('button', { name: atajo, exact: true }).click();
  } else {
    await telefono.getByRole('spinbutton').first().fill(String(kilos));
  }
  await telefono.getByRole('button', { name: /^Agregar/ }).click();
  await expect(
    telefono.getByText(`${BARBACOA.nombre} agregado al pedido de la mesa`).first(),
  ).toBeVisible();
}

test.describe('la barbacoa por kilo en el portal del comensal', () => {
  test.use({ actionTimeout: 20_000, navigationTimeout: 30_000 });

  test.beforeAll(async ({ playwright }, info) => {
    await exigirDemostracion(playwright, info, SLUG);
  });

  test('el comensal la pide por peso y el mesero la confirma', async ({ browser }, info) => {
    test.setTimeout(8 * 60_000);
    const equipo = new Equipo(browser, SLUG);
    const telefonos: TelefonoDelComensal[] = [];
    try {
      const duena = await equipo.pagina(info, 'dueno');
      const fallos = [vigilarFallos(duena)];
      const reseteo = await duena.request.post('/api/pruebas/resetear', {
        headers: cabecerasDeEscrituraDePrueba(),
        data: { confirmacion: 'RESETEAR' },
      });
      expect(reseteo.status(), `resetear: ${await reseteo.text()}`).toBe(200);
      await altaDeLaBarbacoa(duena);
      const token = await prepararElPortalDelComensal(duena, {
        mesa: MESA,
        zona: 'Interior',
        mesero: null,
        pedidosDelComensal: true,
        envian: 'mesero',
      });
      const telefono = await abrirElQrDeLaMesa(browser, info, SLUG, token);
      telefonos.push(telefono);
      const a = telefono.page;
      fallos.push(vigilarFallos(a));

      await test.step('elige ¼ kg con el atajo y 1.5 kg tecleado', async () => {
        await agregarPeso(a, '¼ kg', 0.25);
        await agregarPeso(a, null, 1.5);
      });

      await test.step('el carrito de la mesa dice los pesos, no «0.25»', async () => {
        await a.getByRole('button', { name: /^Pedido de la mesa \(2\)/ }).click();
        const hoja = a.getByRole('dialog', { name: 'El pedido de la mesa' });
        await expect(hoja.getByText(`¼ kg × ${BARBACOA.nombre}`)).toBeVisible();
        await expect(hoja.getByText(`1.5 kg × ${BARBACOA.nombre}`)).toBeVisible();
        await expect(hoja.getByText(/0\.25 ×/)).toHaveCount(0);
        await hoja.getByRole('button', { name: 'Llamar a mi mesero para confirmar' }).click();
        await expect(
          a
            .getByText('Tu pedido está guardado. Tu mesero lo confirma y lo manda a cocina.')
            .first(),
        ).toBeVisible();
      });

      const mesero = await equipo.pagina(info, 'mesero');
      fallos.push(vigilarFallos(mesero));
      if (info.project.name === 'tablet')
        await mesero.setViewportSize({ width: 1280, height: 800 });

      await test.step('el mesero escanea, abre la mesa, ve «¼ kg» sin ± y lo manda a cocina', async () => {
        await mesero.goto('/mesero');
        await escanear(mesero, MESA);
        const portal = mesero.getByRole('dialog', { name: 'Portal de la mesa · modo mesero' });
        await portal.getByRole('button', { name: 'Abrir la mesa' }).click();
        await expect.poll(async () => (await mesaEnElServidor(duena, MESA)).ordenId).not.toBeNull();
        await expect(portal.getByText('¼ kg').first()).toBeVisible();
        await expect(portal.getByText('1.5 kg').first()).toBeVisible();
        await expect(
          portal.getByRole('button', { name: `Uno menos de ${BARBACOA.nombre}` }),
        ).toHaveCount(0);
        await portal.getByRole('button', { name: 'Confirmar y enviar a cocina' }).click();
        await expect(mesero.getByText(/enviado a cocina/).first()).toBeVisible();
      });

      await test.step('el servidor guardó 0.25 y 1.5 kg con su importe exacto', async () => {
        const { ordenId } = await mesaEnElServidor(duena, MESA);
        expect(await lineasDeBarbacoa(duena, ordenId ?? '')).toEqual([
          { kilos: 0.25, centavos: 19_875 },
          { kilos: 1.5, centavos: 119_250 },
        ]);
      });

      for (const sinFallos of fallos) sinFallos();
    } finally {
      for (const t of telefonos) await t.cerrar();
      await equipo.cerrar();
    }
  });
});
