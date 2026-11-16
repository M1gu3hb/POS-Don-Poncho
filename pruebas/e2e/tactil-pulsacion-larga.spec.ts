import { expect, test } from '@playwright/test';

import { Equipo } from './ayudantes/roles.ts';
import { exigirDemostracion, vigilarFallos } from './ayudantes/sesion.ts';
import { mantenerPresionada } from './ayudantes/tacto.ts';

/**
 * DP-21 · Bloque 9 · LA PULSACIÓN LARGA NO SELECCIONA NADA (M4). SIN CORRER: la corre el
 * orquestador con el build.
 *
 * LO QUE SUPONE DEL NEGOCIO DE PRUEBA (ajustar si falla al correrla):
 *   · `prueba-restaurante` con su mesero de la demo y al menos una mesa activa en `/mesero` (la
 *     primera `[data-mesa-id]` de la zona que abre); no hace falta que esté libre ni ocupada;
 *   · en los proyectos con tacto (tableta, teléfono) `mantenerPresionada` es un dedo CDP de
 *     700 ms; en el escritorio es el clic derecho (no selecciona nada, pero sí dispara
 *     `contextmenu`, y es lo que se comprueba ahí);
 *   · el globo de la mesa es `role="menu"` con `data-menu-de-la-mesa`.
 */

const SLUG = 'prueba-restaurante';

test.describe('la pulsación larga no selecciona nada (DP-21 · M4)', () => {
  test.use({ actionTimeout: 20_000, navigationTimeout: 30_000 });

  test.beforeAll(async ({ playwright }, info) => {
    await exigirDemostracion(playwright, info, SLUG);
  });

  test('mantener una mesa abre su globo sin texto seleccionado y sin el menú del sistema', async ({
    browser,
  }, info) => {
    test.setTimeout(3 * 60_000);
    const equipo = new Equipo(browser, SLUG);
    try {
      const mesero = await equipo.pagina(info, 'mesero');
      const sinFallos = vigilarFallos(mesero);
      await mesero.goto('/mesero');
      // Cada `contextmenu` que llegue a la ventana, ya pasado por todos los oyentes, ¿se canceló?
      await mesero.evaluate(() => {
        const registro: boolean[] = [];
        (window as unknown as { __menus: boolean[] }).__menus = registro;
        window.addEventListener('contextmenu', (e) => {
          registro.push(e.defaultPrevented);
        });
      });
      const laMesa = mesero.locator('[data-mesa-id]').first();
      await expect(laMesa).toBeVisible();

      await mantenerPresionada(mesero, info, laMesa);
      const globo = mesero.locator('[data-menu-de-la-mesa]');
      await expect(globo).toBeVisible();

      await test.step('no hay texto seleccionado, ni en la mesa ni en el globo', async () => {
        expect(await mesero.evaluate(() => window.getSelection()?.toString() ?? '')).toBe('');
        const seleccionable = await globo.evaluate((nodo) => {
          const estilo = getComputedStyle(nodo);
          return `${estilo.userSelect}|${estilo.getPropertyValue('-webkit-touch-callout')}`;
        });
        expect(seleccionable.split('|')[0]).toBe('none');
      });

      await test.step('el menú del sistema («copiar, seleccionar todo») no sale', async () => {
        const menus = await mesero.evaluate(
          () => (window as unknown as { __menus: boolean[] }).__menus,
        );
        for (const cancelado of menus) {
          expect(cancelado, 'Un contextmenu llegó sin cancelar.').toBe(true);
        }
      });
      sinFallos();
    } finally {
      await equipo.cerrar();
    }
  });

  test('en un campo de texto el menú se queda; en un botón se cancela', async ({
    browser,
  }, info) => {
    test.setTimeout(2 * 60_000);
    const equipo = new Equipo(browser, SLUG);
    try {
      const mesero = await equipo.pagina(info, 'mesero');
      await mesero.goto('/mesero');
      await expect(mesero.locator('[data-mesa-id]').first()).toBeVisible();
      const resultado = await mesero.evaluate(() => {
        const intentar = (nodo: HTMLElement): boolean => {
          document.body.append(nodo);
          const sinCancelar = nodo.dispatchEvent(
            new MouseEvent('contextmenu', { bubbles: true, cancelable: true }),
          );
          nodo.remove();
          return sinCancelar;
        };
        const campo = document.createElement('input');
        const area = document.createElement('textarea');
        const editable = document.createElement('div');
        editable.contentEditable = 'true';
        return {
          boton: intentar(document.createElement('button')),
          campo: intentar(campo),
          area: intentar(area),
          editable: intentar(editable),
          seleccionEnCampo: (() => {
            campo.value = 'texto';
            document.body.append(campo);
            const valor = getComputedStyle(campo).userSelect;
            campo.remove();
            return valor;
          })(),
        };
      });
      expect(resultado.boton, 'El menú de un botón no se canceló.').toBe(false);
      expect(resultado.campo, 'El menú de un input se canceló: ahí se pega.').toBe(true);
      expect(resultado.area).toBe(true);
      expect(resultado.editable).toBe(true);
      expect(resultado.seleccionEnCampo).not.toBe('none');
    } finally {
      await equipo.cerrar();
    }
  });
});
