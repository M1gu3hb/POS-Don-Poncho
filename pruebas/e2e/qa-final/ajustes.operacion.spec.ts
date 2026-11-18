import type { BrowserContext, Page } from '@playwright/test';

import { abrirConReloj, escribir, pinDe, resetearLaDemo } from '../ayudantes/modo-espera.ts';
import { opcionesDelProyecto, personaDe } from '../ayudantes/roles.ts';
import {
  abrirCajaPorLaRuta,
  consultarPuente,
  entrar,
  exigirDemostracion,
} from '../ayudantes/sesion.ts';

import { guardarTarjeta, irASeccion, tarjeta, traerAlDedo } from './arnes/configuracion.ts';
import { expect, exigirServidor, test } from './arnes/prueba.ts';
import { toque } from './arnes/toque.ts';
import { VariosAparatos } from './arnes/varios-aparatos.ts';

/**
 * DP-22 · AJUSTES DE LA OPERACIÓN, CON EL DEDO Y DONDE SE VEN.
 *
 *   candado_de_mando_min — «Entrar con PIN» (Personas): a los minutos que dice la dueña, y no a los de
 *     siempre, la pantalla del mando vuelve a pedir el PIN. El reloj de la página va adelantado con el
 *     de Playwright. Las pestañas del candado NO llevan la marca de «PIN ya tecleado» que el arnés les
 *     deja a las demás (esa marca no se borra nunca, y justo eso es lo que se prueba): cada una entra
 *     tecleando el PIN, como `pin-al-abrir.spec.ts`.
 *   descargar_pdf_corte_auto — «PDF del corte al cerrar» (Caja): con la casilla encendida el cierre
 *     del día baja el PDF del corte solo; apagada, no baja nada.
 */

const SLUG = 'prueba-restaurante';

