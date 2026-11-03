import { expect, test, type Page } from '@playwright/test';

import { Equipo } from './ayudantes/roles.ts';
import {
  cancelarLaCuentaDeLaMesa,
  comandaNueva,
  resetearLaDemo,
  SLUG,
} from './ayudantes/modo-espera.ts';
import { exigirDemostracion } from './ayudantes/sesion.ts';

/**
 * DP-13.2 · EL SONIDO NO PUEDE QUEDAR MUDO, en la tableta de cocina.
 *
 * La tableta se prende y nadie la toca: el navegador no deja sonar ni hablar hasta el primer
 * gesto. Antes, la comanda llegaba muda y nadie se enteraba. Ahora la pantalla dice «Sonido
 * apagado · toca para activar», y un toque hace sonar el timbre y decir la comanda.
 *
 * La voz es la del navegador (`speechSynthesis`), que en Chromium sin pantalla no tiene voces:
 * se cambia `speak` por uno que se porta como Chrome —niega con «not-allowed» mientras la página
 * no ha recibido un gesto (un `pointerdown`, `touchstart` o `keydown` suyo) y, después, «dice» la
 * frase y la anota—.
 * Corre en serie (`--workers=1`): abre y cancela una cuenta de la demo.
 */

async function vozComoChrome(pagina: Page): Promise<void> {
  await pagina.addInitScript(() => {
    const dichas: string[] = [];
    Object.defineProperty(window, '__dichas', { value: dichas });
    // El primer gesto de ESTA página. `navigator.userActivation` no sirve aquí: Playwright entra
    // con la sesión ya hecha y Chromium la da por activada.
    let gesto = false;
    for (const tipo of ['pointerdown', 'touchstart', 'keydown'])
      window.addEventListener(
        tipo,
        () => {
          gesto = true;
        },
        { capture: true },
      );
    window.speechSynthesis.speak = (frase: SpeechSynthesisUtterance) => {
      setTimeout(() => {
        if (!gesto) {
          frase.dispatchEvent(
            new SpeechSynthesisErrorEvent('error', { error: 'not-allowed', utterance: frase }),
          );
          return;
        }
        dichas.push(frase.text);
        frase.dispatchEvent(new SpeechSynthesisEvent('end', { utterance: frase }));
      }, 0);
    };
  });
}

function dichas(pagina: Page): Promise<string[]> {
  return pagina.evaluate(() => [...((window as unknown as { __dichas: string[] }).__dichas ?? [])]);
}

test.describe('el sonido bloqueado en la tableta (DP-13.2)', () => {
  test.use({ actionTimeout: 20_000, navigationTimeout: 30_000 });

  test.beforeAll(async ({ playwright }, info) => {
    await exigirDemostracion(playwright, info, SLUG);
  });

  test('llega una comanda sin haber tocado nada: el aviso lo dice; un toque y suena y habla', async ({
    browser,
  }, info) => {
    test.skip(info.project.name !== 'tablet', 'la tableta de cocina');
    test.setTimeout(3 * 60_000);
    const duena = await new Equipo(browser, SLUG).pagina(info, 'dueno');
    await resetearLaDemo(duena);
    await vozComoChrome(duena);
    try {
      await duena.goto('/cocina');
      await expect(duena.getByRole('heading', { level: 1, name: /^Cocina/ })).toBeVisible();
      const aviso = duena.getByRole('button', { name: 'Sonido apagado · toca para activar' });
      await expect(aviso).toHaveCount(0);

      await comandaNueva(duena);

      // Sin un gesto: ni timbre ni voz, y la pantalla lo dice.
      await expect(duena.getByText('Nuevo pedido recibido').first()).toBeVisible({
        timeout: 30_000,
      });
      await expect(aviso).toBeVisible({ timeout: 10_000 });
      await expect(duena.locator('html')).not.toHaveAttribute('data-ultimo-sonido', /.+/);
      expect(await dichas(duena)).toEqual([]);

      // Un toque: suena lo pendiente, la voz dice la comanda y el aviso se va.
      await aviso.tap();
      await expect(duena.locator('html')).toHaveAttribute('data-ultimo-sonido', 'ping');
      await expect.poll(() => dichas(duena), { timeout: 10_000 }).toHaveLength(1);
      expect((await dichas(duena))[0]).toMatch(/mesa/i);
      await expect(aviso).toHaveCount(0);
    } finally {
      await cancelarLaCuentaDeLaMesa(duena);
    }
  });
});
