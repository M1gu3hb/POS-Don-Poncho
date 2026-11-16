import { expect, test } from '@playwright/test';

import { Equipo } from './ayudantes/roles.ts';
import {
  abrirCajaPorLaRuta,
  abrirPantalla,
  cerrarCajaYCuadrar,
  exigirDemostracion,
  vigilarFallos,
} from './ayudantes/sesion.ts';

/**
 * DP-21 · Bloque 9 · EL CORTE AL TACTO (M23 y O6). SIN CORRER: la corre el orquestador con el build.
 *
 * LO QUE SUPONE DEL NEGOCIO DE PRUEBA (ajustar si falla al correrla):
 *   · `prueba-restaurante` con su dueño de la demo y una caja que se puede abrir por la ruta (la
 *     prueba la abre con $1,000.00 si no estaba abierta, y la cierra cuadrada sólo si ella la abrió);
 *   · la pantalla `/restaurante/cierre-diario-y-arqueo` dice «Cierre diario», con las etiquetas
 *     «Efectivo contado físicamente» y «Dinero dejado en caja (fondo)»;
 *   · corre en los tres proyectos (escritorio, tableta, teléfono): la alineación se pide de las dos
 *     cajas en cualquiera, y la fila de dos columnas sólo existe de `sm:` para arriba.
 */

const SLUG = 'prueba-restaurante';
const FONDO_CENTAVOS = 100_000;

test.describe('el corte al tacto (DP-21 · M23/O6)', () => {
  test.use({ actionTimeout: 20_000, navigationTimeout: 30_000 });

  test.beforeAll(async ({ playwright }, info) => {
    await exigirDemostracion(playwright, info, SLUG);
  });

  test('al abrir no hay foco en un campo, el conteo sigue a ciegas y las dos cajas miden lo mismo', async ({
    browser,
  }, info) => {
    test.setTimeout(3 * 60_000);
    const equipo = new Equipo(browser, SLUG);
    const duena = await equipo.pagina(info, 'dueno');
    const sinFallos = vigilarFallos(duena);
    const laAbrio = await abrirCajaPorLaRuta(duena, FONDO_CENTAVOS);
    try {
      await abrirPantalla(duena, '/restaurante/cierre-diario-y-arqueo', /Cierre diario/);
      const contado = duena.getByLabel(/Efectivo contado físicamente/);
      const fondo = duena.getByLabel(/Dinero dejado en caja/);
      await expect(contado).toBeVisible();

      await test.step('nada se enfoca solo y la pantalla se queda arriba', async () => {
        await duena.waitForTimeout(500); // un foco tardío (un efecto) aparece después de pintar
        const foco = await duena.evaluate(() => document.activeElement?.tagName ?? 'NADA');
        expect(['INPUT', 'TEXTAREA'], 'Un campo de texto se enfocó solo al abrir.').not.toContain(
          foco,
        );
        expect(await duena.evaluate(() => window.scrollY)).toBe(0);
        await expect(duena.getByRole('heading', { name: /Cierre diario/ })).toBeInViewport();
      });

      await test.step('a ciegas: el esperado no aparece hasta que se escribe', async () => {
        await expect(duena.getByRole('status').getByText('Esperado', { exact: true })).toHaveCount(
          0,
        );
        await contado.fill('1000');
        await expect(
          duena.getByRole('status').getByText('Esperado', { exact: true }),
        ).toBeVisible();
        await contado.fill('');
      });

      await test.step('«Efectivo contado» y «Dinero dejado en caja» miden y se alinean igual', async () => {
        const [a, b] = [await contado.boundingBox(), await fondo.boundingBox()];
        if (a === null || b === null) throw new Error('Las dos cajas deben estar a la vista.');
        expect(Math.abs(a.height - b.height), 'No miden lo mismo de alto.').toBeLessThanOrEqual(1);
        expect(
          Math.abs(a.y + a.height - (b.y + b.height)),
          'No se alinean por abajo.',
        ).toBeLessThanOrEqual(1);
        // La ayuda larga está FUERA de la fila: debajo de las dos cajas, no entre ellas.
        const ayuda = await duena.locator('#ayuda-contado').boundingBox();
        if (ayuda === null) throw new Error('La ayuda del conteo no está a la vista.');
        expect(ayuda.y).toBeGreaterThanOrEqual(Math.max(a.y + a.height, b.y + b.height) - 1);
      });
      sinFallos();
    } finally {
      if (laAbrio) await cerrarCajaYCuadrar(duena, FONDO_CENTAVOS);
    }
  });
});