test.describe('la operación', () => {
  test.use({ actionTimeout: 30_000, navigationTimeout: 60_000 });

  test.beforeAll(async ({ playwright }, info) => {
    await exigirServidor(info.project.use.baseURL);
    await exigirDemostracion(playwright, info, SLUG);
  });

  test('candado_de_mando_min: el PIN vuelve a pedirse a los minutos de la dueña y no antes', async ({
    browser,
    aparato,
  }, info) => {
    test.setTimeout(6 * 60_000);
    test.skip(
      aparato.id.includes('-c99'),
      'El reloj de Playwright (`page.clock`) no corre en el Chromium 99 del iMin: se prueba en Windows y en el teléfono.',
    );

    const contextos: BrowserContext[] = [];
    /** La dueña entra tecleando su PIN, en un navegador propio (sin la marca del arnés). */
    async function laDuenaEntra(): Promise<Page> {
      const contexto = await browser.newContext(opcionesDelProyecto(info));
      contextos.push(contexto);
      const pagina = await contexto.newPage();
      await entrar(pagina, personaDe(SLUG, 'dueno'));
      // La marca de «PIN tecleado» se escribe al terminar de entrar: navegar antes (en un teléfono
      // lento) deja la pantalla nueva sin ella y el candado la cerraría al abrir.
      await expect
        .poll(() =>
          pagina.evaluate(() =>
            Object.keys(window.sessionStorage).includes('morphiqpos.pin-de-esta-ejecucion'),
          ),
        )
        .toBe(true);
      return pagina;
    }
    try {
      const ajustes = await laDuenaEntra();

      /** «Entrar con PIN»: elige los minutos con el dedo y guarda la tarjeta. */
      async function fijarMinutos(minutos: string): Promise<void> {
        await irASeccion(ajustes, 'personas');
        const region = tarjeta(ajustes, 'Entrar con PIN');
        const elegir = region.getByLabel(/Pedir el PIN al dueño, al administrador y al gerente/);
        await elegir.selectOption(minutos);
        const guardar = region.getByRole('button', { name: 'Guardar', exact: true });
        await traerAlDedo(ajustes, guardar);
        const respuesta = ajustes.waitForResponse((r) =>
          r.url().includes('/api/configuracion/fijar-candado-de-mando'),
        );
        await toque(ajustes, guardar);
        expect((await respuesta).ok()).toBe(true);
        // Lo que quedó guardado en el servidor es lo que se eligió.
        const [configuracion] = await consultarPuente<{ candado_de_mando_min?: unknown }>(
          ajustes,
          'ConfiguracionNegocio',
          { limite: 1 },
        );
        expect(configuracion?.candado_de_mando_min).toBe(Number(minutos));
      }

      /** Una pantalla de la dueña con el reloj de Playwright y su configuración ya entregada. */
      async function conReloj(intento = 1): Promise<Page> {
        const pagina = await laDuenaEntra();
        const laConfiguracion = pagina.waitForResponse(
          (r) =>
            r.url().includes('/api/datos/consultar') &&
            (r.request().postData() ?? '').includes('ConfiguracionNegocio'),
        );
        await abrirConReloj(pagina, '/configuracion');
        await pagina.waitForTimeout(2_000);
        // Una entrada que nació ya con el candado cerrado (carrera de la entrada, no del candado que se
        // prueba) se repite una vez; la segunda se exige.
        if (intento === 1 && (await pinDe(pagina).count()) > 0) {
          await pagina.context().close();
          return conReloj(2);
        }
        await expect(pinDe(pagina)).toHaveCount(0);
        // Con el reloj de mentira, la configuración llega por la red pero react-query la entrega con
        // sus propios temporizadores: se espera a la respuesta y se deja correr un segundo, para que
        // el candado ya cuente con los minutos de la dueña ANTES de adelantar el reloj.
        await laConfiguracion;
        await pagina.clock.runFor(1_000);
        return pagina;
      }

      try {
        // 5 minutos: a los 4:30 todavía no; a los 5:30, sí.
        await fijarMinutos('5');
        const cinco = await conReloj();
        await cinco.clock.fastForward('04:30');
        await expect(pinDe(cinco)).toHaveCount(0);
        await cinco.clock.fastForward('01:00');
        await expect(pinDe(cinco)).toBeVisible();

        // 30 minutos: a los 11 (más que los 10 de siempre) todavía no; pasados los 30, sí.
        await fijarMinutos('30');
        const treinta = await conReloj();
        await treinta.clock.fastForward('11:00');
        await expect(pinDe(treinta)).toHaveCount(0);
        await treinta.clock.fastForward('20:00');
        await expect(pinDe(treinta)).toBeVisible();
      } finally {
        await escribir(ajustes, '/api/configuracion/fijar-candado-de-mando', { minutos: 10 });
      }
    } finally {
      for (const contexto of contextos) await contexto.close();
    }
  });

  test('descargar_pdf_corte_auto: el cierre del día baja el PDF del corte sólo con la casilla encendida', async ({
    aparato,
  }, info) => {
    test.setTimeout(8 * 60_000);
    const aparatos = new VariosAparatos(info, SLUG);
    try {
      const duena = await aparatos.abrir({
        puesto: 'ajustes-operacion-caja',
        aparato: aparato.id,
        rol: 'dueno',
        ruta: '/',
      });
      const page = duena.page;
      await resetearLaDemo(page);

      async function fijarDescarga(encendida: boolean): Promise<void> {
        await irASeccion(page, 'caja');
        const region = tarjeta(page, 'PDF del corte al cerrar');
        const interruptor = region.getByRole('switch').first();
        await expect(interruptor).toBeVisible();
        if ((await interruptor.getAttribute('aria-checked')) !== String(encendida)) {
          // Un toque que cae mientras la tarjeta termina de pintarse se pierde: se repite.
          for (let vez = 0; vez < 3; vez += 1) {
            await toque(page, interruptor);
            if (
              (await interruptor.getAttribute('aria-checked').catch(() => null)) ===
              String(encendida)
            )
              break;
            await page.waitForTimeout(800);
          }
          await expect(interruptor).toHaveAttribute('aria-checked', String(encendida));
          await expect(region.getByRole('button', { name: 'Guardar', exact: true })).toBeEnabled();
          await guardarTarjeta(page, region);
        }
        await expect(interruptor).toHaveAttribute('aria-checked', String(encendida));
      }

      /** Abre la caja y hace el cierre del día; devuelve el PDF si bajó alguno. */
      async function cerrarElDia(esperaDelPdfMs: number): Promise<string | null> {
        await abrirCajaPorLaRuta(page, 100_000);
        await page.goto('/caja', { waitUntil: 'domcontentloaded' });
        await toque(page, page.getByRole('button', { name: /^Cierre/ }).first());
        const cierre = page.getByRole('dialog').filter({ hasText: 'Cierre de caja diario' });
        await expect(cierre).toBeVisible();
        await cierre.getByPlaceholder('0.00').nth(0).fill('1000.00');
        await cierre.getByPlaceholder('0.00').nth(1).fill('0');
        const descarga = page
          .waitForEvent('download', { timeout: esperaDelPdfMs })
          .then((d) => d.suggestedFilename())
          .catch(() => null);
        await toque(page, cierre.getByRole('button', { name: 'Cerrar caja del día' }));
        await expect(cierre).toBeHidden({ timeout: 60_000 });
        return descarga;
      }

      try {
        await fijarDescarga(false);
        expect(await cerrarElDia(15_000), 'con la casilla apagada no baja ningún PDF').toBeNull();

        await fijarDescarga(true);
        expect(await cerrarElDia(90_000)).toMatch(/^Corte_.+\.pdf$/);
      } finally {
        await fijarDescarga(true);
      }
    } finally {
      await aparatos.cerrar();
    }
  });

  test('el cierre del día NUNCA depende del PDF: si el PDF no se puede generar, la caja se cierra y el aviso lo dice', async ({
    aparato,
  }, info) => {
    test.setTimeout(8 * 60_000);
    const aparatos = new VariosAparatos(info, SLUG);
    try {
      const duena = await aparatos.abrir({
        puesto: 'ajustes-operacion-pdf-roto',
        aparato: aparato.id,
        rol: 'dueno',
        ruta: '/',
      });
      const page = duena.page;
      await resetearLaDemo(page);
      await escribir(page, '/api/datos/escribir', {
        entidad: 'ConfiguracionNegocio',
        operacion: 'update',
        datos: { descargar_pdf_corte_auto: true },
      });
      // El motor no puede dibujar el PDF (como un Chromium al que le falta una API).
      await page.context().addInitScript(() => {
        HTMLCanvasElement.prototype.getContext = () => {
          throw new Error('canvas roto (prueba)');
        };
      });
      await abrirCajaPorLaRuta(page, 100_000);
      await page.goto('/caja', { waitUntil: 'domcontentloaded' });
      await toque(page, page.getByRole('button', { name: /^Cierre/ }).first());
      const cierre = page.getByRole('dialog').filter({ hasText: 'Cierre de caja diario' });
      await expect(cierre).toBeVisible();
      await cierre.getByPlaceholder('0.00').nth(0).fill('1000.00');
      await cierre.getByPlaceholder('0.00').nth(1).fill('0');
      const descarga = page
        .waitForEvent('download', { timeout: 8_000 })
        .then(() => true)
        .catch(() => false);
      // El aviso dura unos segundos: se vigila desde antes de tocar.
      const aviso = page
        .getByText(/La caja se cerró. No se pudo guardar el PDF/)
        .first()
        .waitFor({ state: 'visible', timeout: 60_000 })
        .then(() => true)
        .catch(() => false);
      await toque(page, cierre.getByRole('button', { name: 'Cerrar caja del día' }));
      // El diálogo se cierra aunque el PDF falle...
      await expect(cierre).toBeHidden({ timeout: 60_000 });
      // ...la caja quedó cerrada en el servidor...
      await expect
        .poll(async () => (await escribir(page, '/api/caja/estado', {})).datos?.['abierta'], {
          timeout: 20_000,
        })
        .toBe(false);
      // ...no bajó ningún PDF y el aviso lo dice, sin error mudo.
      expect(await descarga).toBe(false);
      expect(await aviso, 'el aviso «La caja se cerró. No se pudo guardar el PDF…»').toBe(true);
    } finally {
      await aparatos.cerrar();
    }
  });
});
