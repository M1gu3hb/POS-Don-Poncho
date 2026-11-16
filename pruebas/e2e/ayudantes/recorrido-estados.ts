import { expect, type Locator, type Page } from '@playwright/test';

import type { EnLaParada } from './recorrido-tipos.ts';

/**
 * DP-21 · Bloque 15 · LOS ESTADOS ABIERTOS Y MARCADOS, EN EL RECORRIDO COMPATIBLE.
 *
 * Las 14 paradas de DP-20 miran pantallas en reposo. Miguel veía colores raros justo donde no: al
 * seleccionar algo y en los desplegables. Aquí se andan, en `/sistema?estados` (sin sesión: cada
 * pieza de Radix, la del sistema y la heredada, en el estado que se mira), estas paradas:
 *
 *   · reposo: pestaña activa, acordeón y desplegable abiertos, interruptor encendido, casilla y
 *     opción marcadas;
 *   · selección: el texto seleccionado (`::selection`);
 *   · foco: el anillo de foco del teclado;
 *   · lista, menú, popover y panel lateral abiertos, con un renglón resaltado donde lo hay.
 *
 * Y, con sesión, el globo de la mesa (mantener presionada). El panel de la mesa, el producto en el
 * carrito y la categoría seleccionada ya están en `mesero-orden`, `caja-cuenta` y `para-llevar`.
 */

const PIEZAS = ['sistema', 'heredado'] as const;
type Pieza = (typeof PIEZAS)[number];

const muestra = (page: Page, pieza: Pieza) => page.locator(`[data-muestra="${pieza}"]`);

/** Abre algo y lo deja abierto, con el ratón sobre el renglón que se resalta (si lo hay). */
async function abrirYResaltar(
  page: Page,
  alLlegar: EnLaParada,
  pieza: Pieza,
  que: {
    disparador: string;
    /** Lo que aparece al abrir. */
    abierto: (p: Page) => Locator;
    /** El renglón sobre el que se deja el puntero, si lo hay. */
    renglon?: (p: Page) => Locator;
    parada: string;
  },
): Promise<void> {
  const disparador = muestra(page, pieza).getByRole('button', { name: que.disparador });
  const combo = muestra(page, pieza).getByRole('combobox', { name: que.disparador });
  await ((await disparador.count()) > 0 ? disparador : combo).click();
  const abierto = que.abierto(page);
  await expect(abierto).toBeVisible();
  if (que.renglon !== undefined) {
    await que.renglon(page).hover();
    await page.waitForTimeout(150); // Radix resalta al mover el puntero
  }
  await alLlegar({ nombre: `${que.parada}-${pieza}`, tapar: [] });
  await page.keyboard.press('Escape');
  await expect(abierto).toBeHidden();
}

/** Las paradas de las piezas, en `/sistema?estados`. */
export async function recorrerLasPiezas(page: Page, alLlegar: EnLaParada): Promise<void> {
  await page.goto('/sistema?estados');
  await expect(muestra(page, 'sistema')).toBeVisible();
  await expect(muestra(page, 'heredado')).toBeVisible();
  // Sin `networkidle`: esta página no tiene nada que esperar de la red, y el aviso del aparato la mantiene viva.
  await page.waitForTimeout(500);
  await alLlegar({ nombre: 'estados-reposo', tapar: [] });

  // El texto seleccionado: el rango del párrafo de cada muestra, a la vez.
  await page.evaluate(() => {
    const parrafos = Array.from(document.querySelectorAll('[data-muestra-de="seleccion"]'));
    const rango = document.createRange();
    const [primero, ...resto] = parrafos;
    if (primero === undefined) return;
    rango.setStart(primero, 0);
    rango.setEnd(
      resto.at(-1) ?? primero,
      resto.at(-1)?.childNodes.length ?? primero.childNodes.length,
    );
    const seleccion = getSelection();
    seleccion?.removeAllRanges();
    seleccion?.addRange(rango);
  });
  await alLlegar({ nombre: 'estados-seleccion', tapar: [] });
  await page.evaluate(() => getSelection()?.removeAllRanges());

  // El anillo de foco del teclado: se teclea primero para que el motor lo cuente como teclado.
  for (const pieza of PIEZAS) {
    await page.keyboard.press('Shift');
    await muestra(page, pieza).locator('[data-muestra-de="foco"]').focus();
    await alLlegar({ nombre: `estados-foco-${pieza}`, tapar: [] });
    await page.evaluate(() => {
      (document.activeElement as HTMLElement | null)?.blur();
    });
  }

  for (const pieza of PIEZAS) {
    const nombre = pieza === 'sistema' ? 'Sistema' : 'Heredado';
    await abrirYResaltar(page, alLlegar, pieza, {
      disparador: `${nombre} · lista`,
      abierto: (p) => p.getByRole('listbox'),
      renglon: (p) => p.getByRole('option', { name: 'Opción tres' }),
      parada: 'estados-lista',
    });
    await abrirYResaltar(page, alLlegar, pieza, {
      disparador: `${nombre} · menú`,
      abierto: (p) => p.getByRole('menu'),
      renglon: (p) => p.getByRole('menuitem', { name: 'Acción tres' }),
      parada: 'estados-menu',
    });
    await abrirYResaltar(page, alLlegar, pieza, {
      disparador: `${nombre} · popover`,
      abierto: (p) => p.getByText('Dentro del popover'),
      parada: 'estados-popover',
    });
    await abrirYResaltar(page, alLlegar, pieza, {
      disparador: `${nombre} · panel`,
      abierto: (p) => p.getByText('Dentro del panel'),
      parada: 'estados-panel',
    });
  }
}

/** El globo de la mesa: mantener presionada una mesa del mapa (con ratón, el clic derecho). */
export async function recorrerElGloboDeLaMesa(page: Page, alLlegar: EnLaParada): Promise<void> {
  await page.goto('/mesero');
  const mesa = page.locator('[data-mesa-id]').first();
  await expect(mesa).toBeVisible();
  await page.waitForLoadState('networkidle');
  await mesa.click({ button: 'right' });
  await expect(page.locator('[data-menu-de-la-mesa]')).toBeVisible();
  await alLlegar({ nombre: 'estados-globo-de-la-mesa', tapar: [] });
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-menu-de-la-mesa]')).toHaveCount(0);
}
