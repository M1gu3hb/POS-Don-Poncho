import {
  abrirElQrDeLaMesa,
  prepararElPortalDelComensal,
  botonDeLaMesa,
  dialogoDeLaMesa,
  laMesa,
  mesaEnElServidor,
  yaAbierto,
} from '../ayudantes/mesas-heredadas.ts';
import { Equipo } from '../ayudantes/roles.ts';
import { cabecerasDeEscrituraDePrueba, exigirDemostracion } from '../ayudantes/sesion.ts';

import { navegadorDe, prepararContexto } from './arnes/ligero.ts';
import { expect, exigirServidor, test } from './arnes/prueba.ts';
import { conRedCortada } from './arnes/red.ts';
import { toque } from './arnes/toque.ts';
import { vigilarPagina } from './arnes/vigilancia.ts';
import {
  SLUG,
  cajaAbierta,
  capturar,
  idDelPlatillo,
  precuentasImpresas,
  mesaConPedido,
  resetearLaDemo,
} from './parte7/comun.ts';

import type { Page } from '@playwright/test';

/**
 * PARTE 7 · puntos 1 (agotado al vuelo) y 2 (reimprimir; la comanda no se pierde), con el dedo.
 *
 * 1 · La cocina (tableta) marca «Guacamole con totopos» agotado; el mesero (otro aparato, con la mesa
 *     abierta y SIN recargar) lo ve «Agotado hoy» con el refresco normal de la pantalla (30 s), tocarlo
 *     no lo agrega, y al quitar el agotado vuelve a pedirse.
 * 2 · La precuenta se imprime y reimprime desde su diálogo y desde «Precuenta» (que la marca como
 *     reimpresión); la comanda es de pantalla: recargar la tableta de cocina o quedarse sin red no la
 *     pierde, y una comanda mandada sin red llega al volver.
 */

const PLATILLO = 'Guacamole con totopos';
const MESA = 5;

/** Cuenta cuántas veces la página mandó a imprimir (en el navegador `window.print` no saca papel). */
async function contarImpresiones(page: Page): Promise<void> {
  await page.addInitScript(() => {
    (window as unknown as { __impresiones: number }).__impresiones = 0;
    window.print = () => {
      (window as unknown as { __impresiones: number }).__impresiones += 1;
    };
  });
}

const impresiones = (page: Page): Promise<number> =>
  page.evaluate(() => (window as unknown as { __impresiones: number }).__impresiones);

