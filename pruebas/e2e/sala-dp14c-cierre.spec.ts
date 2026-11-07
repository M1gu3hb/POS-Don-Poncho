import { expect, test } from '@playwright/test';

import { sesionDeLaCaja } from './ayudantes/conciliacion.ts';
import {
  abrirElCobro,
  abrirLaCaja,
  abrirLaMesa,
  alMapa,
  CARTA,
  cerrarElTicket,
  cocinaDejaLista,
  comandar,
  cuentaEnElServidor,
  entregar,
  exigirEstadoDeLaMesa,
  importeDe,
  leerElCobro,
  mesaEnElServidor,
  pedirLaCuenta,
  pesos,
  type PlatilloPedido,
} from './ayudantes/mesas-heredadas.ts';
import { Equipo } from './ayudantes/roles.ts';
import {
  cabecerasDeEscrituraDePrueba,
  exigirDemostracion,
  vigilarFallos,
} from './ayudantes/sesion.ts';

/**
 * DP-14.6 (medios 1 y 9) · UNA PARTE SE CANCELA, Y EL CIERRE DEL DÍA SUELTA LA MESA EN LIMPIEZA.
 *
 * La mesa 4 pide y se divide en dos partes; la dueña cancela una (las partes nacen sin mesa y
 * `cancelar_orden` las rechazaba) y la caja cobra la otra: la mesa queda en limpieza. Al cerrar el
 * día, el diálogo de las mesas pendientes trae «Marcar libre» para esa mesa —no hay dinero
 * pendiente— y la mesa dividida no se queda con una venta activa.
 */

const SLUG = 'prueba-restaurante';
const MESA = 4;
const PEDIDO: readonly PlatilloPedido[] = [
  { nombre: CARTA.arrachera.nombre, veces: 1 },
  { nombre: CARTA.cerveza.nombre, veces: 1 },
];

