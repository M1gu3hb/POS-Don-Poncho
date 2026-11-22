import { expect, test, type Locator, type Page } from '@playwright/test';

import {
  abrirLaCaja,
  abrirLaMesa,
  CARTA,
  dialogoDeLaMesa,
  laMesa,
  prepararElPortalDelComensal,
  yaAbierto,
} from './ayudantes/mesas-heredadas.ts';
import { sesionDeLaCaja } from './ayudantes/conciliacion.ts';
import { Equipo } from './ayudantes/roles.ts';
import {
  cabecerasDeEscrituraDePrueba,
  consultarPuente,
  exigirDemostracion,
  vigilarFallos,
} from './ayudantes/sesion.ts';

/**
 * DP-25 · Parte 8 · DP-D227 · «DÓNDE SE VE» UN PLATILLO, EN EL NAVEGADOR (con dedo).
 *
 * La dueña, en Configuración → Portal de comensales → «El orden del menú», oculta la limonada SÓLO
 * del POS: no sale en la mesa del mesero ni en «Para llevar» de la Caja (ni buscándola), pero sí en
 * el portal del comensal. Luego la vuelve a mostrar en el POS y la oculta SÓLO del portal: el mesero
 * y la Caja la ven y el portal no.
 */

const SLUG = 'prueba-restaurante';
const MESA = 6;
const MESA_DEL_PORTAL = 5;
const LIMONADA = CARTA.limonada.nombre;
const BOTON_DE_LA_LIMONADA = new RegExp(`^${LIMONADA} \\$`);

