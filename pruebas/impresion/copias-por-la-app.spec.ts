import { expect, test, type Page } from '@playwright/test';

import { emular } from '../../apps/web/src/impresion/termico/emulador.ts';
import { perfilPorOmision } from '../../apps/web/src/impresion/termico/perfil.ts';
import { deBase64 } from '../../apps/web/src/impresion/termico/trabajo.ts';
import { instalarAppFalsa, type EstadoDeLaAppFalsa } from '../e2e/ayudantes/app-falsa.ts';
import { leerArnes } from './empaquetar.ts';

/**
 * DP-22 · `copias_de_impresion`: CUÁNTAS COPIAS SALEN DE LA PRECUENTA, por el camino de producción.
 *
 * El arnés hace lo mismo que la app: manda el documento que está en pantalla a la app (`imprimirDirecto`),
 * que lee las copias del negocio AL IMPRIMIR (`copiasAlImprimir`). Aquí el «servidor» es una ruta
 * interceptada de `/api/datos/consultar` cuyo valor la prueba cambia entre impresiones. La «impresora» de la app falsa guarda los bytes del trabajo; aquí se leen de
 * vuelta con la impresora emulada y se cuentan los cortes del papel: una copia, un corte.
 *
 * Que la casilla se guarde en el servidor y se vuelva a leer lo prueban
 * `packages/app/src/venta/impresion-del-ticket.integracion.test.ts` y `pruebas/e2e/impresion-por-la-app.spec.ts`.
 */

const guion = leerArnes();

/** La configuración que el «servidor» de la prueba contesta; cada prueba la cambia cuando quiere. */
const servidor: { configuracion: Record<string, unknown>; lecturas: number } = {
  configuracion: {},
  lecturas: 0,
};

interface Arnes {
  imprimirPorLaApp(caso: { papelMm: 58 | 80; conLogo: boolean }): Promise<{ seFueALaApp: boolean }>;
}

async function abrir(page: Page): Promise<void> {
  if (process.env['MORPHIQPOS_DEPURAR'] !== undefined) {
    page.on('console', (m) =>
      process.stdout.write(`[consola] ${m.type()} ${m.text().slice(0, 400)}
`),
    );
    page.on('pageerror', (e) =>
      process.stdout.write(`[pageerror] ${String(e).slice(0, 400)}
`),
    );
  }
  const perfil = perfilPorOmision(80, { conexion: 'spooler', nombre: 'POS-80' });
  await page.addInitScript(instalarAppFalsa);
  await page.addInitScript((guardado) => {
    localStorage.setItem(
      'app-falsa:ajustes',
      JSON.stringify({ version: 1, perfil: guardado, modoLigero: null }),
    );
  }, perfil);
  await page.setViewportSize({ width: 900, height: 700 });
  // La app guarda sus ajustes en `localStorage`, que `about:blank` no deja leer: una página de verdad,
  // servida por la propia prueba, y sus guiones de inicio corren al crearse el documento.
  servidor.configuracion = {};
  servidor.lecturas = 0;
  await page.route('**/api/datos/consultar', (ruta) => {
    servidor.lecturas += 1;
    return ruta.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, datos: { filas: [servidor.configuracion] } }),
    });
  });
  await page.route('http://arnes.prueba/', (ruta) =>
    ruta.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><html lang="es"><body style="margin:0"></body></html>',
    }),
  );
  await page.goto('http://arnes.prueba/');
  await page.addScriptTag({ content: guion });
}

/**
 * Imprime la precuenta con lo que el «servidor» diga AHORA y devuelve cuántos cortes trae el papel
 * (`orden` = cuántos trabajos debe haber ya recibido la app falsa, contando éste).
 */
async function cortesDe(
  page: Page,
  configuracion: Record<string, unknown>,
  orden = 1,
): Promise<number> {
  servidor.configuracion = configuracion;
  const { seFueALaApp } = await page.evaluate(
    (caso) => (window as unknown as { arnes: Arnes }).arnes.imprimirPorLaApp(caso),
    { papelMm: 80 as const, conLogo: false },
  );
  expect(seFueALaApp).toBe(true);
  await page.waitForFunction(
    (esperados) => {
      const v = window as unknown as { __alNavegador: number; __appFalsa: EstadoDeLaAppFalsa };
      return v.__alNavegador > 0 || v.__appFalsa.trabajos.length >= esperados;
    },
    orden,
    { timeout: 30_000 },
  );
  expect(
    await page.evaluate(() => (window as unknown as { __alNavegador: number }).__alNavegador),
    'el documento se fue al navegador: la app no tomó el trabajo',
  ).toBe(0);
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            (window as unknown as { __appFalsa: EstadoDeLaAppFalsa }).__appFalsa.trabajos.length,
        ),
      { timeout: 30_000 },
    )
    .toBe(orden);
  const trabajos = await page.evaluate(
    () => (window as unknown as { __appFalsa: EstadoDeLaAppFalsa }).__appFalsa.trabajos,
  );
  const trabajo = trabajos[orden - 1];
  expect(trabajo?.documento.tipo).toBe('crudo');
  const papel = emular(deBase64(trabajo?.documento.base64 ?? ''), 576);
  return papel.cortes.length;
}

test.describe('copias_de_impresion', () => {
  test.beforeEach(async ({ page }) => {
    await abrir(page);
  });

  for (const copias of [1, 2, 3]) {
    test(`con ${String(copias)} copia(s) en la configuración, el papel trae ${String(copias)} corte(s)`, async ({
      page,
    }) => {
      expect(
        await cortesDe(page, { copias_de_impresion: { ticket: 1, precuenta: copias, corte: 1 } }),
      ).toBe(copias);
    });
  }

  test('sin elegir nada, o con un valor que no es de 1 a 3, sale una copia', async ({ page }) => {
    expect(await cortesDe(page, {})).toBe(1);
  });

  test('el dueño cambia las copias en el servidor y la SIGUIENTE impresión las respeta, sin recargar', async ({
    page,
  }) => {
    const con = (precuenta: number) => ({
      copias_de_impresion: { ticket: 1, precuenta, corte: 1 },
    });
    expect(await cortesDe(page, con(1), 1)).toBe(1);
    expect(await cortesDe(page, con(3), 2)).toBe(3);
    expect(await cortesDe(page, con(2), 3)).toBe(2);
    expect(servidor.lecturas).toBeGreaterThanOrEqual(3);
  });

  test('un valor fuera de rango (7) vale una copia', async ({ page }) => {
    expect(
      await cortesDe(page, { copias_de_impresion: { ticket: 1, precuenta: 7, corte: 1 } }),
    ).toBe(1);
  });

  test('las copias de la precuenta son las suyas, no las del ticket ni las del corte', async ({
    page,
  }) => {
    expect(
      await cortesDe(page, { copias_de_impresion: { ticket: 3, precuenta: 2, corte: 3 } }),
    ).toBe(2);
  });
});
