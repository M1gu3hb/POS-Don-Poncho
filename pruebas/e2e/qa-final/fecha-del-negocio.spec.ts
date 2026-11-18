import { Equipo } from '../ayudantes/roles.ts';
import { exigirDemostracion } from '../ayudantes/sesion.ts';

import { instalarRelojFalso } from './arnes/reloj.ts';
import { navegadorDe } from './arnes/ligero.ts';
import { expect, exigirServidor, test } from './arnes/prueba.ts';
import { toque } from './arnes/toque.ts';
import { vigilarPagina } from './arnes/vigilancia.ts';

/**
 * EL DÍA DEL NEGOCIO A LAS 18:30 (DP-22 · Hallazgo 1). A las 18:30 de México ya es «mañana» en UTC
 * (00:30 del 17): `new Date().toISOString().slice(0, 10)` proponía la fecha del día siguiente en
 * «Registrar gasto» y «Registrar compra», y el servidor rechazaba un gasto en efectivo con esa
 * fecha (el cajón es el de HOY). El restaurante cierra a las 19:00: pasaba todos los días, en la
 * última hora.
 *
 * Con el reloj falso del arnés (`arnes/reloj.ts`) la página cree que son las 18:30 del 16-11 en
 * México, con el dedo se abre cada diálogo y la fecha que propone tiene que ser la de HOY del
 * negocio. `page.clock` sólo mueve la hora de la página: la del servidor sigue siendo la real, y
 * por eso la prueba sólo mira lo que la página propone.
 */

const SLUG = 'prueba-restaurante';
const AHORA = '2026-11-16T18:30:00-06:00';
const HOY_DEL_NEGOCIO = '2026-11-16';

test.describe('la fecha que proponen los diálogos a las 18:30', () => {
  test.use({ actionTimeout: 30_000, navigationTimeout: 60_000 });

  test.beforeAll(async ({ playwright }, info) => {
    await exigirServidor(info.project.use.baseURL);
    await exigirDemostracion(playwright, info, SLUG);
  });

  for (const [boton, dialogo] of [
    ['Registrar gasto', 'Registrar gasto operativo'],
    ['Registrar compra', 'Registrar compra'],
  ] as const) {
    test(`«${boton}» propone la fecha de HOY del negocio, no la de mañana`, async ({
      browser,
      aparato,
    }, info) => {
      test.setTimeout(4 * 60_000);
      const equipo = new Equipo(navegadorDe(browser, aparato), SLUG);
      try {
        const duena = await equipo.pagina(info, 'dueno');
        duena.setDefaultTimeout(30_000);
        vigilarPagina(duena);
        await instalarRelojFalso(duena, AHORA);
        await duena.goto('/compras', { waitUntil: 'domcontentloaded' });
        const visto = await duena.evaluate(() => ({
          utc: new Date().toISOString().slice(0, 10),
          hora: new Date().getUTCHours(),
        }));
        expect(visto, 'el reloj falso no llegó a la página').toEqual({
          utc: '2026-11-17',
          hora: 0,
        });

        await toque(duena, duena.getByRole('button', { name: new RegExp(`^${boton}`) }));
        const ventana = duena.getByRole('dialog', { name: new RegExp(dialogo) });
        await expect(ventana).toBeVisible();
        await expect(
          ventana.locator('input[type="date"]').first(),
          `«${boton}» propone una fecha que no es la de hoy del negocio`,
        ).toHaveValue(HOY_DEL_NEGOCIO);
      } finally {
        await equipo.cerrar();
      }
    });
  }
});
