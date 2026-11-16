import { expect, test } from '@playwright/test';

import { Equipo } from './ayudantes/roles.ts';
import { exigirDemostracion } from './ayudantes/sesion.ts';

/**
 * DP-21 · Bloque 9 · EL TECLADO EN PANTALLA (M16 y O7). SIN CORRER: la corre el orquestador con el
 * build. Sólo donde hay tacto (tableta, teléfono): ahí `(any-pointer: coarse)` es verdad.
 *
 * LO QUE SUPONE DEL NEGOCIO DE PRUEBA (ajustar si falla al correrla):
 *   · la dueña de `prueba-restaurante` abre en `/mesero` el diálogo de abrir una mesa libre (toca la
 *     mesa y pulsa «Abrir mesa»), que trae el campo «Número de personas»; si el flujo del negocio
 *     cambia, basta apuntar `abrirUnDialogoConCampo` a otro diálogo con un campo de texto;
 *   · el teclado en pantalla no se emula en Chromium: se emula SU EFECTO, un visualViewport más bajo
 *     (`window.visualViewport` no es asignable, así que se manda el evento `resize` con un alto falso
 *     que `montarAltoVisible` lee a través de un objeto sustituto instalado antes de cargar).
 */

const SLUG = 'prueba-restaurante';

test.describe('el teclado en pantalla (DP-21 · M16/O7)', () => {
  test.use({ actionTimeout: 20_000, navigationTimeout: 30_000 });

  test.beforeAll(async ({ playwright }, info) => {
    await exigirDemostracion(playwright, info, SLUG);
  });

  test.beforeEach((_fixtures, info) => {
    test.skip(info.project.use.hasTouch !== true, 'sin tacto no hay teclado en pantalla');
  });

  test('un diálogo al abrir no enfoca ningún campo de texto, y --alto-visible sigue al visualViewport', async ({
    browser,
  }, info) => {
    test.setTimeout(3 * 60_000);
    const equipo = new Equipo(browser, SLUG);
    try {
      const duena = await equipo.pagina(info, 'dueno');
      await duena.goto('/mesero');
      const mesa = duena.locator('[data-mesa-id]').first();
      await expect(mesa).toBeVisible();
      await mesa.click();
      const dialogo = duena.getByRole('dialog').first();
      await expect(dialogo).toBeVisible();

      await test.step('el foco no cae en un campo de texto', async () => {
        await duena.waitForTimeout(400);
        const foco = await duena.evaluate(() => document.activeElement?.tagName ?? 'NADA');
        expect(['INPUT', 'TEXTAREA']).not.toContain(foco);
        // Y sigue dentro del diálogo (atrapado): su contenedor, no el cuerpo de la página.
        expect(await dialogo.evaluate((n) => n.contains(document.activeElement))).toBe(true);
      });

      await test.step('--alto-visible existe y es el alto que se ve', async () => {
        const [variable, interior] = await duena.evaluate(() => [
          getComputedStyle(document.documentElement).getPropertyValue('--alto-visible').trim(),
          Math.round(window.visualViewport?.height ?? window.innerHeight),
        ]);
        expect(variable).toBe(`${String(interior)}px`);
      });

      await test.step('al enfocar un campo lo trae al centro una sola vez, sin saltos', async () => {
        const campo = dialogo.locator('input:not([type=hidden])').first();
        test.skip((await campo.count()) === 0, 'este diálogo no trae un campo de texto');
        await duena.evaluate(() => {
          const contador = { n: 0 };
          (window as unknown as { __centrados: { n: number } }).__centrados = contador;
          const original: unknown = Reflect.get(Element.prototype, 'scrollIntoView');
          Element.prototype.scrollIntoView = function (this: Element, ...argumentos) {
            contador.n += 1;
            Reflect.apply(original as () => void, this, argumentos);
          };
        });
        await campo.tap();
        await duena.waitForTimeout(1200);
        const veces = await duena.evaluate(
          () => (window as unknown as { __centrados: { n: number } }).__centrados.n,
        );
        expect(veces).toBeLessThanOrEqual(1);
      });
    } finally {
      await equipo.cerrar();
    }
  });
});
