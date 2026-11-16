import { expect, test, type Page } from '@playwright/test';

import { sesionDeLaCaja } from './ayudantes/conciliacion.ts';
import { exigirElPdfDelCorte } from './ayudantes/corte.ts';
import { pedirLaCuenta } from './ayudantes/cancelar-desde-la-mesa.ts';
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
  enPantalla,
  entregar,
  esperadoDelCajon,
  leerElCobro,
  yaAbierto,
  type PlatilloPedido,
} from './ayudantes/mesas-heredadas.ts';
import { Equipo } from './ayudantes/roles.ts';
import {
  abrirPantalla,
  cabecerasDeEscrituraDePrueba,
  exigirDemostracion,
  vigilarFallos,
} from './ayudantes/sesion.ts';

/**
 * DP-21 · Bloque 6 · FOLIOS DE VERDAD, de punta a punta.
 *
 * La dueña resetea la demo y, en Configuración (tarjeta «Folios»), pone el prefijo «DP» y el primer
 * folio 1001 para las cuentas y 101 para los cortes. La mesera abre la mesa, comanda y pide la
 * cuenta; la cajera cobra. Entonces:
 *   · el ticket dice «DP-01001» (y el servidor dio el folio 1001: el consecutivo es el de siempre);
 *   · en Ventas y en Registros, buscar «1001», «01001» y «DP-01001» encuentra esa cuenta;
 *   · al cerrar la caja, el corte dice «DPC-0101» (en pantalla y en la hoja del PDF).
 *
 * Al final (`finally`) la demo se resetea otra vez: el reseteo borra la configuración de folios y
 * sus contadores, así que las demás specs, que leen el folio «A-…», empiezan sin prefijo. Con
 * cuentas ya cobradas el primer folio no se puede regresar por la pantalla (sólo con los folios en
 * cero), por eso se usa el reseteo y no la tarjeta. Corre en serie (`--workers=1`).
 */

const SLUG = 'prueba-restaurante';
const MESA = 3;
const PEDIDO: readonly PlatilloPedido[] = [
  { nombre: CARTA.arrachera.nombre, veces: 1 },
  { nombre: CARTA.cerveza.nombre, veces: 1 },
];
const TOTAL = CARTA.arrachera.centavos + CARTA.cerveza.centavos;
const FONDO_CENTAVOS = 150_000;

const FOLIO_DE_LA_CUENTA = 'DP-01001';
const FOLIO_DEL_CORTE = 'DPC-0101';
/** Las tres maneras de teclear el mismo folio. */
const BUSQUEDAS = ['1001', '01001', FOLIO_DE_LA_CUENTA] as const;

async function resetear(duena: Page): Promise<void> {
  const reseteo = await duena.request.post('/api/pruebas/resetear', {
    headers: cabecerasDeEscrituraDePrueba(),
    data: { confirmacion: 'RESETEAR' },
    timeout: 120_000,
  });
  expect(reseteo.status(), await reseteo.text()).toBe(200);
}

/** La dueña pone prefijo y primeros folios en la tarjeta «Folios» y espera su «Guardado». */
async function fijarLosFolios(duena: Page): Promise<void> {
  await duena.goto('/configuracion?tab=negocio');
  const tarjeta = duena.getByRole('region', { name: 'Folios' });
  const prefijo = tarjeta.getByLabel('Prefijo del folio');
  const cuentas = tarjeta.getByLabel('Primer folio de las cuentas');
  const cortes = tarjeta.getByLabel('Primer folio de los cortes');
  // Con los folios en cero y sin operación real, los tres campos se pueden editar.
  await expect(cuentas).toBeEnabled({ timeout: 30_000 });
  await prefijo.fill('dp');
  await expect(prefijo, 'El prefijo se escribe en mayúsculas.').toHaveValue('DP');
  await cuentas.fill('1001');
  await cortes.fill('101');
  await expect(tarjeta).toContainText(
    `Así se verá: ${FOLIO_DE_LA_CUENTA} · corte ${FOLIO_DEL_CORTE}`,
  );
  const guardado = duena.waitForResponse(
    (r) => new URL(r.url()).pathname === '/api/configuracion/fijar-folios',
  );
  await tarjeta.getByRole('button', { name: 'Guardar' }).click();
  expect((await guardado).status(), 'El servidor rechazó los folios.').toBe(200);
  await expect(tarjeta.getByRole('status')).toHaveText('✓ Guardado');
}

