import type { Page } from '@playwright/test';

import { exigirDemostracion } from '../ayudantes/sesion.ts';

import { aparatoPorId } from './arnes/aparatos.ts';
import { expect, exigirServidor, test } from './arnes/prueba.ts';
import { VariosAparatos } from './arnes/varios-aparatos.ts';

/**
 * VARIOS APARATOS A LA VEZ, probado de punta a punta: la Caja en una PC con Windows (Chrome 156), el
 * mesero en un teléfono, la cocina en una tableta y el portal del comensal en otro teléfono, todos
 * sobre el mismo servidor, cada uno con SU perfil y SU sesión. Se comprueba que cada contexto tiene la
 * medida y el tacto de su aparato, y que son sesiones distintas (el cajero no es el mesero).
 */

const SLUG = 'prueba-restaurante';

const quien = async (p: Page): Promise<{ datos?: { id?: string } }> =>
  (await (await p.request.get('/api/catalogo/sesion')).json()) as { datos?: { id?: string } };

test.describe('varios aparatos a la vez', () => {
  test.use({ actionTimeout: 30_000, navigationTimeout: 60_000 });

  test.beforeAll(async ({ playwright }, info) => {
    await exigirServidor(info.project.use.baseURL);
    await exigirDemostracion(playwright, info, SLUG);
  });

  test('la caja, el mesero, la cocina y el portal, cada uno con su perfil', async ({
    aparato,
  }, info) => {
    process.stdout.write(`[varios] el proyecto en curso es ${aparato.id}; cada puesto trae el suyo
`);
    test.setTimeout(6 * 60_000);
    const aparatos = new VariosAparatos(info, SLUG);
    try {
      const abiertos = await aparatos.abrirTodos([
        { puesto: 'caja', aparato: 'win-1366x768-100', rol: 'cajero', ruta: '/caja' },
        { puesto: 'mesero', aparato: 'telefono-390x844', rol: 'mesero', ruta: '/mesero' },
        { puesto: 'cocina', aparato: 'tableta-800x1280', rol: 'cocina', ruta: '/cocina' },
        { puesto: 'portal', aparato: 'telefono-360x800', ruta: `/n/${SLUG}/login-pos` },
      ]);
      expect(abiertos).toHaveLength(4);
      for (const abierto of abiertos) {
        const esperado = aparatoPorId(abierto.aparato.id);
        const visto = await abierto.page.evaluate(() => ({
          ancho: innerWidth,
          alto: innerHeight,
          grueso: matchMedia('(any-pointer: coarse)').matches,
        }));
        expect(visto, abierto.puesto).toEqual({
          ancho: esperado.viewport.width,
          alto: esperado.viewport.height,
          grueso: true,
        });
      }
      const [caja, mesero] = abiertos;
      if (caja === undefined || mesero === undefined) throw new Error('faltan puestos');
      const [deLaCaja, delMesero] = [await quien(caja.page), await quien(mesero.page)];
      expect(deLaCaja.datos?.id, 'la caja tiene su sesión').toBeDefined();
      expect(deLaCaja.datos?.id, 'el mesero es otra persona').not.toBe(delMesero.datos?.id);
    } finally {
      await aparatos.cerrar();
    }
  });
});
