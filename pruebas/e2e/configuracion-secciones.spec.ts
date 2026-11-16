import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';

import {
  direccionDeLaSeccion,
  SECCIONES,
  TABS_DE_ANTES,
} from '../../apps/web/src/configuracion/secciones.ts';
import { Equipo } from './ayudantes/roles.ts';
import { exigirDemostracion, vigilarFallos } from './ayudantes/sesion.ts';

/**
 * DP-21 · Bloque 21 · LA CONFIGURACIÓN, ORDENADA, EN EL NAVEGADOR.
 *
 * El contrato de la mudanza (`mudanza.contrato.test.ts`) lee el código: cada control de antes está
 * en su tarjeta nueva. Esto la ABRE: la dueña entra a cada sección por su dirección, la sección
 * pinta sus tarjetas sin errores, la página no se desborda a lo ancho, y los enlaces de antes
 * (`?tab=…`) caen en su sección nueva. Deja una captura de cada sección, por aparato, en
 * `qa/dp21/configuracion/` (el barrido visual del Bloque 16 parte de ahí).
 */

const SLUG = 'prueba-restaurante';
const AQUI = dirname(fileURLToPath(import.meta.url));
const CAPTURAS = join(AQUI, '..', '..', 'qa', 'dp21', 'configuracion');
/** Las que sólo ve el usuario de plataforma: a la dueña de prueba no se le exigen. */
const SECCIONES_DEL_PROVEEDOR: ReadonlySet<string> = new Set(['laboratorio', 'mantenimiento']);

test.describe('la Configuración, ordenada (DP-21 · Bloque 21)', () => {
  test.use({ actionTimeout: 20_000, navigationTimeout: 30_000 });

  test.beforeAll(async ({ playwright }, info) => {
    await exigirDemostracion(playwright, info, SLUG);
  });

  test('cada sección abre por su dirección, con sus tarjetas, sin desbordarse y sin errores', async ({
    browser,
  }, info) => {
    test.setTimeout(8 * 60_000);
    const carpeta = join(CAPTURAS, info.project.name);
    mkdirSync(carpeta, { recursive: true });
    const duena = await new Equipo(browser, SLUG).pagina(info, 'dueno');
    const exigir = vigilarFallos(duena);
    const vistas: string[] = [];

    for (const seccion of SECCIONES) {
      await test.step(`«${seccion.nombre}»`, async () => {
        await duena.goto(direccionDeLaSeccion(seccion.id));
        // Primero se espera a que la pantalla PINTE una sección (la pedida o la que le toque).
        await expect(duena.getByRole('tabpanel').first()).toBeVisible();
        const pagina = duena.getByRole('tabpanel', { name: seccion.nombre, exact: true });
        // Lo que este puesto no ve cae en lo primero que sí ve: no es un error, pero se dice.
        if ((await pagina.count()) === 0) {
          info.annotations.push({
            type: 'sección no visible para la dueña',
            description: seccion.id,
          });
          return;
        }
        vistas.push(seccion.id);
        await expect(pagina.getByRole('heading', { level: 2, name: seccion.nombre })).toBeVisible();
        // Una sección sin nada que tocar sería una mudanza a medias.
        await expect
          .poll(async () => pagina.locator('button, input, select, textarea, a[href]').count())
          .toBeGreaterThan(0);
        // La página no se desborda a lo ancho (ni en el teléfono).
        const desborde = await duena.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(desborde, `«${seccion.nombre}» se desborda a lo ancho`).toBeLessThanOrEqual(1);
        await duena.screenshot({ path: join(carpeta, `${seccion.id}.png`), fullPage: true });
      });
    }
    // Que no pase en falso: la dueña ve, por lo menos, las doce secciones del negocio y «Este
    // aparato» (el laboratorio y el mantenimiento son del proveedor).
    expect(vistas.length, `Secciones vistas: ${vistas.join(', ')}`).toBeGreaterThanOrEqual(13);
    for (const obligada of ['ventas-y-cobro', 'ticket-y-folios', 'caja', 'este-aparato']) {
      expect(vistas).toContain(obligada);
    }
    exigir();
  });

  test('los enlaces de antes (`?tab=…`) caen en su sección nueva', async ({ browser }, info) => {
    test.setTimeout(4 * 60_000);
    const duena = await new Equipo(browser, SLUG).pagina(info, 'dueno');
    const exigir = vigilarFallos(duena);
    for (const [tab, id] of Object.entries(TABS_DE_ANTES)) {
      const destino = SECCIONES.find((s) => s.id === id);
      expect(destino, `«${tab}» apunta a una sección que no existe`).toBeDefined();
      if (destino === undefined) continue;
      await test.step(`?tab=${tab} → «${destino.nombre}»`, async () => {
        await duena.goto(`/configuracion?tab=${tab}`);
        const visible = duena.getByRole('tabpanel').first();
        await expect(visible).toBeVisible();
        // Si la dueña ve la sección de destino, es ésa la que abre; si no, la primera que sí ve.
        if (!SECCIONES_DEL_PROVEEDOR.has(id)) {
          await expect(
            duena.getByRole('tabpanel', { name: destino.nombre, exact: true }),
          ).toBeVisible();
        }
      });
    }
    exigir();
  });
});
