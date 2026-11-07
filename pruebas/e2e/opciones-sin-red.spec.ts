import { expect, test, type Page, type Route } from '@playwright/test';

import {
  abrirLaMesa,
  armarElPedido,
  botonDeLaMesa,
  CARTA,
  comandasDeLaCuenta,
  dialogoDeLaMesa,
  laMesa,
  unidadesEsperadas,
  unidadesPorPlatillo,
  yaAbierto,
} from './ayudantes/mesas-heredadas.ts';
import { Equipo } from './ayudantes/roles.ts';
import {
  cabecerasDeEscrituraDePrueba,
  exigirDemostracion,
  consultarPuente,
  vigilarFallos,
} from './ayudantes/sesion.ts';

/**
 * DP-14.1-4 · SI FALLA LA LECTURA DE OPCIONES, EL MESERO SIGUE AGREGANDO LO QUE NO LAS PIDE.
 *
 * Sólo se corta (aborta o deja colgada) `/api/restaurante/opciones-de-los-platillos`; todo lo
 * demás de la red funciona.
 *   · Mesero con la última lectura buena en el navegador: lo que no pide opciones se agrega al
 *     instante y se envía; la cerveza (opción obligatoria) sigue pidiéndola.
 *   · Mesero sin lectura previa (arranque en frío) con la lectura colgada: pasados los 8 s dice
 *     que no pudo leer las opciones y ofrece «Reintentar»; al volver la red, se agrega con su
 *     opción obligatoria, y se envía.
 *   · Productos: el botón «Opciones» enseña el error y reintenta, en lugar de «Cargando…».
 */

const SLUG = 'prueba-restaurante';
const MESA = 6;
const OPCION = { grupo: 'Temperatura', nombre: 'Bien fría' };
const RUTA = '**/api/restaurante/opciones-de-los-platillos';
const LLAVE = 'morphiqpos:opciones_de_los_platillos:v1';

async function cortarAbortando(page: Page): Promise<void> {
  await page.route(RUTA, (route: Route) => route.abort('connectionreset'));
}

async function dejarColgada(page: Page): Promise<void> {
  // Nunca contesta: la lectura sólo termina por su tiempo límite.
  await page.route(RUTA, () => undefined);
}

