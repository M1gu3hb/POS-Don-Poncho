import { expect, test, type Locator } from '@playwright/test';

import {
  abrirLaCaja,
  abrirLaMesa,
  CARTA,
  dialogoDeLaMesa,
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
 * DP-24 · EL ORDEN, LAS CATEGORÍAS CON COLOR Y LAS OPCIONES DEL MENÚ, EN EL NAVEGADOR (con dedo).
 *
 * La dueña, en Configuración → Portal de comensales → «El orden del menú»: sube y baja secciones y
 * platillos con botones de 44 px (con `tap()` en tableta y teléfono), oculta un platillo del menú
 * digital y guarda; al recargar sigue igual. Después el mesero ve las pestañas en ESE orden, con su
 * color y una franja en cada tarjeta, y la cerveza trae «Prepárala» con sus precios. La Caja
 * («Para llevar») usa la misma rejilla.
 */

const SLUG = 'prueba-restaurante';
const MESA = 6;
const PREPARALA = [
  { nombre: 'Michelado', precio: '15' },
  { nombre: 'Cubano', precio: '20' },
];

test.describe('el orden y el color del menú', () => {
  test.use({ actionTimeout: 30_000, navigationTimeout: 60_000 });

  test.beforeAll(async ({ playwright }, info) => {
    await exigirDemostracion(playwright, info, SLUG);
  });

  test('la dueña ordena con el dedo; el mesero y la Caja lo ven en ese orden, con color y con «Prepárala»', async ({
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

      const comando = async (ruta: string, data: Record<string, unknown>) => {
        const r = await duena.request.post(ruta, { headers: cabecerasDeEscrituraDePrueba(), data });
        expect(r.ok(), `${ruta}: ${await r.text()}`).toBe(true);
        return (await r.json()) as { datos?: Record<string, unknown> };
      };

      // Cada categoría con su color de la paleta, y «Prepárala» en la cerveza (los mismos comandos).
      const categorias = await consultarPuente<{ id: string; nombre: string; orden: number }>(
        duena,
        'CategoriaProducto',
        { filtro: { activo: true }, limite: 50 },
      );
      const enOrden = [...categorias].sort((a, b) => a.orden - b.orden);
      for (const [i, c] of enOrden.entries()) {
        await comando('/api/catalogo/guardar-categoria', {
          categoriaId: c.id,
          color: `cat-${String(i + 1)}`,
        });
      }
      const [cerveza] = await consultarPuente<{ id: string }>(duena, 'ProductoTerminado', {
        filtro: { nombre: CARTA.cerveza.nombre },
        limite: 1,
      });
      const grupo = await comando('/api/catalogo/guardar-grupo-de-opciones', {
        nombre: 'Prepárala',
        tipo: 'unica',
        obligatorio: false,
        opciones: PREPARALA,
      });
      await comando('/api/catalogo/asignar-grupos-de-opciones', {
        productoId: cerveza?.id,
        grupoIds: [(grupo.datos as { grupoId: string }).grupoId],
      });

      let primera = '';
      let segunda = '';
      let delPrimerPlatillo: string[] = [];
      await test.step('la dueña baja la primera sección y un platillo, oculta otro y guarda', async () => {
        await duena.goto('/configuracion?seccion=portal');
        const lista = duena.getByRole('list', { name: 'Secciones del menú, en orden' });
        await expect(lista).toBeVisible();
        const botones = lista.getByRole('button', { name: /^Bajar / });
        const nombres = async () =>
          (await botones.evaluateAll((n) => n.map((b) => b.getAttribute('aria-label') ?? ''))).map(
            (t) => t.replace(/^Bajar /, ''),
          );
        const antes = await nombres();
        primera = antes[0] ?? '';
        segunda = antes[1] ?? '';
        // Cada botón de orden mide 44 px o más, con dedo y con ratón.
        const caja = await botones.first().boundingBox();
        expect(caja?.height ?? 0).toBeGreaterThanOrEqual(43.5);
        expect(caja?.width ?? 0).toBeGreaterThanOrEqual(43.5);

        await pulsar(duena.getByRole('button', { name: `Bajar ${primera}`, exact: true }));
        await expect.poll(nombres).toEqual([segunda, primera, ...antes.slice(2)]);
        await pulsar(duena.getByRole('button', { name: 'Guardar el orden de las secciones' }));
        await expect(duena.getByText('Orden de las secciones guardado')).toBeVisible();

        // Los platillos de la segunda sección (ahora primera): baja el primero y oculta el último.
        await pulsar(duena.getByRole('button', { name: `Ver los platillos de ${segunda}` }));
        const platillos = duena.getByRole('list', { name: `Platillos de ${segunda}, en orden` });
        const delOrden = async () =>
          (
            await platillos
              .getByRole('button', { name: /^Bajar / })
              .evaluateAll((n) => n.map((b) => b.getAttribute('aria-label') ?? ''))
          ).map((t) => t.replace(/^Bajar /, ''));
        const platillosAntes = await delOrden();
        if (platillosAntes.length >= 2) {
          await pulsar(
            platillos.getByRole('button', {
              name: `Bajar ${platillosAntes[0] ?? ''}`,
              exact: true,
            }),
          );
          delPrimerPlatillo = [
            platillosAntes[1] ?? '',
            platillosAntes[0] ?? '',
            ...platillosAntes.slice(2),
          ];
          await expect.poll(delOrden).toEqual(delPrimerPlatillo);
          await pulsar(duena.getByRole('button', { name: `Guardar el orden de «${segunda}»` }));
          await expect(duena.getByText(`Orden de «${segunda}» guardado`)).toBeVisible();
        }
        const ultimo = platillosAntes.at(-1) ?? '';
        await pulsar(platillos.getByRole('button', { name: `${ultimo}: dónde se ve` }));
        await pulsar(duena.getByRole('button', { name: 'Ocultar del portal QR' }));
        await expect(duena.getByText(`«${ultimo}» · Se ve en: POS`, { exact: true })).toBeVisible();
      });

      await test.step('al recargar, el orden y lo oculto siguen', async () => {
        await duena.reload();
        const lista = duena.getByRole('list', { name: 'Secciones del menú, en orden' });
        await expect(lista.getByRole('button', { name: /^Subir / }).nth(1)).toHaveAccessibleName(
          `Subir ${primera}`,
        );
        await pulsar(duena.getByRole('button', { name: `Ver los platillos de ${segunda}` }));
        const platillos = duena.getByRole('list', { name: `Platillos de ${segunda}, en orden` });
        // Oculto sólo del portal: sigue en el POS (el mesero lo ve más abajo).
        await expect(platillos.getByText(/^Se ve en: POS$/)).toHaveCount(1);
        if (delPrimerPlatillo.length >= 2) {
          const hoy = await platillos
            .getByRole('button', { name: /^Bajar / })
            .evaluateAll((n) => n.map((b) => (b.getAttribute('aria-label') ?? '').slice(6)));
          expect(hoy).toEqual(delPrimerPlatillo);
        }
      });

      await test.step('el mesero ve las pestañas en ese orden, con color y con la franja en cada tarjeta', async () => {
        const mesera = await equipo.pagina(info, 'mesero');
        fallos.push(vigilarFallos(mesera, { sondeando: () => true }));
        await mesera.goto('/');
        await mesera.waitForURL(/\/mesero$/);
        await abrirLaMesa(mesera, duena, MESA, 2);
        const mesa = dialogoDeLaMesa(mesera, MESA);
        await yaAbierto(mesa);
        const pestanas = mesa.getByRole('group', { name: 'Categorías' }).getByRole('button');
        await expect(pestanas.nth(1)).toHaveText(segunda);
        await expect(pestanas.nth(2)).toHaveText(primera);
        // El color: la pestaña lleva su clave y la tarjeta su franja de 5 px.
        await expect(pestanas.nth(1)).toHaveAttribute('data-categoria-color', /^cat-\d+$/);
        const fondo = await pestanas.nth(1).evaluate((n) => getComputedStyle(n).backgroundColor);
        expect(fondo).not.toBe('rgba(0, 0, 0, 0)');
        await pulsar(pestanas.nth(1));
        const tarjeta = mesa.locator('[data-rejilla-de-platillos] [data-categoria-color]').first();
        await expect(tarjeta).toBeVisible();
        const franja = await tarjeta.evaluate((n) => getComputedStyle(n).borderLeftWidth);
        expect(franja).toBe('5px');
        if (delPrimerPlatillo.length >= 2) {
          const nombresDeTarjetas = await mesa
            .locator('[data-rejilla-de-platillos] button')
            .evaluateAll((n) => n.map((b) => b.querySelector('p')?.textContent ?? ''));
          expect(nombresDeTarjetas).toEqual(delPrimerPlatillo);
        }

        // La cerveza trae «Prepárala»: opcional, con sus precios.
        await pulsar(pestanas.nth(0));
        await pulsar(
          mesa.getByRole('button', { name: new RegExp(`^${CARTA.cerveza.nombre} \\$`) }),
        );
        const personalizar = mesera.getByRole('dialog', { name: 'Personalizar producto' });
        await expect(personalizar).toBeVisible();
        await expect(personalizar.getByText('Prepárala')).toBeVisible();
        await expect(personalizar.getByRole('button', { name: /Michelado/ })).toContainText('15');
        await expect(personalizar.getByRole('button', { name: /Cubano/ })).toContainText('20');
        await mesera.keyboard.press('Escape');
      });

      await test.step('la Caja («Para llevar») usa la misma rejilla: mismo orden, color y «Prepárala»', async () => {
        const rosa = await equipo.pagina(info, 'cajero');
        fallos.push(vigilarFallos(rosa, { sondeando: () => true }));
        await rosa.goto('/caja', { waitUntil: 'domcontentloaded' });
        if ((await sesionDeLaCaja(rosa)) === null) await abrirLaCaja(rosa, 150_000);
        await pulsar(rosa.getByRole('button', { name: /^Para llevar/ }));
        const dialogo = rosa.getByRole('dialog', { name: 'Pedido para llevar' });
        await yaAbierto(dialogo);
        const pestanas = dialogo.getByRole('group', { name: 'Categorías' }).getByRole('button');
        await expect(pestanas.nth(1)).toHaveText(segunda);
        await expect(pestanas.nth(2)).toHaveText(primera);
        await expect(pestanas.nth(1)).toHaveAttribute('data-categoria-color', /^cat-\d+$/);
        await pulsar(
          dialogo.getByRole('button', { name: new RegExp(`^${CARTA.cerveza.nombre} \\$`) }),
        );
        const personalizar = rosa.getByRole('dialog', { name: 'Personalizar producto' });
        await expect(personalizar.getByText('Prepárala')).toBeVisible();
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
