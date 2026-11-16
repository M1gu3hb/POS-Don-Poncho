import { expect, type Page, test } from '@playwright/test';

import { Equipo } from './ayudantes/roles.ts';
import { abrirCajaPorLaRuta, exigirDemostracion } from './ayudantes/sesion.ts';
import { dedoDe } from './ayudantes/tacto.ts';

/**
 * DP-21 · Bloque 9 · EL SCROLL CON EL DEDO EN LAS LISTAS (M5). SIN CORRER: la corre el orquestador
 * con el build. Sólo corre donde hay tacto (tableta y teléfono): con ratón un arrastre no desplaza.
 *
 * LO QUE SUPONE DEL NEGOCIO DE PRUEBA (ajustar si falla al correrla):
 *   · la dueña de `prueba-restaurante` entra a `/caja`, `/registros`, `/inventario`, `/compras`,
 *     `/productos` y `/configuracion` (rutas del menú heredado) y cada una es más alta que la
 *     ventana; si una cabe entera no hay qué desplazar y esa prueba se salta, no falla;
 *   · en `/caja` hay una pestaña «Movimientos» (abre con la caja abierta: la prueba la abre por la
 *     ruta con $1,000.00 si no lo estaba);
 *   · «Productos» tiene un botón «Nuevo producto» que abre un diálogo largo (si el diálogo cabe, se
 *     salta).
 * El deslizamiento es de un dedo por CDP (`tacto.ts`), de abajo hacia arriba, empezando en medio de
 * la pantalla: lo que se mide es que el contenido SE MOVIÓ (la página o el contenedor que desplaza).
 */

const SLUG = 'prueba-restaurante';

/** Lo que se ha desplazado la página, o el elemento que se pasa. */
const desplazamiento = (pagina: Page): Promise<number> =>
  pagina.evaluate(() => window.scrollY + (document.scrollingElement?.scrollTop ?? 0));

async function deslizarHaciaArriba(
  pagina: Page,
  info: Parameters<typeof dedoDe>[1],
): Promise<void> {
  const tam = pagina.viewportSize() ?? { width: 800, height: 600 };
  const x = tam.width / 2;
  const dedo = await dedoDe(pagina, info);
  await dedo.bajar(x, tam.height * 0.75);
  for (let paso = 1; paso <= 10; paso += 1) {
    await dedo.mover(x, tam.height * 0.75 - paso * (tam.height * 0.05));
    await pagina.waitForTimeout(16);
  }
  await dedo.subir();
}

async function seDesplaza(pagina: Page, info: Parameters<typeof dedoDe>[1], donde: string) {
  const sobra = await pagina.evaluate(
    () => (document.scrollingElement?.scrollHeight ?? 0) - window.innerHeight,
  );
  test.skip(sobra < 80, `${donde} cabe entera en la ventana: no hay qué desplazar`);
  const antes = await desplazamiento(pagina);
  await deslizarHaciaArriba(pagina, info);
  await expect
    .poll(() => desplazamiento(pagina), { message: `${donde}: el dedo no movió la página.` })
    .toBeGreaterThan(antes);
}

const PANTALLAS: readonly { ruta: string; nombre: string }[] = [
  { ruta: '/registros', nombre: 'Registros' },
  { ruta: '/inventario', nombre: 'Inventario' },
  { ruta: '/compras', nombre: 'Compras' },
  { ruta: '/productos', nombre: 'Productos' },
  { ruta: '/configuracion', nombre: 'Configuración' },
];

test.describe('el scroll con el dedo (DP-21 · M5)', () => {
  test.use({ actionTimeout: 20_000, navigationTimeout: 30_000 });

  test.beforeAll(async ({ playwright }, info) => {
    await exigirDemostracion(playwright, info, SLUG);
  });

  test.beforeEach((_fixtures, info) => {
    test.skip(info.project.use.hasTouch !== true, 'el deslizamiento necesita tacto');
  });

  test('Caja → Movimientos se desplaza con el dedo', async ({ browser }, info) => {
    test.setTimeout(3 * 60_000);
    const equipo = new Equipo(browser, SLUG);
    try {
      const duena = await equipo.pagina(info, 'dueno');
      await abrirCajaPorLaRuta(duena, 100_000);
      await duena.goto('/caja');
      await duena.getByRole('tab', { name: 'Movimientos' }).click();
      await expect(duena.getByRole('tabpanel')).toBeVisible();
      await seDesplaza(duena, info, 'Caja → Movimientos');
    } finally {
      await equipo.cerrar();
    }
  });

  for (const { ruta, nombre } of PANTALLAS) {
    test(`${nombre} se desplaza con el dedo`, async ({ browser }, info) => {
      test.setTimeout(3 * 60_000);
      const equipo = new Equipo(browser, SLUG);
      try {
        const duena = await equipo.pagina(info, 'dueno');
        await duena.goto(ruta);
        await expect(duena.locator('main')).toBeVisible();
        await seDesplaza(duena, info, nombre);
      } finally {
        await equipo.cerrar();
      }
    });
  }

  test('un diálogo largo (Nuevo producto) se desplaza por dentro con el dedo', async ({
    browser,
  }, info) => {
    test.setTimeout(3 * 60_000);
    const equipo = new Equipo(browser, SLUG);
    try {
      const duena = await equipo.pagina(info, 'dueno');
      await duena.goto('/productos');
      await duena
        .getByRole('button', { name: /Nuevo producto/ })
        .first()
        .click();
      const dialogo = duena.getByRole('dialog').first();
      await expect(dialogo).toBeVisible();
      const sobra = await dialogo.evaluate((n) => n.scrollHeight - n.clientHeight);
      test.skip(sobra < 40, 'el diálogo cabe entero: no hay qué desplazar');
      const caja = await dialogo.boundingBox();
      if (caja === null) throw new Error('El diálogo no tiene caja.');
      const dedo = await dedoDe(duena, info);
      const x = caja.x + caja.width / 2;
      await dedo.bajar(x, caja.y + caja.height * 0.8);
      for (let paso = 1; paso <= 10; paso += 1) {
        await dedo.mover(x, caja.y + caja.height * 0.8 - paso * 20);
        await duena.waitForTimeout(16);
      }
      await dedo.subir();
      await expect
        .poll(() => dialogo.evaluate((n) => n.scrollTop), { message: 'El diálogo no se movió.' })
        .toBeGreaterThan(0);
    } finally {
      await equipo.cerrar();
    }
  });
});
