import { dialogoDeLaMesa, laMesa, yaAbierto } from '../ayudantes/mesas-heredadas.ts';
import { Equipo } from '../ayudantes/roles.ts';
import { exigirDemostracion } from '../ayudantes/sesion.ts';

import { navegadorDe, prepararContexto } from './arnes/ligero.ts';
import { expect, exigirServidor, test } from './arnes/prueba.ts';
import { toque } from './arnes/toque.ts';
import { SLUG, mesaConPedido, resetearLaDemo } from './parte7/comun.ts';
import {
  arrastrarYSoltar,
  centro,
  leerEstado,
  mantener,
  tocar,
  type Entrada,
  type Estado,
} from './toque-seguro/gestos.ts';

import type { Locator, Page, TestInfo } from '@playwright/test';
import type { Aparato } from './arnes/aparatos.ts';

/**
 * DP-23 · EL TOQUE SEGURO DEL MESERO. La falla (palabras del dueño, en el restaurante): en la
 * rejilla de platillos «al deslizar se agregan platillos» y «al mantener se agregan varios».
 *
 * Se mide lo único que importa: cuántas unidades hay en el pedido en armado después del gesto.
 *  · un toque deja EXACTAMENTE 1 nueva;
 *  · un arrastre que empieza sobre un platillo, y un «mantener», dejan 0 (y no abren un diálogo).
 *
 * Con el dedo de verdad (`Input.dispatchTouchEvent`) y con el ratón que una pantalla táctil de
 * Windows promueve desde el dedo (`Input.dispatchMouseEvent`), en los tamaños de los POS (casi
 * cuadrados) y en vertical, tras cambiar de categoría (con muchos y con pocos platillos).
 */

const MESA = 5;
const TAMANOS = [
  { ancho: 1024, alto: 768 },
  { ancho: 800, alto: 600 },
  { ancho: 1280, alto: 800 },
  { ancho: 800, alto: 1280 },
] as const;
const ENTRADAS: readonly Entrada[] = ['dedo', 'raton-del-dedo'];
const ARRASTRES = [40, -120, 200] as const;

interface Escena {
  readonly page: Page;
  readonly mesa: Locator;
  readonly rejilla: Locator;
  readonly fichas: Locator;
}

/** Fichas que sólo agregan (sin opciones, sin medida, no agotadas): el gesto no abre diálogos legítimos. */
async function fichasSencillas(escena: Escena): Promise<number[]> {
  const textos = await escena.fichas.allInnerTexts();
  return textos
    .map((t, i) => ({ t, i }))
    .filter(({ t }) => !/Opciones|Por medida|Por porción|Agotado/i.test(t))
    .map(({ i }) => i);
}

function chipsDeCategoria(escena: Escena): Locator {
  return escena.mesa.locator('div.overflow-x-auto button');
}

async function irALaCategoria(escena: Escena, nombre: string): Promise<void> {
  const chip = chipsDeCategoria(escena)
    .filter({ hasText: new RegExp(`^\\s*${nombre}\\s*$`) })
    .first();
  await toque(escena.page, chip);
  await escena.page.waitForTimeout(250);
}

/** La categoría con más fichas y la que menos tiene (con alguna sencilla). */
async function elegirCategorias(escena: Escena): Promise<{ muchas: string; pocas: string }> {
  const nombres = (await chipsDeCategoria(escena).allInnerTexts())
    .map((t) => t.trim())
    .filter((t) => t !== 'Todas');
  const cuentas: { nombre: string; n: number; sencillas: number }[] = [];
  for (const nombre of nombres) {
    await irALaCategoria(escena, nombre);
    cuentas.push({
      nombre,
      n: await escena.fichas.count(),
      sencillas: (await fichasSencillas(escena)).length,
    });
  }
  const ordenadas = cuentas.filter((c) => c.sencillas >= 1).sort((a, b) => b.n - a.n);
  const muchas = ordenadas[0];
  const pocas = ordenadas[ordenadas.length - 1];
  if (muchas === undefined || pocas === undefined) throw new Error('La carta no trae categorías.');
  process.stdout.write(
    `[toque-seguro] categorías: ${cuentas.map((c) => `${c.nombre}=${String(c.n)}`).join(', ')} → muchas «${muchas.nombre}», pocas «${pocas.nombre}»\n`,
  );
  return { muchas: muchas.nombre, pocas: pocas.nombre };
}

