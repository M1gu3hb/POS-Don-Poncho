import {
  cancelarLaCuentaDeLaMesa,
  comandaNueva,
  resetearLaDemo,
} from '../ayudantes/modo-espera.ts';
import { exigirDemostracion } from '../ayudantes/sesion.ts';

import { escribirEnCampo, irASeccion } from './arnes/configuracion.ts';
import { expect, exigirServidor, test } from './arnes/prueba.ts';
import { VariosAparatos } from './arnes/varios-aparatos.ts';
import { toque } from './arnes/toque.ts';

/**
 * DP-22 · LOS AJUSTES DE LA COCINA, CON EL DEDO Y DONDE SE VEN.
 *
 *   cocina_alerta_ambar_min · cocina_alerta_roja_min — la dueña los cambia en Configuración → Cocina
 *   («Alertas de espera de la cocina») y la comanda de la pantalla de Cocina se pinta ámbar y roja a
 *   los minutos que ella dijo, no a los de siempre (10 y 20). El reloj de la página va adelantado
 *   con el reloj de Playwright, así que no se espera de verdad.
 */

const SLUG = 'prueba-restaurante';

test.describe('las alertas de espera de la cocina', () => {
  test.use({ actionTimeout: 30_000, navigationTimeout: 60_000 });

  test.beforeAll(async ({ playwright }, info) => {
    await exigirServidor(info.project.use.baseURL);
    await exigirDemostracion(playwright, info, SLUG);
  });

  test('cocina_alerta_ambar_min y cocina_alerta_roja_min: la comanda cambia de color a los minutos de la dueña', async ({
    aparato,
  }, info) => {
    test.setTimeout(8 * 60_000);
    test.skip(
      aparato.id.includes('-c99'),
      'El reloj de Playwright (`page.clock`) no corre en el Chromium 99 del iMin: se prueba en Windows y en el teléfono.',
    );
    const aparatos = new VariosAparatos(info, SLUG);
    try {
      const duena = await aparatos.abrir({
        puesto: 'ajustes-cocina-duena',
        aparato: aparato.id,
        rol: 'dueno',
        ruta: '/',
      });
      await resetearLaDemo(duena.page);

      /** La dueña pone los minutos con el dedo y guarda la tarjeta. */
      async function ponerMinutos(ambar: string, roja: string): Promise<void> {
        const p = duena?.page;
        if (p === undefined) return;
        await irASeccion(p, 'cocina');
        // La tarjeta de alertas no es una región con nombre: se llega a su «Guardar» desde su título.
        const region = p
          .getByText('Alertas de espera de la cocina', { exact: true })
          .locator('xpath=ancestor::*[.//button[normalize-space(.)="Guardar"]][1]');
        await escribirEnCampo(p, region.getByLabel('Ámbar desde (minutos)'), ambar);
        await escribirEnCampo(p, region.getByLabel('Rojo desde (minutos)'), roja);
        const guardar = region.getByRole('button', { name: 'Guardar', exact: true });
        const respuesta = p.waitForResponse(
          (r) => r.request().method() === 'POST' && r.url().includes('/api/datos/escribir'),
        );
        await toque(p, guardar);
        expect((await respuesta).ok()).toBe(true);
      }

      /** La comanda de la cocina, con el reloj de la página adelantado esos minutos. */
      async function nivelA(minutos: string): Promise<string | null> {
        // La dueña ve la Cocina de todas las estaciones: otra pestaña suya, con el reloj de mentira.
        const p = await duena.context.newPage();
        try {
          const laConfiguracion = p.waitForResponse(
            (r) =>
              r.url().includes('/api/datos/consultar') &&
              (r.request().postData() ?? '').includes('ConfiguracionNegocio'),
          );
          await p.clock.install();
          await p.goto('/cocina', { waitUntil: 'domcontentloaded' });
          const tarjetaDeLaComanda = p
            .locator('li[data-nivel="verde"], li[data-nivel="ambar"], li[data-nivel="rojo"]')
            .first();
          // Con el reloj de mentira, lo que llega por react-query sólo aparece si el reloj corre.
          for (let vuelta = 0; vuelta < 60; vuelta += 1) {
            if (await tarjetaDeLaComanda.isVisible()) break;
            await p.clock.runFor(1_000);
            await p.waitForTimeout(500);
          }
          await expect(tarjetaDeLaComanda).toBeVisible();
          await laConfiguracion;
          await p.clock.runFor(1_000);
          await p.clock.fastForward(minutos);
          // El reloj de las tarjetas late cada 15 s: se deja correr para que repinte.
          await p.clock.runFor(20_000);
          return await tarjetaDeLaComanda.getAttribute('data-nivel');
        } finally {
          await p.close();
        }
      }

      try {
        await comandaNueva(duena.page);

        // 1 · Los minutos de la dueña: ámbar a 1, rojo a 2.
        await ponerMinutos('1', '2');
        expect(await nivelA('00:10')).toBe('verde');
        expect(await nivelA('01:10')).toBe('ambar');
        expect(await nivelA('02:30')).toBe('rojo');

        // 2 · Los de siempre (10 y 20): a los 2:30 la misma comanda sigue verde.
        await ponerMinutos('10', '20');
        expect(await nivelA('02:30')).toBe('verde');
        expect(await nivelA('11:00')).toBe('ambar');
        expect(await nivelA('21:00')).toBe('rojo');
      } finally {
        await cancelarLaCuentaDeLaMesa(duena.page);
      }
    } finally {
      await aparatos.cerrar();
    }
  });
});