test.describe('las opciones de los platillos sin red a medias', () => {
  test.use({ actionTimeout: 20_000, navigationTimeout: 30_000 });

  test.beforeAll(async ({ playwright }, info) => {
    await exigirDemostracion(playwright, info, SLUG);
  });

  test('el mesero: lo sin opciones se agrega y se envía; lo que las pide ofrece Reintentar', async ({
    browser,
  }, info) => {
    test.setTimeout(8 * 60_000);
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
      const [cerveza] = await consultarPuente<{ id: string }>(duena, 'ProductoTerminado', {
        filtro: { nombre: CARTA.cerveza.nombre },
        limite: 1,
      });
      expect(cerveza, 'La siembra no trae la cerveza clara.').toBeDefined();
      const grupos = await duena.request.post('/api/catalogo/modificadores', {
        headers: cabecerasDeEscrituraDePrueba(),
        data: {
          productoId: cerveza?.id,
          grupos: [
            { nombre: OPCION.grupo, obligatorio: true, opciones: [{ nombre: OPCION.nombre }] },
          ],
        },
      });
      expect(grupos.ok(), `modificadores: ${await grupos.text()}`).toBe(true);

      const mesera = await equipo.pagina(info, 'mesero');
      fallos.push(vigilarFallos(mesera, { sondeando: () => true }));
      await mesera.goto('/');
      await mesera.waitForURL(/\/mesero$/);
      const { ordenId } = await abrirLaMesa(mesera, duena, MESA, 2);

      await test.step('con la lectura ya guardada y la red cortada: el guacamole se agrega y se envía', async () => {
        await expect
          .poll(() => mesera.evaluate((k) => localStorage.getItem(k) !== null, LLAVE), {
            message: 'La lectura de las opciones no se guardó en el navegador.',
          })
          .toBe(true);
        await cortarAbortando(mesera);
        await mesera.reload();
        await mesera.waitForURL(/\/mesero$/);
        await laMesa(mesera, MESA).click();
        await yaAbierto(dialogoDeLaMesa(mesera, MESA));
        await armarElPedido(mesera, MESA, [{ nombre: CARTA.guacamole.nombre, veces: 1 }]);
        const enviar = await botonDeLaMesa(mesera, MESA, 'Enviar a Cocina');
        const enviado = mesera.waitForResponse(
          (r) =>
            new URL(r.url()).pathname === '/api/restaurante/enviar-pedido' &&
            r.request().method() === 'POST',
        );
        await enviar.click();
        expect((await enviado).status(), 'El servidor rechazó el guacamole.').toBe(200);
        await expect
          .poll(async () => unidadesPorPlatillo(await comandasDeLaCuenta(duena, ordenId)), {
            message: 'El guacamole no llegó a la cuenta con la lectura de opciones cortada.',
          })
          .toEqual(unidadesEsperadas([{ nombre: CARTA.guacamole.nombre, veces: 1 }]));
        await mesera.unroute(RUTA);
      });

      await test.step('en frío y con la lectura colgada: la cerveza dice que no pudo leer y reintenta', async () => {
        await mesera.evaluate((k) => {
          localStorage.removeItem(k);
        }, LLAVE);
        await dejarColgada(mesera);
        await mesera.reload();
        await mesera.waitForURL(/\/mesero$/);
        await laMesa(mesera, MESA).click();
        await yaAbierto(dialogoDeLaMesa(mesera, MESA));
        await dialogoDeLaMesa(mesera, MESA)
          .getByRole('button', { name: new RegExp(`^${CARTA.cerveza.nombre} \\$`) })
          .click();
        const aviso = mesera.getByRole('dialog', { name: 'No se pudieron leer las opciones' });
        // El tiempo límite es de 8 s.
        await expect(aviso, 'No avisó que la lectura de opciones falló.').toBeVisible({
          timeout: 15_000,
        });
        // Vuelve la red: Reintentar lee, y abre las opciones de la cerveza.
        await mesera.unroute(RUTA);
        await aviso.getByRole('button', { name: 'Reintentar' }).click();
        const personalizar = mesera.getByRole('dialog', { name: 'Personalizar producto' });
        await expect(personalizar, 'Reintentar no abrió las opciones de la cerveza.').toBeVisible();
        await personalizar.getByRole('button', { name: 'Agregar al pedido' }).click();
        await expect(
          personalizar.getByText(`Selecciona una opción en: ${OPCION.grupo}`),
        ).toBeVisible();
        await personalizar.getByRole('button', { name: OPCION.nombre }).click();
        await personalizar.getByRole('button', { name: 'Agregar al pedido' }).click();
        await expect(personalizar).toHaveCount(0);

        const enviar = await botonDeLaMesa(mesera, MESA, 'Enviar a Cocina');
        const enviado = mesera.waitForResponse(
          (r) =>
            new URL(r.url()).pathname === '/api/restaurante/enviar-pedido' &&
            r.request().method() === 'POST',
        );
        await enviar.click();
        expect((await enviado).status(), 'El servidor rechazó la cerveza.').toBe(200);
        await expect
          .poll(async () => unidadesPorPlatillo(await comandasDeLaCuenta(duena, ordenId)), {
            message: 'La cerveza no llegó a la cuenta tras reintentar.',
          })
          .toEqual(
            unidadesEsperadas([
              { nombre: CARTA.guacamole.nombre, veces: 1 },
              { nombre: CARTA.cerveza.nombre, veces: 1 },
            ]),
          );
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

  test('Productos: «Opciones» enseña el error y reintenta, no se queda en «Cargando…»', async ({
    browser,
  }, info) => {
    test.setTimeout(4 * 60_000);
    const equipo = new Equipo(browser, SLUG);
    try {
      const duena = await equipo.pagina(info, 'dueno');
      await cortarAbortando(duena);
      await duena.goto('/productos');
      const boton = duena.locator('button[data-estado-opciones]').first();
      await expect(boton, 'El botón «Opciones» no enseñó el error de la lectura.').toHaveAttribute(
        'data-estado-opciones',
        'error',
        { timeout: 30_000 },
      );
      await expect(boton).toContainText('Reintentar opciones');

      await duena.unroute(RUTA);
      await boton.click();
      await expect(boton, 'Reintentar no recuperó las opciones.').toHaveAttribute(
        'data-estado-opciones',
        'listas',
        { timeout: 30_000 },
      );
      await expect(boton).toContainText('Opciones');
      await expect(boton).not.toContainText('Reintentar');
    } finally {
      await equipo.cerrar();
    }
  });
});