test.describe('parte 7 · agotado y papel', () => {
  test.use({ actionTimeout: 60_000, navigationTimeout: 120_000 });

  test.beforeAll(async ({ playwright }, info) => {
    await exigirServidor(info.project.use.baseURL);
    await exigirDemostracion(playwright, info, SLUG);
  });

  test('1 · la cocina marca agotado y el mesero lo ve sin recargar; no se puede pedir; al quitarlo vuelve', async ({
    browser,
    aparato,
  }, info) => {
    test.setTimeout(10 * 60_000);
    const equipo = new Equipo(navegadorDe(browser, aparato), SLUG);
    try {
      const duena = await equipo.pagina(info, 'dueno');
      await prepararContexto(duena.context(), aparato);
      await resetearLaDemo(duena);
      const lupita = await equipo.pagina(info, 'mesero');
      await prepararContexto(lupita.context(), aparato);
      vigilarPagina(lupita);
      await mesaConPedido(lupita, duena, MESA, [{ nombre: 'Cerveza clara 355 ml' }]);
      await lupita.goto('/mesero', { waitUntil: 'domcontentloaded' });
      await toque(lupita, laMesa(lupita, MESA));
      const mesa = dialogoDeLaMesa(lupita, MESA);
      await yaAbierto(mesa);
      const tesela = mesa.getByRole('button', { name: new RegExp(`^${PLATILLO}`) });
      await expect(tesela).toBeVisible();
      await expect(tesela).not.toContainText('Agotado hoy');

      // La cocina lo marca con el dedo.
      const tono = await equipo.pagina(info, 'cocina');
      await prepararContexto(tono.context(), aparato);
      await tono.goto('/cocina', { waitUntil: 'domcontentloaded' });
      const interruptor = (): ReturnType<Page['getByRole']> =>
        tono.getByRole('switch', { name: `${PLATILLO}: agotado hoy` });
      await toque(tono, tono.getByRole('button', { name: 'Agotados', exact: true }));
      const dialogo = tono.getByRole('dialog', { name: 'Agotados del día' });
      await yaAbierto(dialogo);
      await toque(tono, interruptor());
      await expect(interruptor()).toBeChecked();
      await capturar(tono, 'agotado', aparato.id, 'cocina-marca');
      await toque(tono, dialogo.getByRole('button', { name: /Cerrar|Close/i }).first());

      // El portal del comensal (un teléfono sin sesión) también lo ve, con su refresco normal.
      await prepararElPortalDelComensal(duena, { mesa: MESA, zona: 'Interior', mesero: null });
      const token = (await mesaEnElServidor(duena, MESA)).qrToken ?? '';
      expect(token, 'La mesa no tiene su QR.').not.toBe('');
      const comensal = await abrirElQrDeLaMesa(browser, info, SLUG, token);
      try {
        const platilloDelPortal = comensal.page.getByText(PLATILLO).first();
        await expect(platilloDelPortal).toBeVisible({ timeout: 60_000 });
        await comensal.page.reload({ waitUntil: 'domcontentloaded' });
        await expect(
          comensal.page.getByText('Agotado hoy').first(),
          'El portal del comensal no muestra el agotado.',
        ).toBeVisible({ timeout: 60_000 });
        await capturar(comensal.page, 'agotado', aparato.id, 'portal-lo-ve');
      } finally {
        await comensal.cerrar();
      }

      // El mesero, SIN recargar, lo ve apagado con el refresco normal (30 s) y no lo puede pedir.
      await expect(
        tesela,
        'El mesero no vio el agotado sin recargar en el refresco normal.',
      ).toContainText('Agotado hoy', { timeout: 75_000 });
      await capturar(lupita, 'agotado', aparato.id, 'mesero-lo-ve');
      await toque(lupita, tesela);
      await expect(lupita.getByText(`${PLATILLO} se agotó por hoy`).first()).toBeVisible();
      await expect(
        mesa.getByRole('button', { name: /Enviar a Cocina/ }),
        'Tocar un agotado lo agregó al pedido.',
      ).toHaveCount(0);

      // El servidor también lo niega (el mesero no puede saltarse la pantalla).
      const platilloId = await idDelPlatillo(duena, PLATILLO);
      const { ordenId } = await mesaEnElServidor(duena, MESA);
      const rechazo = await lupita.request.post('/api/restaurante/enviar-pedido', {
        headers: cabecerasDeEscrituraDePrueba(),
        data: { ordenId, lineas: [{ productoId: platilloId, cantidad: '1' }] },
      });
      const textoDelRechazo = await rechazo.text();
      expect(
        rechazo.status(),
        `El servidor dejó pedir un platillo agotado: ${textoDelRechazo}`,
      ).toBe(422);
      expect(textoDelRechazo).toMatch(/agot/i);

      // Quitar el agotado lo devuelve.
      await toque(tono, tono.getByRole('button', { name: 'Agotados', exact: true }));
      await yaAbierto(dialogo);
      await toque(tono, interruptor());
      await expect(interruptor()).not.toBeChecked();
      await expect(tesela, 'El mesero no vio que el platillo volvió.').not.toContainText(
        'Agotado hoy',
        { timeout: 75_000 },
      );
      await toque(lupita, tesela);
      await expect(lupita.getByText(`${PLATILLO} se agotó por hoy`)).toHaveCount(0);
      await capturar(lupita, 'agotado', aparato.id, 'mesero-vuelve');
    } finally {
      await equipo.cerrar();
    }
  });

  test('2 · la precuenta se reimprime (y se marca) y la comanda no se pierde si la cocina se recarga o se queda sin red', async ({
    browser,
    aparato,
  }, info) => {
    test.setTimeout(10 * 60_000);
    const equipo = new Equipo(navegadorDe(browser, aparato), SLUG);
    try {
      const duena = await equipo.pagina(info, 'dueno');
      await prepararContexto(duena.context(), aparato);
      await resetearLaDemo(duena);
      const lupita = await equipo.pagina(info, 'mesero');
      await prepararContexto(lupita.context(), aparato);
      await contarImpresiones(lupita);
      vigilarPagina(lupita);
      const { ordenId } = await mesaConPedido(lupita, duena, MESA, [
        { nombre: 'Sopa de tortilla' },
      ]);

      // ── La comanda no se pierde: la cocina se recarga y la ve; sin red, tampoco ──────────────
      const tono = await equipo.pagina(info, 'cocina');
      await prepararContexto(tono.context(), aparato);
      await tono.goto('/cocina', { waitUntil: 'domcontentloaded' });
      const sopa = tono.getByText(/Sopa de tortilla/).first();
      await expect(sopa).toBeVisible({ timeout: 60_000 });
      await tono.reload({ waitUntil: 'domcontentloaded' });
      await expect(sopa, 'La comanda no volvió a salir al recargar la cocina.').toBeVisible({
        timeout: 60_000,
      });
      await capturar(tono, 'reimprimir', aparato.id, 'cocina-recargada');
      await conRedCortada(tono.context(), 8, async () => {
        // Mientras la cocina no tiene red, el mesero manda otra comanda.
        const cerveza = await idDelPlatillo(duena, 'Cerveza clara 355 ml');
        const enviada = await lupita.request.post('/api/restaurante/enviar-pedido', {
          headers: cabecerasDeEscrituraDePrueba(),
          data: { ordenId, lineas: [{ productoId: cerveza, cantidad: '1' }] },
        });
        expect(enviada.status(), await enviada.text()).toBe(200);
        // La que ya estaba se sigue viendo con la red cortada (la pantalla no se vacía).
        await expect(sopa).toBeVisible();
      });
      await expect(
        tono.getByText(/Cerveza clara 355 ml/).first(),
        'La comanda mandada mientras la cocina no tenía red no llegó al volver.',
      ).toBeVisible({ timeout: 60_000 });
      await capturar(tono, 'reimprimir', aparato.id, 'cocina-tras-la-red');

      const rosa = await equipo.pagina(info, 'cajero');
      await prepararContexto(rosa.context(), aparato);
      await cajaAbierta(rosa);
      // ── La precuenta: el diálogo «Pre-cuenta lista» imprime y reimprime ───────────────────────
      await lupita.goto('/mesero', { waitUntil: 'domcontentloaded' });
      await toque(lupita, laMesa(lupita, MESA));
      const mesa = dialogoDeLaMesa(lupita, MESA);
      await yaAbierto(mesa);
      await toque(lupita, await botonDeLaMesa(lupita, MESA, 'Solicitar cuenta'));
      const pregunta = lupita.getByRole('dialog').filter({ hasText: '¿Desean agregar propina?' });
      await yaAbierto(pregunta);
      await toque(lupita, pregunta.getByRole('button', { name: 'Sin propina' }));
      const precuenta = lupita.getByRole('dialog').filter({ hasText: 'Pre-cuenta lista' });
      await yaAbierto(precuenta);
      await capturar(lupita, 'reimprimir', aparato.id, 'precuenta-lista');
      await toque(lupita, precuenta.getByRole('button', { name: 'Imprimir' }));
      await expect.poll(() => impresiones(lupita)).toBe(1);
      await toque(lupita, precuenta.getByRole('button', { name: 'Imprimir' }));
      await expect.poll(() => impresiones(lupita)).toBe(2);
      await expect
        .poll(() => precuentasImpresas(ordenId), {
          message: 'El servidor no contó las dos impresiones de la precuenta.',
        })
        .toBe(2);
      await toque(lupita, precuenta.getByRole('button', { name: 'Cerrar' }).first());

      // ── Y después, «Precuenta» la trae otra vez, marcada como reimpresión ────────────────────
      await lupita.goto(`/restaurante/precuenta?cuenta=${ordenId}`, {
        waitUntil: 'domcontentloaded',
      });
      const hoja = lupita.getByRole('article', { name: /^Precuenta de la mesa/ });
      await expect(hoja).toBeVisible({ timeout: 60_000 });
      await capturar(lupita, 'reimprimir', aparato.id, 'precuenta-pagina');
      // Con el dedo: «Imprimir» cuenta la hoja en el servidor, la completa con el total y la marca.
      await toque(lupita, lupita.getByRole('button', { name: 'Imprimir' }));
      await expect(
        hoja.getByText(/REIMPRESIÓN · 3ª HOJA/),
        'La tercera hoja de la misma cuenta no salió marcada como reimpresión.',
      ).toBeVisible();
      await expect(hoja).toContainText('TOTAL$170.00');
      await capturar(lupita, 'reimprimir', aparato.id, 'precuenta-reimpresa');
      expect(precuentasImpresas(ordenId)).toBe(3);
    } finally {
      await equipo.cerrar();
    }
  });
});