async function prepararEscena(
  info: TestInfo,
  equipo: Equipo,
  aparato: Aparato,
  tam: { readonly ancho: number; readonly alto: number },
): Promise<Escena> {
  const duena = await equipo.pagina(info, 'dueno');
  await prepararContexto(duena.context(), aparato);
  await resetearLaDemo(duena);
  const page = await equipo.pagina(info, 'mesero');
  await prepararContexto(page.context(), aparato);
  await page.setViewportSize({ width: tam.ancho, height: tam.alto });
  await mesaConPedido(page, duena, MESA, [{ nombre: 'Cerveza clara 355 ml' }]);
  await page.goto('/mesero', { waitUntil: 'domcontentloaded' });
  await toque(page, laMesa(page, MESA));
  const mesa = dialogoDeLaMesa(page, MESA);
  await yaAbierto(mesa);
  const rejilla = mesa.locator('div.grid.grid-cols-2').first();
  await expect(rejilla.locator('> button').first()).toBeVisible();
  return { page, mesa, rejilla, fichas: rejilla.locator('> button') };
}

async function cerrarDialogosDeMas(page: Page): Promise<void> {
  for (let i = 0; i < 3; i += 1) {
    if ((await leerEstado(page)).dialogosDeMas === 0) return;
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
  }
}

/** Corre `gesto` y exige que el pedido cambie en `esperado` unidades y que no se abra nada más. */
async function medir(
  escena: Escena,
  nombre: string,
  esperado: number,
  gesto: () => Promise<void>,
  hastaMax: number = esperado,
): Promise<void> {
  const antes: Estado = await leerEstado(escena.page);
  await gesto();
  await escena.page.waitForTimeout(500);
  const despues = await leerEstado(escena.page);
  const nuevas = despues.unidades - antes.unidades;
  process.stdout.write(
    `[toque-seguro] ${nombre}: +${String(nuevas)} (esperado ${String(esperado)}), diálogos de más ${String(despues.dialogosDeMas)}\n`,
  );
  await cerrarDialogosDeMas(escena.page);
  expect
    .soft(
      nuevas,
      `${nombre}: unidades nuevas en el pedido (se esperaban de ${String(esperado)} a ${String(hastaMax)}).`,
    )
    .toBeGreaterThanOrEqual(esperado);
  expect
    .soft(nuevas, `${nombre}: de más (a lo más ${String(hastaMax)}).`)
    .toBeLessThanOrEqual(hastaMax);
  expect
    .soft(despues.dialogosDeMas, `${nombre}: se abrió un diálogo que nadie pidió.`)
    .toBe(antes.dialogosDeMas);
}

/** Una ficha sencilla, a la vista dentro de la rejilla, para empezar el gesto. */
async function fichaAlAlcance(escena: Escena, posicion: number): Promise<Locator> {
  const sencillas = await fichasSencillas(escena);
  const indice = sencillas[Math.min(posicion, sencillas.length - 1)];
  if (indice === undefined) throw new Error('No hay fichas sencillas en la categoría.');
  return escena.fichas.nth(indice);
}

