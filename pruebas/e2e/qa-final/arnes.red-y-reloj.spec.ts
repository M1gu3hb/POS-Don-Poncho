import { pagina } from './arnes/calibracion/pagina.ts';
import { servirPaginas, type ServidorLocal } from './arnes/calibracion/servidor-local.ts';
import { conLatencia, conRedCortada, recargarAMediaOperacion } from './arnes/red.ts';
import {
  alInstanteDelServidor,
  cambiarDeDia,
  instalarRelojFalso,
  pasarInactividad,
} from './arnes/reloj.ts';
import { expect, test } from './arnes/prueba.ts';

/**
 * LA RED Y EL RELOJ DEL ARNÉS, probados contra una página de calibración: un corte de verdad (la
 * petición falla mientras dura y funciona al volver), 800 ms de latencia que se MIDEN, una recarga a
 * media operación y un reloj falso que dispara el candado de inactividad y cambia el día.
 */

const CASO = pagina({
  cuerpo: `<button id="pedir" type="button">Pedir</button>
<p id="estado" role="status">sin pedir</p>
<p id="hora">-</p>`,
  guion: `
    document.getElementById('pedir').addEventListener('click', function () {
      var t0 = performance.now();
      fetch('/api/calibracion/ok', { method: 'POST' })
        .then(function () { document.getElementById('estado').textContent = 'ok ' + Math.round(performance.now() - t0); })
        .catch(function () { document.getElementById('estado').textContent = 'falló'; });
    });
    window.__candado = false;
    setTimeout(function () { window.__candado = true; }, 10 * 60 * 1000);
    document.getElementById('hora').textContent = new Date().toISOString().slice(0, 10);`,
});

test.describe('la red y el reloj del arnés', () => {
  let servidor: ServidorLocal;
  test.beforeAll(async () => {
    servidor = await servirPaginas(new Map([['/caso/red', CASO]]));
  });
  test.afterAll(async () => {
    await servidor.cerrar();
  });
  const urlDelCaso = (): string => `${servidor.url}/caso/red`;

  test('un corte de 5 s hace fallar la petición y al volver la red funciona', async ({
    page,
    context,
  }) => {
    await page.goto(urlDelCaso());
    const inicio = Date.now();
    await conRedCortada(context, 5, async () => {
      await page.locator('#pedir').click();
      await expect(page.locator('#estado')).toHaveText('falló');
    });
    expect(Date.now() - inicio, 'el corte dura lo que se pidió').toBeGreaterThanOrEqual(5_000);
    await page.locator('#pedir').click();
    await expect(page.locator('#estado')).toHaveText(/^ok /);
  });

  test('800 ms de latencia se notan en la petición', async ({ page }) => {
    await page.goto(urlDelCaso());
    const quitar = await conLatencia(page, 800);
    await page.locator('#pedir').click();
    await expect(page.locator('#estado')).toHaveText(/^ok \d+/);
    const ms = Number(((await page.locator('#estado').textContent()) ?? '').replace('ok ', ''));
    expect(ms, 'ida y vuelta con 800 ms de latencia').toBeGreaterThanOrEqual(700);
    await quitar();
  });

  test('recargar a media operación devuelve lo que no había terminado', async ({ page }) => {
    await page.goto(urlDelCaso());
    const quitar = await conLatencia(page, 800);
    const enVuelo = await recargarAMediaOperacion(
      page,
      () => page.locator('#pedir').click(),
      (url, metodo) => metodo === 'POST' && url.includes('/api/calibracion/ok'),
    );
    await quitar();
    expect(enVuelo.length, 'la petición seguía en vuelo al recargar').toBe(1);
    await expect(page.locator('#estado')).toHaveText('sin pedir');
  });

  test('el reloj falso dispara el candado a los 10 minutos y cambia el día', async ({ page }) => {
    await instalarRelojFalso(page, new Date('2026-11-16T22:00:00-06:00'));
    await page.goto(urlDelCaso());
    expect(await page.evaluate(() => (window as unknown as { __candado: boolean }).__candado)).toBe(
      false,
    );
    await pasarInactividad(page, 10);
    expect(await page.evaluate(() => (window as unknown as { __candado: boolean }).__candado)).toBe(
      true,
    );
    await cambiarDeDia(page, '2026-11-17');
    expect(await page.evaluate(() => new Date().toISOString().slice(0, 10))).toBe('2026-11-17');
  });

  test('la página cree que es la hora del servidor simulado', async ({ page }) => {
    await alInstanteDelServidor(page, '2026-11-18T08:00:00-06:00');
    await page.goto(urlDelCaso());
    expect(await page.evaluate(() => new Date().toISOString().slice(0, 10))).toBe('2026-11-18');
  });
});
