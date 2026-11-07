import { expect, test } from '@playwright/test';

import { Equipo } from './ayudantes/roles.ts';
import { cabecerasDeEscrituraDePrueba, exigirDemostracion } from './ayudantes/sesion.ts';

/**
 * DP-14.6 · UN POST A UNA RUTA DE LA API QUE NO EXISTE RESPONDE 404 EN JSON.
 *
 * Antes caía en la página de «no encontrada» de la aplicación y contestaba 200 con HTML: quien
 * llamaba creía que su comando había salido bien. Las rutas reales siguen ganando.
 */

const SLUG = 'prueba-restaurante';

test.describe('la API no inventa respuestas (DP-14.6)', () => {
  test.beforeAll(async ({ playwright }, info) => {
    await exigirDemostracion(playwright, info, SLUG);
  });

  test('POST /api/esto-no-existe es 404 con cuerpo JSON; un comando real no es 404', async ({
    browser,
  }, info) => {
    const duena = await new Equipo(browser, SLUG).pagina(info, 'dueno');
    const cabeceras = cabecerasDeEscrituraDePrueba();

    for (const ruta of ['/api/esto-no-existe', '/api/venta/esto-tampoco']) {
      const respuesta = await duena.request.post(ruta, { headers: cabeceras, data: {} });
      expect(respuesta.status(), `${ruta} no es 404`).toBe(404);
      expect(respuesta.headers()['content-type'] ?? '').toContain('application/json');
      const cuerpo = (await respuesta.json()) as {
        ok?: boolean;
        error?: { codigo?: string; mensaje?: string };
      };
      expect(cuerpo.ok).toBe(false);
      expect(cuerpo.error?.codigo).toBe('RUTA_NO_ENCONTRADA');
    }

    // Una ruta real de comando contesta lo suyo (aquí, un cuerpo inválido): nunca 404.
    const real = await duena.request.post('/api/venta/agregar-linea', {
      headers: cabeceras,
      data: {},
    });
    expect(real.status(), 'La ruta real quedó tapada por el comodín.').not.toBe(404);
    expect(real.status()).toBeLessThan(500);
    expect(real.headers()['content-type'] ?? '').toContain('application/json');
  });
});