test.describe('DP-23 · el toque seguro del mesero', () => {
  test.use({ actionTimeout: 60_000, navigationTimeout: 120_000 });

  test.beforeAll(async ({ playwright }, info) => {
    await exigirServidor(info.project.use.baseURL);
    await exigirDemostracion(playwright, info, SLUG);
  });

  for (const tam of TAMANOS) {
    for (const entrada of ENTRADAS) {
      test(`${String(tam.ancho)}×${String(tam.alto)} · ${entrada}: tocar agrega 1; arrastrar y mantener, 0`, async ({
        browser,
        aparato,
      }, info) => {
        test.setTimeout(10 * 60_000);
        const equipo = new Equipo(navegadorDe(browser, aparato), SLUG);
        try {
          const escena = await prepararEscena(info, equipo, aparato, tam);
          const { page } = escena;
          const { muchas, pocas } = await elegirCategorias(escena);
          // Se llega a cada categoría DESPUÉS de cambiar de categoría: así lo vio el dueño.
          for (const [etiqueta, categoria] of [
            ['con muchos platillos', muchas],
            ['con pocos platillos', pocas],
          ] as const) {
            await irALaCategoria(escena, categoria);
            const donde = `${categoria} (${etiqueta})`;

            await medir(escena, `${donde} · tocar`, 1, async () => {
              await tocar(page, entrada, await centro(await fichaAlAlcance(escena, 0)));
            });
            for (const dy of ARRASTRES) {
              await medir(escena, `${donde} · arrastrar ${String(dy)} px`, 0, async () => {
                const ficha = await fichaAlAlcance(escena, 1);
                await arrastrarYSoltar(page, entrada, await centro(ficha), dy);
              });
            }
            await medir(escena, `${donde} · mantener 800 ms`, 0, async () => {
              await mantener(page, entrada, await centro(await fichaAlAlcance(escena, 0)), 800);
            });
          }
        } finally {
          await equipo.cerrar();
        }
      });
    }
  }

  test('al cambiar de categoría la rejilla vuelve arriba', async ({ browser, aparato }, info) => {
    test.setTimeout(10 * 60_000);
    const equipo = new Equipo(navegadorDe(browser, aparato), SLUG);
    try {
      const escena = await prepararEscena(info, equipo, aparato, { ancho: 800, alto: 360 });
      const { muchas } = await elegirCategorias(escena);
      // «Todas» es la que de verdad se desborda y se puede desplazar.
      await irALaCategoria(escena, 'Todas');
      await escena.rejilla.evaluate((el) => {
        el.scrollTop = el.scrollHeight;
      });
      const abajo = await escena.rejilla.evaluate((el) => el.scrollTop);
      expect(
        abajo,
        'La rejilla de «Todas» no se desborda: la prueba no mide nada.',
      ).toBeGreaterThan(0);
      await irALaCategoria(escena, muchas);
      expect(
        await escena.rejilla.evaluate((el) => el.scrollHeight - el.clientHeight),
        `«${muchas}» cabe entera en la rejilla: la prueba no mide nada.`,
      ).toBeGreaterThan(0);
      expect(
        await escena.rejilla.evaluate((el) => el.scrollTop),
        `La rejilla estaba en ${String(abajo)} px y al cambiar de categoría no volvió arriba.`,
      ).toBe(0);
    } finally {
      await equipo.cerrar();
    }
  });

  test('un panel con rebotes (6 toques en medio segundo) no agrega más de 2', async ({
    browser,
    aparato,
  }, info) => {
    test.setTimeout(10 * 60_000);
    const equipo = new Equipo(navegadorDe(browser, aparato), SLUG);
    try {
      const escena = await prepararEscena(info, equipo, aparato, { ancho: 1024, alto: 768 });
      const { muchas } = await elegirCategorias(escena);
      await irALaCategoria(escena, muchas);
      const p = await centro(await fichaAlAlcance(escena, 0));
      await medir(
        escena,
        'rebotes de un panel dudoso',
        1,
        async () => {
          for (let i = 0; i < 6; i += 1) {
            await tocar(escena.page, 'dedo', p);
          }
        },
        2,
      );
    } finally {
      await equipo.cerrar();
    }
  });

  test('Enter sostenido sobre una ficha no se repite; Espacio y Enter sueltos sí agregan', async ({
    browser,
    aparato,
  }, info) => {
    test.setTimeout(10 * 60_000);
    const equipo = new Equipo(navegadorDe(browser, aparato), SLUG);
    try {
      const escena = await prepararEscena(info, equipo, aparato, { ancho: 1024, alto: 768 });
      const { muchas } = await elegirCategorias(escena);
      await irALaCategoria(escena, muchas);
      const ficha = await fichaAlAlcance(escena, 0);
      await ficha.focus();
      await medir(escena, 'Enter sostenido (autorrepetición)', 1, async () => {
        for (let i = 0; i < 8; i += 1) {
          await escena.page.keyboard.down('Enter');
          await escena.page.waitForTimeout(60);
        }
        await escena.page.keyboard.up('Enter');
      });
      await escena.page.waitForTimeout(500);
      await medir(escena, 'Espacio suelto', 1, async () => {
        await escena.page.keyboard.press('Space');
      });
      await escena.page.waitForTimeout(500);
      await medir(escena, 'Enter suelto', 1, async () => {
        await escena.page.keyboard.press('Enter');
      });
    } finally {
      await equipo.cerrar();
    }
  });
});
