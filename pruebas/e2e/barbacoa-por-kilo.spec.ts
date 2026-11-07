import { expect, test, type Page } from '@playwright/test';

import { sesionDeLaCaja } from './ayudantes/conciliacion.ts';
import {
  altaDeLaBarbacoa,
  BARBACOA,
  lineasDeBarbacoa,
  PESOS,
  TOTAL_DE_LOS_PESOS,
} from './ayudantes/barbacoa.ts';
import {
  abrirElCobro,
  abrirLaCaja,
  abrirLaMesa,
  alMapa,
  botonDeLaMesa,
  cerrarElTicket,
  cuentaEnElServidor,
  dialogoDeLaMesa,
  leerElCobro,
  pagosDeLaCuenta,
  pedirLaCuenta,
} from './ayudantes/mesas-heredadas.ts';
import { Equipo } from './ayudantes/roles.ts';
import {
  cabecerasDeEscrituraDePrueba,
  exigirDemostracion,
  vigilarFallos,
} from './ayudantes/sesion.ts';

/**
 * DP-14.1-5 · LA BARBACOA POR KILO, DE PUNTA A PUNTA (mesero en tableta, cocina, caja y dividir).
 *
 * $795 el kilo. Lupita agrega 1/4, 1/2, 3/4, 1 y 1.5 kg —con los atajos y con «otro peso»— y manda a
 * cocina; la comanda dice «½ kg», no «0.5». Rosa divide la cuenta en el cobro: la barbacoa va
 * COMPLETA a una parte, y las partes suman la cuenta al centavo. Cada parte se cobra en efectivo
 * exacto. Todo se lee del SERVIDOR.
 */

const SLUG = 'prueba-restaurante';
const MESA = 3;
const ATAJOS: ReadonlySet<number> = new Set([0.25, 0.5, 1]);

/** Agrega UN peso desde el diálogo de cantidad: con su atajo si lo tiene, si no tecleándolo. */
async function agregarPeso(page: Page, kilos: number, dicho: string): Promise<void> {
  const mesa = dialogoDeLaMesa(page, MESA);
  await mesa
    .getByRole('button', { name: new RegExp(`^${BARBACOA.nombre}`) })
    .first()
    .click();
  const cantidad = page.getByRole('dialog', { name: BARBACOA.nombre });
  await expect(cantidad).toBeVisible();
  if (ATAJOS.has(kilos)) {
    await cantidad.getByRole('button', { name: dicho, exact: true }).click();
  } else {
    await cantidad.getByRole('spinbutton').fill(String(kilos));
  }
  await cantidad.getByRole('button', { name: 'Agregar al pedido' }).click();
  await expect(cantidad).toHaveCount(0);
}