test.describe('folios con prefijo (DP-21 · Bloque 6)', () => {
  test.use({ actionTimeout: 20_000, navigationTimeout: 30_000 });

  test.beforeAll(async ({ playwright }, info) => {
    await exigirDemostracion(playwright, info, SLUG);
  });

  test('prefijo «DP» y primer folio 1001/101: el ticket, la búsqueda y el corte lo dicen', async ({
    browser,
  }, info) => {
    test.setTimeout(10 * 60_000);
    const equipo = new Equipo(browser, SLUG);
    const duena = await equipo.pagina(info, 'dueno');
    try {
      await resetear(duena);
      await test.step('la dueña fija prefijo «DP» y primer folio 1001 / 101 en Configuración', async () => {
        await fijarLosFolios(duena);
      });

      // Las demás pantallas se abren DESPUÉS de guardar: leen la configuración al cargar.
      const rosa = await equipo.pagina(info, 'cajero');
      const lupita = await equipo.pagina(info, 'mesero');
      const tono = await equipo.pagina(info, 'cocina');
      const fallos = [
        vigilarFallos(rosa),
        vigilarFallos(lupita),
        vigilarFallos(tono),
        vigilarFallos(duena),
      ];
      await rosa.goto('/');
      await rosa.waitForURL(/\/caja$/);
      await lupita.goto('/');
      await lupita.waitForURL(/\/mesero$/);
      await tono.goto('/');
      await tono.waitForURL(/\/cocina$/);
      if ((await sesionDeLaCaja(rosa)) === null) await abrirLaCaja(rosa, FONDO_CENTAVOS);

      let ordenId = '';
      await test.step('la mesera abre la mesa, comanda, la cocina deja listo y pide la cuenta', async () => {
        ordenId = (await abrirLaMesa(lupita, duena, MESA, 2)).ordenId;
        await comandar(lupita, MESA, PEDIDO);
        await alMapa(lupita);
        await cocinaDejaLista(tono, duena, ordenId, 2);
        await entregar(lupita, MESA);
        await alMapa(lupita);
        await pedirLaCuenta(lupita, ordenId);
      });

      await test.step('la cajera cobra: el servidor da el folio 1001 y el ticket dice «DP-01001»', async () => {
        const cobro = await abrirElCobro(rosa, MESA);
        await cobro.getByRole('button', { name: 'Efectivo', exact: true }).click();
        await cobro.getByPlaceholder('0.00').fill((TOTAL / 100).toFixed(2));
        const cobrado = rosa.waitForResponse(
          (r) => new URL(r.url()).pathname === '/api/venta/cobrar',
        );
        await cobro.getByRole('button', { name: /^Cobrar \$/ }).click();
        const resultado = await leerElCobro(await cobrado);
        expect(resultado.ok, resultado.mensaje ?? '').toBe(true);
        expect(resultado.datos?.totalCentavos).toBe(String(TOTAL));
        expect(
          resultado.datos?.folio,
          'El consecutivo sigue siendo el de siempre: el primer folio configurado.',
        ).toBe('1001');
        const ticket = rosa.getByRole('dialog').filter({ hasText: 'TICKET DE PAGO' });
        await yaAbierto(ticket);
        await expect(ticket).toContainText(FOLIO_DE_LA_CUENTA);
        await expect(ticket).toContainText(enPantalla(TOTAL));
        await cerrarElTicket(rosa);
        expect((await cuentaEnElServidor(duena, ordenId)).estado).toBe('pagada');
      });

      await test.step('Ventas: «1001», «01001» y «DP-01001» encuentran la cuenta', async () => {
        await duena.goto('/ventas');
        const buscador = duena.getByPlaceholder('Buscar folio o cajero...');
        for (const texto of BUSQUEDAS) {
          await buscador.fill(texto);
          await expect(
            duena.getByText(FOLIO_DE_LA_CUENTA, { exact: true }),
            `Ventas no encontró la cuenta buscando «${texto}».`,
          ).toBeVisible();
        }
        await buscador.fill('DP-09999');
        await expect(duena.getByText(FOLIO_DE_LA_CUENTA, { exact: true })).toHaveCount(0);
      });

      await test.step('Registros → Ventas: «1001», «01001» y «DP-01001» encuentran la cuenta', async () => {
        await duena.goto('/registros');
        await duena.getByRole('tab', { name: /^Ventas/ }).click();
        const buscador = duena.getByPlaceholder(/^Buscar por código de corte/);
        for (const texto of BUSQUEDAS) {
          await buscador.fill(texto);
          await expect(
            duena.getByText(FOLIO_DE_LA_CUENTA, { exact: true }).first(),
            `Registros no encontró la cuenta buscando «${texto}».`,
          ).toBeVisible();
        }
      });

      await test.step('el cierre de caja dice el corte «DPC-0101», en pantalla y en la hoja del PDF', async () => {
        const esperado = await esperadoDelCajon(rosa);
        await abrirPantalla(rosa, '/restaurante/cierre-diario-y-arqueo', /Cierre diario/);
        await rosa.locator('#contado').fill((esperado / 100).toFixed(2));
        await rosa.locator('#fondo').fill((FONDO_CENTAVOS / 100).toFixed(2));
        await rosa.getByRole('button', { name: 'CERRAR CAJA' }).click();
        await rosa.getByRole('button', { name: 'Sí, cerrar el día' }).click({ timeout: 30_000 });
        await expect(rosa.getByRole('heading', { name: 'Caja cerrada' })).toBeVisible({
          timeout: 30_000,
        });
        await expect(rosa.getByText(new RegExp(`Corte ${FOLIO_DEL_CORTE}\\b`))).toBeVisible();
        await exigirElPdfDelCorte(rosa, {
          titulo: 'CORTE DE CAJA',
          textos: [`FOLIO: ${FOLIO_DEL_CORTE}`],
        });
      });

      for (const exigir of fallos) exigir();
    } finally {
      // La demo vuelve a nacer: sin prefijo, sin contadores y sin cuentas (lo que esperan las demás specs).
      await resetear(duena);
      await equipo.cerrar();
    }
  });
});
