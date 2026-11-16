import { expect, test, type BrowserContext, type Page } from '@playwright/test';

import { abrirConReloj, pinDe, SLUG } from './ayudantes/modo-espera.ts';
import { opcionesDelProyecto, personaDe, type RolDePrueba } from './ayudantes/roles.ts';
import { cabecerasDeEscrituraDePrueba, entrar, exigirDemostracion } from './ayudantes/sesion.ts';

/**
 * DP-21 · Bloque 2 · ENTRAR CON PIN, Y LAS ESTACIONES QUE SE RECUERDAN (M14, O10 y A18).
 *
 * Lo que vio Miguel: reabría la app y el administrador entraba sin PIN. La regla, por puesto:
 *
 *   · dueño, administrador, gerente y cajero: SIEMPRE PIN al abrir la app. La cookie es de sesión
 *     (se va al cerrar el navegador) y una pantalla nueva arranca con el candado aunque la cookie
 *     siga viva;
 *   · mesero y cocina: entran directo a su pantalla mientras su sesión viva, y su cookie se
 *     recuerda (12 horas desde el último uso).
 *
 * «Cerrar y reabrir la app» es aquí una pestaña NUEVA del mismo navegador: la misma cookie, sin la
 * marca de esta ejecución. Los navegadores de esta prueba se abren a mano, sin el arnés que deja
 * esa marca (`conElPinTecleado`). Los vencimientos del servidor (30 minutos del mando, 12 horas
 * de las estaciones) los prueba `sesion-por-puesto.integracion.test.ts` con el reloj de la base;
 * aquí se prueba lo que hace la pantalla cuando el servidor ya no reconoce la sesión.
 */

const COOKIE_DE_SESION = 'morphiqpos_sesion';

async function navegadorCon(
  contexto: BrowserContext,
  rol: RolDePrueba,
): Promise<{ readonly pagina: Page; readonly pin: string }> {
  const persona = personaDe(SLUG, rol);
  const pagina = await contexto.newPage();
  await entrar(pagina, persona);
  return { pagina, pin: persona.pin };
}

async function cookieDeLaSesion(contexto: BrowserContext) {
  const cookie = (await contexto.cookies()).find((c) => c.name.startsWith(COOKIE_DE_SESION));
  expect(cookie, 'la sesión viaja en una cookie').toBeDefined();
  return cookie;
}