test.describe('dónde se ve un platillo', () => {
  test.use({ actionTimeout: 30_000, navigationTimeout: 60_000 });

  test.beforeAll(async ({ playwright }, info) => {
    await exigirDemostracion(playwright, info, SLUG);
  });

  test('oculto del POS sigue en el portal; oculto del portal sigue en el POS', async ({
    browser,
  }, info) => {
    test.setTimeout(10 * 60_000);
    const pulsar = (objetivo: Locator) =>
      info.project.use.hasTouch === true ? objetivo.tap() : objetivo.click();
    const equipo = new Equipo(browser, SLUG);
    const fallos: (() => void)[] = [];
    try {
      const duena = await equipo.pagina(info, 'dueno');
      fallos.push(vigilarFallos(duena));
      const reseteo = await duena.request.post('/api/pruebas/resetear', {
        headers: cabecerasDeEscrituraDePrueba(),
        data: { confirmacion: 'RESETEAR' },
      });
      expect(reseteo.status(), `resetear: ${await reseteo.text()}`).toBe(200);

      const [limonada] = await consultarPuente<{ id: string; categoria_id: string }>(
        duena,
        'ProductoTerminado',
        { filtro: { nombre: LIMONADA }, limite: 1 },
      );
      const [categoria] = await consultarPuente<{ nombre: string }>(duena, 'CategoriaProducto', {
        filtro: { id: limonada?.categoria_id },
        limite: 1,
      });
      const seccion = categoria?.nombre ?? '';
      const token = await prepararElPortalDelComensal(duena, {
        mesa: MESA_DEL_PORTAL,
        zona: 'Interior',
        mesero: null,
      });

      /** La dueña elige dónde se ve la limonada y lee en pantalla lo que quedó. */
      const elegir = async (accion: string, queda: string) => {
        await duena.goto('/configuracion?seccion=portal');
        await pulsar(duena.getByRole('button', { name: `Ver los platillos de ${seccion}` }));
        const platillos = duena.getByRole('list', { name: `Platillos de ${seccion}, en orden` });
        await pulsar(platillos.getByRole('button', { name: `${LIMONADA}: dónde se ve` }));
        const caja = await duena.getByRole('button', { name: accion, exact: true }).boundingBox();
        expect(caja?.height ?? 0).toBeGreaterThanOrEqual(43.5);
        await pulsar(duena.getByRole('button', { name: accion, exact: true }));
        await expect(duena.getByText(`«${LIMONADA}» · ${queda}`, { exact: true })).toBeVisible();
      };

      const mesa = async (): Promise<{ pagina: Page; dialogo: Locator }> => {
        const pagina = await equipo.pagina(info, 'mesero');
        fallos.push(vigilarFallos(pagina, { sondeando: () => true }));
        await pagina.goto('/');
        await pagina.waitForURL(/\/mesero$/);
        return { pagina, dialogo: dialogoDeLaMesa(pagina, MESA) };
      };
      const enElMesero = async (dialogo: Locator, hay: boolean) => {
        await dialogo.getByLabel('Buscar producto').fill('Limonada');
        await expect(dialogo.getByRole('button', { name: BOTON_DE_LA_LIMONADA })).toHaveCount(
          hay ? 1 : 0,
        );
        await dialogo.getByLabel('Buscar producto').fill('');
      };
      const enLaCaja = async (hay: boolean) => {
        const rosa = await equipo.pagina(info, 'cajero');
        fallos.push(vigilarFallos(rosa, { sondeando: () => true }));
        await rosa.goto('/caja', { waitUntil: 'domcontentloaded' });
        if ((await sesionDeLaCaja(rosa)) === null) await abrirLaCaja(rosa, 150_000);
        await pulsar(rosa.getByRole('button', { name: /^Para llevar/ }));
        const dialogo = rosa.getByRole('dialog', { name: 'Pedido para llevar' });
        await yaAbierto(dialogo);
        await dialogo.getByLabel('Buscar producto').fill('Limonada');
        await expect(dialogo.getByRole('button', { name: BOTON_DE_LA_LIMONADA })).toHaveCount(
          hay ? 1 : 0,
        );
        await rosa.close();
      };
      const enElPortal = async (hay: boolean) => {
        const portal = await duena.context().newPage();
        await portal.goto(`/qr/${token}`);
        await expect(portal.getByText('Agua mineral 355 ml').first()).toBeVisible();
        await expect(portal.getByText(LIMONADA)).toHaveCount(hay ? 1 : 0);
        await portal.close();
      };

      await test.step('oculta del POS: no sale en el mesero ni en la Caja; sí en el portal', async () => {
        await elegir('Ocultar del POS (mesero y Caja)', 'Se ve en: portal QR');
        const { pagina, dialogo } = await mesa();
        await abrirLaMesa(pagina, duena, MESA, 2);
        await enElMesero(dialogo, false);
        await enLaCaja(false);
        await enElPortal(true);
      });

      await test.step('lo vuelve a mostrar en el POS y lo oculta del portal: el mesero y la Caja lo ven, el portal no', async () => {
        await elegir('Mostrar en el POS (mesero y Caja)', 'Se ve en: POS y portal QR');
        await elegir('Ocultar del portal QR', 'Se ve en: POS');
        const { pagina, dialogo } = await mesa();
        await laMesa(pagina, MESA).click();
        await yaAbierto(dialogo);
        await enElMesero(dialogo, true);
        await enLaCaja(true);
        await enElPortal(false);
      });

      await test.step('«Ocultar de todo» lo quita de los tres', async () => {
        await elegir('Mostrar en el portal QR', 'Se ve en: POS y portal QR');
        await elegir('Ocultar de todo', 'Oculto en todo');
        await enElPortal(false);
        await enLaCaja(false);
      });

      for (const exigirSinFallos of fallos) exigirSinFallos();
      const limpieza = await duena.request.post('/api/pruebas/resetear', {
        headers: cabecerasDeEscrituraDePrueba(),
        data: { confirmacion: 'RESETEAR' },
      });
      expect(limpieza.status(), `resetear al final: ${await limpieza.text()}`).toBe(200);
    } finally {
      await equipo.cerrar();
    }
  });
});
