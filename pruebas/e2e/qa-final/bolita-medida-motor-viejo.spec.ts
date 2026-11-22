import { dialogoDeLaMesa, laMesa, yaAbierto } from '../ayudantes/mesas-heredadas.ts';
import { Equipo } from '../ayudantes/roles.ts';
import { exigirDemostracion } from '../ayudantes/sesion.ts';

import { navegadorDe, prepararContexto } from './arnes/ligero.ts';
import { expect, exigirServidor, test } from './arnes/prueba.ts';
import { toque } from './arnes/toque.ts';
import { SLUG, mesaConPedido, resetearLaDemo } from './parte7/comun.ts';

import type { Page } from '@playwright/test';

/**
 * DP-25 · PARTE 5 · LA MEDIDA DE LA BOLITA EN EL MOTOR VIEJO (Chromium 99 y 103 del iMin).
 *
 * No es una prueba de «pasa o no pasa» sino una medida que se imprime: 10 toques seguidos sobre 10
 * platillos distintos, CON la bolita y SIN ella (se le quitan los destinos a la página: no hay a
 * dónde volar, ni rebote). De cada tanda se anota el tiempo que tarda el agregado (síncrono, con
 * `performance.now()`), las tareas largas (> 50 ms) que se ven en el segundo y medio siguiente y el
 * mayor hueco entre dos cuadros. Sólo se exige que los 10 platillos lleguen al pedido y que la
 * bolita no deje basura; los números van a la salida para el reporte.
 *
 * Se corre a mano con `playwright.qa-final.config.ts` y el proyecto del iMin (`--project=imin-…-c99`).
 */

const MESA = 5;
const TOQUES = 10;

interface Medida {
  readonly agregadoMs: number;
  readonly tareasLargas: number;
  readonly huecoMaximoMs: number;
  readonly bolitasCreadas: number;
  readonly piezas: number;
}

/** Hace los toques y mide. `conBolita: false` quita los destinos antes: no hay vuelo ni rebote. */
function medirLosToques(page: Page, conBolita: boolean): Promise<Medida> {
  return page.evaluate(
    async ({ toques, con }) => {
      if (!con) {
        document.querySelectorAll('[data-destino-bolita]').forEach((el) => {
          el.removeAttribute('data-destino-bolita');
        });
      }
      let tareasLargas = 0;
      const observador = new PerformanceObserver((lista) => {
        tareasLargas += lista.getEntries().length;
      });
      try {
        observador.observe({ entryTypes: ['longtask'] });
      } catch {
        // El motor no trae tareas largas: se anota 0 y se dice en la salida.
      }
      let bolitasCreadas = 0;
      new MutationObserver((cambios) => {
        for (const c of cambios) {
          for (const n of c.addedNodes) {
            if (n instanceof HTMLElement && n.hasAttribute('data-bolita')) bolitasCreadas += 1;
          }
        }
      }).observe(document.body, { childList: true });

      const fichas = [
        ...document.querySelectorAll<HTMLButtonElement>('[data-rejilla-de-platillos] > button'),
      ]
        .filter((b) => !/Opciones|Por medida|Por porción|Agotado/i.test(b.innerText))
        .slice(0, toques);
      let huecoMaximoMs = 0;
      let ultimo = performance.now();
      let corriendo = true;
      const cuadro = (ahora: number): void => {
        huecoMaximoMs = Math.max(huecoMaximoMs, ahora - ultimo);
        ultimo = ahora;
        if (corriendo) requestAnimationFrame(cuadro);
      };
      requestAnimationFrame(cuadro);

      const inicio = performance.now();
      for (const ficha of fichas) ficha.click();
      const agregadoMs = performance.now() - inicio;
      await new Promise((r) => setTimeout(r, 1500));
      corriendo = false;
      observador.disconnect();
      const piezas = [...document.querySelectorAll('button[aria-label^="Agregar uno de "]')]
        .filter((el) => (el as HTMLElement).offsetParent !== null)
        .reduce(
          (suma, mas) => suma + (parseInt(mas.previousElementSibling?.textContent ?? '0', 10) || 0),
          0,
        );
      return { agregadoMs, tareasLargas, huecoMaximoMs, bolitasCreadas, piezas };
    },
    { toques: TOQUES, con: conBolita },
  );
}