test.describe('la barbacoa por kilo, de la mesa a la caja', () => {
  test.use({ actionTimeout: 20_000, navigationTimeout: 30_000 });

  test.beforeAll(async ({ playwright }, info) => {
    await exigirDemostracion(playwright, info, SLUG);
  });

  test('se agrega por peso, la comanda dice «½ kg», se divide completa y se cobra al centavo', async ({
    browser,
  }, info) => {
    test.setTimeout(5 * 60_000);
    const equipo = new Equipo(browser, SLUG);
    const duena = await equipo.pagina(info, 'dueno');
    const reseteo = await duena.request.post('/api/pruebas/resetear', {
      headers: cabecerasDeEscrituraDePrueba(),
      data: { confirmacion: 'RESETEAR' },
    });
    expect(reseteo.status(), `resetear: ${await reseteo.text()}`).toBe(200);
    await altaDeLaBarbacoa(duena);

    const rosa = await equipo.pagina(info, 'cajero');
    const lupita = await equipo.pagina(info, 'mesero');
    const tono = await equipo.pagina(info, 'cocina');
    // El 400/422 que la pantalla espera al dividir no se cuenta como fallo mientras se espera.
    const fallos = [duena, rosa, lupita, tono].map((p) => vigilarFallos(p));
    await rosa.goto('/');
    await rosa.waitForURL(/\/caja$/);
    await lupita.goto('/');
    await lupita.waitForURL(/\/mesero$/);
    await tono.goto('/');
    await tono.waitForURL(/\/cocina$/);
    if ((await sesionDeLaCaja(rosa)) === null) await abrirLaCaja(rosa, 150_000);

    let ordenId = '';
    await test.step('Lupita agrega cinco pesos y los manda a cocina', async () => {
      ordenId = (await abrirLaMesa(lupita, duena, MESA, 2)).ordenId;
      for (const { kilos, dicho } of PESOS) await agregarPeso(lupita, kilos, dicho);
      const boton = await botonDeLaMesa(lupita, MESA, 'Enviar a Cocina');
      const enviada = lupita.waitForResponse(
        (r) =>
          new URL(r.url()).pathname === '/api/restaurante/enviar-pedido' &&
          r.request().method() === 'POST',
      );
      await boton.click();
      expect((await enviada).status()).toBe(200);
      await expect(lupita.getByText('¡Pedido enviado a cocina!').first()).toBeVisible({
        timeout: 30_000,
      });
    });

    await test.step('el servidor guardó cada peso exacto y su importe al centavo', async () => {
      const lineas = await lineasDeBarbacoa(duena, ordenId);
      expect(lineas).toEqual(PESOS.map((p) => ({ kilos: p.kilos, centavos: p.centavos })));
      expect((await cuentaEnElServidor(duena, ordenId)).totalCentavos).toBe(TOTAL_DE_LOS_PESOS);
    });

    await test.step('la comanda de cocina dice «½ kg», no «0.5»', async () => {
      // En el teléfono la tarjeta del tablero heredado sale compacta y no enseña los platillos.
      if (info.project.name !== 'telefono') {
        for (const { dicho } of PESOS) {
          await expect(tono.getByText(dicho, { exact: false }).first()).toBeVisible({
            timeout: 30_000,
          });
        }
        await expect(tono.getByText(/\b0\.5\s*×|\b0\.25\s*×/)).toHaveCount(0);
      }
      await duena.goto('/restaurante/cocina');
      await expect(duena.getByText('½ kg').first()).toBeVisible({ timeout: 30_000 });
      await expect(duena.getByText('1.5 kg').first()).toBeVisible();
    });

    await test.step('Lupita pide la cuenta y el total es $3,180.00', async () => {
      await pedirLaCuenta(lupita, MESA, 'Sin propina', TOTAL_DE_LOS_PESOS);
      await alMapa(lupita);
      await expect
        .poll(async () => (await cuentaEnElServidor(duena, ordenId)).estado)
        .toBe('cuenta_solicitada');
    });

    let partes: readonly string[] = [];
    await test.step('Rosa divide: ¼, ½ y ¾ a la cuenta 1; 1 y 1.5 kg a la cuenta 2', async () => {
      const cobro = await abrirElCobro(rosa, MESA);
      await cobro.getByRole('button', { name: /^Dividir\b/ }).click();
      const dialogo = rosa.getByRole('dialog', { name: 'Dividir la cuenta' });
      // Cada renglón es una sola pieza: con su peso a la vista y con un solo «+» que la lleva entera.
      for (const { dicho } of PESOS) await expect(dialogo.getByText(dicho).first()).toBeVisible();
      const anadir = dialogo.getByRole('button', {
        name: `Añadir ${BARBACOA.nombre} a la cuenta 1`,
        exact: true,
      });
      const anadir2 = dialogo.getByRole('button', {
        name: `Añadir ${BARBACOA.nombre} a la cuenta 2`,
        exact: true,
      });
      for (const n of [0, 1, 2]) await anadir.nth(n).click();
      for (const n of [3, 4]) await anadir2.nth(n).click();
      await expect(dialogo.getByText('Todo repartido')).toBeVisible();
      const [respuesta] = await Promise.all([
        rosa.waitForResponse(
          (r) =>
            new URL(r.url()).pathname === '/api/restaurante/dividir-cuenta' &&
            r.request().method() === 'POST',
        ),
        dialogo.getByRole('button', { name: /^Dividir en 2 cuentas/ }).click(),
      ]);
      expect(respuesta.status(), await respuesta.text()).toBe(200);
      const cuerpo = (await respuesta.json()) as {
        datos?: { hijas?: { ordenId: string; totalCentavos: string }[] };
      };
      const hijas = cuerpo.datos?.hijas ?? [];
      expect(hijas.map((h) => h.totalCentavos)).toEqual(['119250', '198750']);
      partes = hijas.map((h) => h.ordenId);
      expect((await cuentaEnElServidor(duena, ordenId)).estado).toBe('dividida');
    });

    await test.step('la barbacoa está COMPLETA en su parte y las partes suman la madre', async () => {
      const [uno, dos] = await Promise.all(partes.map((id) => lineasDeBarbacoa(duena, id)));
      expect(uno).toEqual(PESOS.slice(0, 3).map((p) => ({ kilos: p.kilos, centavos: p.centavos })));
      expect(dos).toEqual(PESOS.slice(3).map((p) => ({ kilos: p.kilos, centavos: p.centavos })));
      expect(await lineasDeBarbacoa(duena, ordenId), 'la madre se quedó con consumo').toEqual([]);
      const totales = await Promise.all(partes.map((id) => cuentaEnElServidor(duena, id)));
      expect(totales.reduce((s, c) => s + c.totalCentavos, 0)).toBe(TOTAL_DE_LOS_PESOS);
    });

    await test.step('Rosa cobra cada parte en efectivo exacto y el ticket suma el total', async () => {
      for (const [i, esperado] of [119_250, 198_750].entries()) {
        await rosa.getByRole('tab', { name: /^Pendientes/ }).click();
        await rosa
          .getByRole('button', {
            name: new RegExp(`^Mesa ${String(MESA)} · cuenta ${String(i + 1)} de 2 `),
          })
          .first()
          .click();
        const dialogo = rosa.getByRole('dialog').filter({ hasText: 'Cobrar' }).last();
        await dialogo.getByRole('button', { name: 'Efectivo', exact: true }).click();
        await dialogo.getByPlaceholder('0.00').fill((esperado / 100).toFixed(2));
        const cobrado = rosa.waitForResponse(
          (r) => new URL(r.url()).pathname === '/api/venta/cobrar',
        );
        await dialogo.getByRole('button', { name: /^Cobrar \$/ }).click();
        const resultado = await leerElCobro(await cobrado);
        expect(resultado.ok, resultado.mensaje ?? '').toBe(true);
        expect(resultado.datos?.totalCentavos).toBe(String(esperado));
        const ticket = rosa.getByRole('dialog').filter({ hasText: 'TICKET DE PAGO' });
        await expect(ticket).toContainText(
          `$${(esperado / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
        );
        await cerrarElTicket(rosa);
        const pagos = await pagosDeLaCuenta(duena, partes[i] ?? '');
        expect(pagos.efectivo).toBe(esperado);
      }
      const pagadas = await Promise.all(partes.map((id) => cuentaEnElServidor(duena, id)));
      expect(pagadas.map((c) => c.estado)).toEqual(['pagada', 'pagada']);
    });

    for (const sinFallos of fallos) sinFallos();
    await equipo.cerrar();
  });
});