test.describe('cancelar una parte y cerrar el día (DP-14.6)', () => {
  test.use({ actionTimeout: 20_000, navigationTimeout: 30_000 });

  test.beforeAll(async ({ playwright }, info) => {
    await exigirDemostracion(playwright, info, SLUG);
  });

  test('la dueña cancela una parte, la caja cobra la otra y el cierre del día suelta la mesa', async ({
    browser,
  }, info) => {
    test.setTimeout(8 * 60_000);
    const equipo = new Equipo(browser, SLUG);
    const duena = await equipo.pagina(info, 'dueno');
    const resetear = async () => {
      const respuesta = await duena.request.post('/api/pruebas/resetear', {
        headers: cabecerasDeEscrituraDePrueba(),
        data: { confirmacion: 'RESETEAR' },
      });
      expect(respuesta.status(), `resetear: ${await respuesta.text()}`).toBe(200);
    };
    await resetear();

    const rosa = await equipo.pagina(info, 'cajero');
    const lupita = await equipo.pagina(info, 'mesero');
    const tono = await equipo.pagina(info, 'cocina');
    const fallos = [rosa, lupita, tono].map((p) => vigilarFallos(p));
    await rosa.goto('/');
    await rosa.waitForURL(/\/caja$/);
    await lupita.goto('/');
    await lupita.waitForURL(/\/mesero$/);
    await tono.goto('/');
    await tono.waitForURL(/\/cocina$/);
    if ((await sesionDeLaCaja(rosa)) === null) await abrirLaCaja(rosa, 150_000);

    let ordenId = '';
    let partes: string[] = [];
    await test.step('Lupita sirve la mesa, pide la cuenta y Rosa la divide en dos partes', async () => {
      ordenId = (await abrirLaMesa(lupita, duena, MESA, 2)).ordenId;
      await comandar(lupita, MESA, PEDIDO);
      await alMapa(lupita);
      await cocinaDejaLista(tono, duena, ordenId, 2);
      await entregar(lupita, MESA);
      await pedirLaCuenta(lupita, MESA, 'Sin propina', importeDe(PEDIDO));
      await alMapa(lupita);

      const cobro = await abrirElCobro(rosa, MESA);
      await cobro.getByRole('button', { name: /^Dividir\b/ }).click();
      const dialogo = rosa.getByRole('dialog', { name: 'Dividir la cuenta' });
      for (const [cuenta, platillo] of [CARTA.arrachera.nombre, CARTA.cerveza.nombre].entries()) {
        await dialogo
          .getByRole('button', {
            name: `Añadir ${platillo} a la cuenta ${String(cuenta + 1)}`,
            exact: true,
          })
          .click();
      }
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
        readonly datos?: { readonly hijas?: readonly { readonly ordenId: string }[] };
      };
      partes = (cuerpo.datos?.hijas ?? []).map((h) => h.ordenId);
      expect(partes).toHaveLength(2);
      await expect(dialogo).toHaveCount(0);
    });

    await test.step('la dueña cancela la segunda parte: queda cancelada y la madre suma la otra', async () => {
      const antes = await cuentaEnElServidor(duena, ordenId);
      const parte = await cuentaEnElServidor(duena, partes[1] ?? '');
      const r = await duena.request.post('/api/restaurante/cancelar-orden', {
        headers: cabecerasDeEscrituraDePrueba(),
        data: { ordenId: partes[1], motivo: 'El comensal ya no la paga' },
      });
      expect(r.status(), await r.text()).toBe(200);
      expect((await cuentaEnElServidor(duena, partes[1] ?? '')).estado).toBe('cancelada');
      expect((await cuentaEnElServidor(duena, ordenId)).totalCentavos).toBe(
        antes.totalCentavos - parte.totalCentavos,
      );
      // Queda una por cobrar: la mesa sigue en servicio, con su cuenta.
      expect((await mesaEnElServidor(duena, MESA)).estado).toBe('cuenta_solicitada');
      await rosa.getByRole('tab', { name: /^Pendientes/ }).click();
      await expect(
        rosa.getByRole('button', { name: new RegExp(`^Mesa ${String(MESA)} · cuenta 2 de 2 `) }),
        'La parte cancelada siguió en Pendientes.',
      ).toHaveCount(0, { timeout: 30_000 });
    });

    await test.step('Rosa cobra la parte que queda y la mesa pasa a limpieza', async () => {
      const total = (await cuentaEnElServidor(duena, partes[0] ?? '')).totalCentavos;
      await rosa
        .getByRole('button', { name: new RegExp(`^Mesa ${String(MESA)} · cuenta 1 de 2 `) })
        .first()
        .click();
      const dialogo = rosa.getByRole('dialog').filter({ hasText: 'Cobrar' }).last();
      await dialogo.getByRole('button', { name: 'Efectivo', exact: true }).click();
      await dialogo.getByPlaceholder('0.00').fill(pesos(total));
      const cobrado = rosa.waitForResponse(
        (r) => new URL(r.url()).pathname === '/api/venta/cobrar',
      );
      await dialogo.getByRole('button', { name: /^Cobrar \$/ }).click();
      expect((await leerElCobro(await cobrado)).ok).toBe(true);
      await cerrarElTicket(rosa);
      await exigirEstadoDeLaMesa(
        duena,
        MESA,
        'limpieza',
        'La última parte viva no dejó la mesa en limpieza.',
      );
    });

    await test.step('el cierre del día lista la mesa y «Marcar libre» la suelta', async () => {
      const cierreDiario = rosa.getByRole('button', { name: /^(Cierre diario|Cierre)$/ });
      await cierreDiario.click();
      const pendientes = rosa.getByRole('dialog').filter({ hasText: 'No puedes cerrar caja' });
      await expect(pendientes).toBeVisible();
      await expect(pendientes.getByText(`Mesa ${String(MESA)}`)).toBeVisible();
      // La mesa cobrada conserva el id de su cuenta, pero no dice «venta activa»: no hay qué cobrar.
      await expect(pendientes.getByText('Con venta activa')).toHaveCount(0);
      await pendientes.locator('[data-marcar-libre]').click();
      await expect(
        pendientes.getByText('Listo: ya puedes intentar el cierre otra vez.'),
      ).toBeVisible();
      await exigirEstadoDeLaMesa(duena, MESA, 'libre', 'Marcar libre no soltó la mesa.');
      const mesa = await mesaEnElServidor(duena, MESA);
      expect(mesa.ordenId, 'La mesa dividida se quedó con una venta activa.').toBeNull();
      // Sin mesas pendientes, el cierre del día abre su formulario.
      await pendientes.getByRole('button', { name: 'Entendido' }).click();
      await cierreDiario.click();
      await expect(
        rosa.getByRole('dialog').filter({ hasText: 'Cierre de caja diario' }),
      ).toBeVisible();
    });

    for (const exigirSinFallos of fallos) exigirSinFallos();
    await resetear();
    await equipo.cerrar();
  });
});