test.describe('el PIN al abrir la app (DP-21 · Bloque 2)', () => {
  test.use({ actionTimeout: 20_000, navigationTimeout: 30_000 });

  test.beforeAll(async ({ playwright }, info) => {
    await exigirDemostracion(playwright, info, SLUG);
  });

  for (const rol of ['dueno', 'gerente', 'cajero'] as const) {
    test(`${rol}: cierra y reabre la app, y le pide su PIN`, async ({ browser }, info) => {
      const contexto = await browser.newContext(opcionesDelProyecto(info));
      try {
        const { pagina, pin } = await navegadorCon(contexto, rol);
        // Entró tecleando su PIN: ESTA pantalla no se lo vuelve a pedir, tampoco al recargar.
        await expect(pinDe(pagina)).toHaveCount(0);
        await pagina.reload();
        await expect(pagina.getByRole('heading', { level: 1 }).first()).toBeVisible();
        await expect(pinDe(pagina)).toHaveCount(0);

        // La cookie es de sesión: cerrar el navegador la pierde. Y es HttpOnly: no se lee desde JS.
        const cookie = await cookieDeLaSesion(contexto);
        expect(cookie?.expires, 'cookie de sesión, sin fecha de caducidad').toBe(-1);
        expect(cookie?.httpOnly).toBe(true);
        expect(
          await pagina.evaluate(() => JSON.stringify(window.localStorage)),
          'la sesión nunca vive en localStorage',
        ).not.toContain(cookie?.value ?? 'sin-cookie');

        // Reabrir la app: otra pantalla con la MISMA cookie viva arranca con el candado.
        const reabierta = await contexto.newPage();
        await reabierta.goto('/');
        await expect(pinDe(reabierta)).toBeVisible();
        expect(
          (await contexto.request.get('/api/catalogo/sesion')).status(),
          'el servidor todavía reconoce la sesión: quien cierra es la pantalla',
        ).toBe(200);
        // Recargar no lo quita, ni Escape.
        await reabierta.reload();
        await expect(pinDe(reabierta)).toBeVisible();
        await reabierta.keyboard.press('Escape');
        await expect(pinDe(reabierta)).toBeVisible();

        // Con su PIN (que el servidor vuelve a comprobar) entra; y ya no se lo pide al recargar.
        const comprobado = reabierta.waitForResponse(
          (r) => new URL(r.url()).pathname === '/api/auth/entrar',
        );
        await reabierta.keyboard.type(pin);
        expect((await comprobado).status()).toBe(200);
        await expect(pinDe(reabierta)).toHaveCount(0);
        await reabierta.reload();
        await expect(reabierta.getByRole('heading', { level: 1 }).first()).toBeVisible();
        await expect(pinDe(reabierta)).toHaveCount(0);
      } finally {
        await contexto.close();
      }
    });
  }

  for (const [rol, ruta] of [
    ['mesero', /\/mesero$/],
    ['cocina', /\/cocina$/],
  ] as const) {
    test(`${rol}: cierra y reabre la app, y entra directo a su pantalla`, async ({
      browser,
    }, info) => {
      const contexto = await browser.newContext(opcionesDelProyecto(info));
      try {
        await navegadorCon(contexto, rol);
        // Su cookie SÍ se recuerda (no es «hasta cerrar»): vive hasta el tope de 7 días; las 12
        // horas desde el último uso las hace cumplir la fila de la sesión en el servidor.
        const cookie = await cookieDeLaSesion(contexto);
        const elTope = Date.now() / 1000 + 7 * 24 * 60 * 60;
        expect(cookie?.expires ?? 0).toBeGreaterThan(Date.now() / 1000 + 11 * 60 * 60);
        expect(cookie?.expires ?? 0).toBeLessThan(elTope + 10 * 60);
        expect(cookie?.httpOnly).toBe(true);

        const reabierta = await contexto.newPage();
        const sesion = reabierta.waitForResponse(
          (r) => new URL(r.url()).pathname === '/api/catalogo/sesion',
        );
        await reabierta.goto('/');
        expect((await sesion).status()).toBe(200);
        await reabierta.waitForURL(ruta);
        await expect(reabierta.getByRole('heading', { level: 1 }).first()).toBeVisible();
        await expect(pinDe(reabierta)).toHaveCount(0);
      } finally {
        await contexto.close();
      }
    });
  }

  test('sin tocar la pantalla 10 minutos, el mando se cierra con su PIN; la cajera, no', async ({
    browser,
  }, info) => {
    const deLaDuena = await browser.newContext(opcionesDelProyecto(info));
    const deLaCajera = await browser.newContext(opcionesDelProyecto(info));
    try {
      const duena = await navegadorCon(deLaDuena, 'dueno');
      const cajera = await navegadorCon(deLaCajera, 'cajero');
      // El reloj de la página, de mentira: la misma pestaña (con su marca) vuelve a cargar con él.
      await abrirConReloj(duena.pagina, '/configuracion');
      await abrirConReloj(cajera.pagina, '/caja');
      await expect(pinDe(duena.pagina)).toHaveCount(0);

      // A los 9 minutos todavía no; pasados los 10 (lo de omisión), sí.
      await duena.pagina.clock.fastForward('09:00');
      await expect(pinDe(duena.pagina)).toHaveCount(0);
      await duena.pagina.clock.fastForward('01:30');
      await expect(pinDe(duena.pagina)).toBeVisible();
      // Recargar no lo quita: la marca se borró.
      await duena.pagina.reload();
      await expect(pinDe(duena.pagina)).toBeVisible();

      // La cajera no tiene candado propio por falta de uso.
      await cajera.pagina.clock.fastForward('10:30');
      await expect(pinDe(cajera.pagina)).toHaveCount(0);
    } finally {
      await deLaDuena.close();
      await deLaCajera.close();
    }
  });

  test('con la sesión terminada en el servidor, el mesero vuelve a ver el PIN y sus peticiones reciben 401', async ({
    browser,
  }, info) => {
    const contexto = await browser.newContext(opcionesDelProyecto(info));
    try {
      const { pagina } = await navegadorCon(contexto, 'mesero');
      await pagina.waitForURL(/\/mesero$/);
      // La sesión se acaba EN EL SERVIDOR (lo mismo que cuando vence): la cookie sigue en el
      // navegador, pero ya no vale.
      const salida = await contexto.request.post('/api/auth/salir', {
        headers: cabecerasDeEscrituraDePrueba(),
        data: {},
      });
      expect(salida.status()).toBe(200);
      expect((await contexto.request.get('/api/catalogo/sesion')).status()).toBe(401);

      const reabierta = await contexto.newPage();
      await reabierta.goto('/');
      await reabierta.waitForURL(/login-pos|\/n\//);
      await expect(reabierta).not.toHaveURL(/\/mesero$/);
    } finally {
      await contexto.close();
    }
  });

  test('sin sesión, el servidor contesta 401 al mando y no enseña nada', async ({
    browser,
  }, info) => {
    const contexto = await browser.newContext(opcionesDelProyecto(info));
    try {
      expect((await contexto.request.get('/api/catalogo/sesion')).status()).toBe(401);
      const dato = await contexto.request.post('/api/caja/estado', {
        headers: cabecerasDeEscrituraDePrueba(),
        data: {},
      });
      expect(dato.status()).toBe(401);
    } finally {
      await contexto.close();
    }
  });
});
