import { pagina, servirCalibracion, urlDe } from './arnes/calibracion/pagina.ts';
import { deslizar } from './arnes/deslizar.ts';
import { arrastrar, pellizcar, toque, toqueDoble, type ResultadoDeGesto } from './arnes/toque.ts';
import { expect, test } from './arnes/prueba.ts';

/**
 * LOS GESTOS SON DE VERDAD (DP-22): cada uno entra por el CDP como una pantalla táctil y la página
 * lo VE como eventos de tacto (no como clics). Se prueba contra una página de calibración con
 * listas anidadas (una dentro de otra, y una horizontal), una pieza que se arrastra y un blanco que
 * cuenta los puntos de contacto.
 */

const LISTAS = Array.from({ length: 30 }, (_, i) => `<li>Renglón ${String(i + 1)}</li>`).join('');
const CAJA = pagina({
  estilo: `
    #externa { height: 320px; overflow-y: auto; border: 1px solid #333; }
    #interna { height: 140px; overflow-y: auto; border: 1px solid #777; margin: 8px; }
    #ancha { width: 280px; overflow-x: auto; white-space: nowrap; border: 1px solid #333; }
    #ancha div { width: 900px; height: 60px; background: linear-gradient(90deg,#9cf,#fc9); }
    #pieza { width: 80px; height: 80px; background: #36c; touch-action: none; position: relative; }
    #pellizco { height: 120px; border: 1px solid #333; touch-action: none; }
    ul { margin: 0; padding: 0 16px; } li { height: 28px; }`,
  cuerpo: `
    <div id="externa"><ul>${LISTAS}</ul><div id="interna"><ul>${LISTAS}</ul></div><ul>${LISTAS}</ul></div>
    <div id="ancha" tabindex="0"><div>Ancho</div></div>
    <div id="pieza">Mover</div>
    <div id="pellizco">Pellizca aquí</div>
    <p id="eventos">sin eventos</p>`,
  guion: `
    var log = { dedos: 0, toques: 0, clics: 0, dobles: 0, mouse: 0 };
    function mostrar() { document.getElementById('eventos').textContent = JSON.stringify(log); }
    var pieza = document.getElementById('pieza'), x0 = 0, y0 = 0, dx = 0, dy = 0;
    pieza.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; });
    pieza.addEventListener('touchmove', function (e) {
      dx = e.touches[0].clientX - x0; dy = e.touches[0].clientY - y0;
      pieza.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
    });
    document.getElementById('pellizco').addEventListener('touchstart', function (e) { log.dedos = Math.max(log.dedos, e.touches.length); mostrar(); });
    document.addEventListener('touchstart', function () { log.toques += 1; mostrar(); }, true);
    document.addEventListener('click', function () { log.clics += 1; mostrar(); }, true);
    document.addEventListener('dblclick', function () { log.dobles += 1; mostrar(); }, true);
    document.addEventListener('mousemove', function () { log.mouse += 1; }, true);`,
});

const sinProblemas = (r: ResultadoDeGesto): void => {
  expect(r.problemas, `${r.gesto} en ${r.donde}`).toEqual([]);
};

test.describe('los gestos del arnés', () => {
  test.beforeEach(async ({ page }) => {
    await servirCalibracion(page, new Map([['/caso/gestos/limpia', CAJA]]));
    await page.goto(urlDe('gestos', 'limpia'));
  });

  test('un toque es un toque de verdad: touchstart y clic, sin movimiento de ratón', async ({
    page,
  }) => {
    sinProblemas(await toque(page, page.locator('#pellizco')));
    const visto = await page.evaluate(() => document.getElementById('eventos')?.textContent ?? '');
    const log = JSON.parse(visto) as { toques: number; clics: number };
    expect(log.toques, 'touchstart').toBeGreaterThanOrEqual(1);
    expect(log.clics, 'el toque se vuelve clic').toBeGreaterThanOrEqual(1);
  });

  test('el toque doble son dos toques seguidos', async ({ page }) => {
    sinProblemas(await toqueDoble(page, page.locator('#pellizco')));
    const log = JSON.parse(
      await page.evaluate(() => document.getElementById('eventos')?.textContent ?? '{}'),
    ) as { toques: number };
    expect(log.toques).toBeGreaterThanOrEqual(2);
  });

  test('deslizar mueve el contenedor de adentro y no el de afuera, en los dos sentidos', async ({
    page,
  }) => {
    const interna = page.locator('#interna');
    const externa = page.locator('#externa');
    // Traer la lista interna a la vista mueve la de afuera: eso es de la preparación, no del deslizar.
    await interna.scrollIntoViewIfNeeded();
    const antes = await interna.evaluate((e) => e.scrollTop);
    const afueraAntes = await externa.evaluate((e) => e.scrollTop);
    const baja = await deslizar(page, interna, {
      sentido: 'abajo',
      distancia: 100,
      contenedor: interna,
    });
    sinProblemas(baja);
    const alBajar = await interna.evaluate((e) => e.scrollTop);
    expect(alBajar, 'la lista de adentro se desplazó hacia abajo').toBeGreaterThan(antes);
    expect(await externa.evaluate((e) => e.scrollTop), 'la de afuera no se movió').toBe(
      afueraAntes,
    );
    sinProblemas(
      await deslizar(page, interna, { sentido: 'arriba', distancia: 60, contenedor: interna }),
    );
    expect(await interna.evaluate((e) => e.scrollTop), 'subió').toBeLessThan(alBajar);
  });

  test('deslizar de lado mueve el contenedor horizontal, y de vuelta', async ({ page }) => {
    const ancha = page.locator('#ancha');
    sinProblemas(
      await deslizar(page, ancha, { sentido: 'derecha', distancia: 120, contenedor: ancha }),
    );
    const fuera = await ancha.evaluate((e) => e.scrollLeft);
    expect(fuera).toBeGreaterThan(0);
    sinProblemas(
      await deslizar(page, ancha, { sentido: 'izquierda', distancia: 60, contenedor: ancha }),
    );
    expect(await ancha.evaluate((e) => e.scrollLeft)).toBeLessThan(fuera);
  });

  test('arrastrar mueve la pieza lo que mueve el dedo', async ({ page }) => {
    const pieza = page.locator('#pieza');
    const antes = await pieza.boundingBox();
    sinProblemas(
      await arrastrar(page, pieza, { x: (antes?.x ?? 0) + 40 + 100, y: (antes?.y ?? 0) + 40 + 30 }),
    );
    const despues = await pieza.boundingBox();
    expect(Math.round((despues?.x ?? 0) - (antes?.x ?? 0))).toBeGreaterThanOrEqual(95);
    expect(Math.round((despues?.y ?? 0) - (antes?.y ?? 0))).toBeGreaterThanOrEqual(25);
  });

  test('el pellizco trae dos puntos de contacto', async ({ page }) => {
    sinProblemas(await pellizcar(page, page.locator('#pellizco')));
    const log = JSON.parse(
      await page.evaluate(() => document.getElementById('eventos')?.textContent ?? '{}'),
    ) as { dedos: number };
    expect(log.dedos, 'dedos en la pantalla a la vez').toBe(2);
  });
});