test.describe('DP-25 · P5 · la bolita en el motor viejo (medida)', () => {
  test.use({ actionTimeout: 60_000, navigationTimeout: 120_000 });

  test.beforeAll(async ({ playwright }, info) => {
    await exigirServidor(info.project.use.baseURL);
    await exigirDemostracion(playwright, info, SLUG);
  });

  for (const orden of ['sin-primero', 'con-primero'] as const) {
    test(`10 toques seguidos con y sin bolita (${orden})`, async ({
      browser,
      aparato,
      motor,
    }, info) => {
      test.setTimeout(10 * 60_000);
      const equipo = new Equipo(navegadorDe(browser, aparato), SLUG);
      try {
        const duena = await equipo.pagina(info, 'dueno');
        await prepararContexto(duena.context(), aparato);
        await resetearLaDemo(duena);
        const page = await equipo.pagina(info, 'mesero');
        await prepararContexto(page.context(), aparato);
        await mesaConPedido(page, duena, MESA, [{ nombre: 'Cerveza clara 355 ml' }]);
        await page.goto('/mesero', { waitUntil: 'domcontentloaded' });
        await toque(page, laMesa(page, MESA));
        await yaAbierto(dialogoDeLaMesa(page, MESA));
        await expect(page.locator('[data-rejilla-de-platillos] > button').first()).toBeVisible();
        const waapi = await page.evaluate(() => typeof Element.prototype.animate === 'function');

        const antes = await page.evaluate(() =>
          [...document.querySelectorAll('button[aria-label^="Agregar uno de "]')]
            .filter((el) => (el as HTMLElement).offsetParent !== null)
            .reduce(
              (s, m) => s + (parseInt(m.previousElementSibling?.textContent ?? '0', 10) || 0),
              0,
            ),
        );
        // El primer tramo de cada orden calienta el motor; se miden los dos, en los dos órdenes.
        const primero = orden === 'con-primero';
        const a = await medirLosToques(page, primero);
        const b = await medirLosToques(page, !primero);
        const con = primero ? a : b;
        const sin = primero ? b : a;
        process.stdout.write(
          `[bolita-motor-viejo] ${motor.version ?? motor.id} · WAAPI ${String(waapi)} · ${orden}\n` +
            `  CON bolita: agregado ${con.agregadoMs.toFixed(1)} ms · tareas largas ${String(con.tareasLargas)} · mayor hueco entre cuadros ${con.huecoMaximoMs.toFixed(1)} ms · bolitas ${String(con.bolitasCreadas)}\n` +
            `  SIN bolita: agregado ${sin.agregadoMs.toFixed(1)} ms · tareas largas ${String(sin.tareasLargas)} · mayor hueco entre cuadros ${sin.huecoMaximoMs.toFixed(1)} ms · bolitas ${String(sin.bolitasCreadas)}\n`,
        );
        expect(con.bolitasCreadas, 'con destino debían salir bolitas.').toBeGreaterThan(0);
        expect(sin.bolitasCreadas, 'sin destino no debía salir ninguna.').toBe(0);
        expect(await page.locator('[data-bolita]').count(), 'quedó una bolita en la página.').toBe(
          0,
        );
        expect(
          await page.evaluate(() =>
            [...document.querySelectorAll('button[aria-label^="Agregar uno de "]')]
              .filter((el) => (el as HTMLElement).offsetParent !== null)
              .reduce(
                (s, m) => s + (parseInt(m.previousElementSibling?.textContent ?? '0', 10) || 0),
                0,
              ),
          ),
          'los platillos no llegaron al pedido.',
        ).toBeGreaterThan(antes);
      } finally {
        await equipo.cerrar();
      }
    });
  }
});
