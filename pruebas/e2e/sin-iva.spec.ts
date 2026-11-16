import { expect, test, type Locator, type Page } from '@playwright/test';

import { pedirLaCuenta } from './ayudantes/cancelar-desde-la-mesa.ts';
import { sesionDeLaCaja } from './ayudantes/conciliacion.ts';
import {
  abrirElCobro,
  abrirLaCaja,
  abrirLaMesa,
  alMapa,
  CARTA,
  cerrarElTicket,
  comandar,
  enPantalla,
  leerElCobro,
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
 * DP-21 · Bloque 1 · EL IVA, DE PUNTA A PUNTA CON «SIN IVA» (M9 y O1).
 *
 * Lo que vio Miguel: ponía el IVA en 0 en Configuración y el ticket seguía diciendo «IVA 13.79 %».
 * Ese campo guardaba una clave que nadie leía. Ahora el campo «IVA» es el que manda (Sin IVA, 8 %,
 * 16 % y «Los precios ya incluyen el IVA»), lo guarda su propio comando, y con «Sin IVA» ningún
 * papel ni pantalla menciona el IVA: si el IVA de lo que se enseña es 0, el renglón no existe.
 *
 * La dueña lo cambia POR LA PANTALLA; la mesera comanda; la cajera cobra. El cobro y el ticket no
 * dicen «IVA» y el total es la suma de los renglones. Después, con 16 % incluido, el mismo camino
 * SÍ lo dice: la prueba distingue un caso del otro. Corre en serie (`--workers=1`): resetea la demo
 * y cambia el IVA del negocio de prueba, que al final queda en 16 % incluido, como nació.
 */

const SLUG = 'prueba-restaurante';
const PEDIDO: readonly PlatilloPedido[] = [
  { nombre: CARTA.arrachera.nombre, veces: 1 },
  { nombre: CARTA.cerveza.nombre, veces: 1 },
];
const IMPORTE = CARTA.arrachera.centavos + CARTA.cerveza.centavos;

type Tasa = 'Sin IVA' | '8 %' | '16 %';

/** Configuración → el IVA, por la pantalla: elegir, guardar y ver «✓ Guardado». */
async function elegirElIva(duena: Page, tasa: Tasa): Promise<void> {
  await duena.goto('/configuracion?seccion=ventas-y-cobro');
  const tarjeta = duena.getByRole('region', { name: 'IVA', exact: true });
  const opcion = tarjeta.getByRole('radio', { name: tasa, exact: true });
  await expect(opcion).toBeVisible();
  const guardar = tarjeta.getByRole('button', { name: 'Guardar', exact: true });
  if ((await opcion.getAttribute('aria-checked')) !== 'true') await opcion.click();
  if (tasa !== 'Sin IVA') {
    const incluido = tarjeta.getByRole('switch', { name: 'Los precios ya incluyen el IVA' });
    if ((await incluido.getAttribute('aria-checked')) !== 'true') await incluido.click();
  }
  if (await guardar.isEnabled()) {
    const guardado = duena.waitForResponse(
      (r) => new URL(r.url()).pathname === '/api/configuracion/fijar-impuesto',
    );
    await guardar.click();
    expect((await guardado).status()).toBe(200);
    await expect(tarjeta.getByRole('status')).toHaveText('✓ Guardado');
  }
  // Lo guardado es lo que se lee al volver a entrar.
  await duena.reload();
  await expect(
    duena
      .getByRole('region', { name: 'IVA', exact: true })
      .getByRole('radio', { name: tasa, exact: true }),
  ).toHaveAttribute('aria-checked', 'true');
}

interface Cobrada {
  readonly cobro: string;
  readonly ticket: string;
  readonly totalCentavos: string | undefined;
}

/** Mesa → comanda → cuenta → cobro en efectivo. Devuelve lo que decían el cobro y el ticket. */
async function venderYCobrar(
  mesa: number,
  rosa: Page,
  lupita: Page,
  duena: Page,
): Promise<Cobrada> {
  const { ordenId } = await abrirLaMesa(lupita, duena, mesa, 2);
  await comandar(lupita, mesa, PEDIDO);
  await alMapa(lupita);
  await pedirLaCuenta(lupita, ordenId);

  const cobro: Locator = await abrirElCobro(rosa, mesa);
  await expect(cobro.getByText(enPantalla(IMPORTE)).first()).toBeVisible();
  const textoDelCobro = (await cobro.innerText()).replace(/\s+/g, ' ');
  await cobro.getByRole('button', { name: 'Efectivo', exact: true }).click();
  await cobro.getByPlaceholder('0.00').fill((IMPORTE / 100).toFixed(2));
  const cobrado = rosa.waitForResponse((r) => new URL(r.url()).pathname === '/api/venta/cobrar');
  await cobro.getByRole('button', { name: /^Cobrar \$/ }).click();
  const resultado = await leerElCobro(await cobrado);
  expect(resultado.ok, resultado.mensaje ?? '').toBe(true);
  const ticket = rosa.getByRole('dialog').filter({ hasText: 'TICKET DE PAGO' });
  await yaAbierto(ticket);
  const textoDelTicket = (await ticket.innerText()).replace(/\s+/g, ' ');
  await cerrarElTicket(rosa);
  return {
    cobro: textoDelCobro,
    ticket: textoDelTicket,
    totalCentavos: resultado.datos?.totalCentavos,
  };
}

test.describe('el IVA del negocio (DP-21 · Bloque 1)', () => {
  test.use({ actionTimeout: 20_000, navigationTimeout: 30_000 });

  test.beforeAll(async ({ playwright }, info) => {
    await exigirDemostracion(playwright, info, SLUG);
  });

  test('con «Sin IVA» ni el cobro ni el ticket mencionan el IVA; con 16 % incluido, sí', async ({
    browser,
  }, info) => {
    test.setTimeout(10 * 60_000);
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

    try {
      await test.step('la dueña elige «Sin IVA» en Configuración y queda guardado', async () => {
        await elegirElIva(duena, 'Sin IVA');
      });

      await rosa.goto('/');
      await rosa.waitForURL(/\/caja$/);
      await lupita.goto('/');
      await lupita.waitForURL(/\/mesero$/);
      if ((await sesionDeLaCaja(rosa)) === null) await abrirLaCaja(rosa, 150_000);

      await test.step('sin IVA: el cobro y el ticket no lo mencionan, y el total es el de los renglones', async () => {
        const sinIva = await venderYCobrar(3, rosa, lupita, duena);
        expect(sinIva.totalCentavos).toBe(String(IMPORTE));
        expect(sinIva.cobro).not.toMatch(/IVA/i);
        expect(sinIva.ticket).not.toMatch(/IVA/i);
        expect(sinIva.ticket).toContain(enPantalla(IMPORTE));
      });

      await test.step('con 16 % incluido, el mismo camino sí dice «IVA incluido» y cobra lo mismo', async () => {
        await elegirElIva(duena, '16 %');
        const conIva = await venderYCobrar(4, rosa, lupita, duena);
        expect(conIva.totalCentavos).toBe(String(IMPORTE));
        expect(conIva.cobro).toMatch(/IVA incluido/);
        expect(conIva.ticket).toMatch(/IVA/);
      });
    } finally {
      // El negocio de prueba queda como nació: 16 %, con el IVA dentro del precio.
      await elegirElIva(duena, '16 %').catch(() => undefined);
    }
    for (const exigir of fallos) exigir();
  });
});
