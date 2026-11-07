import { expect, test, type Page } from '@playwright/test';

import { sesionDeLaCaja } from './ayudantes/conciliacion.ts';
import { abrirLaCaja, CARTA, lineasDeLaCuenta } from './ayudantes/mesas-heredadas.ts';
import { Equipo } from './ayudantes/roles.ts';
import {
  cabecerasDeEscrituraDePrueba,
  consultarPuente,
  exigirDemostracion,
  vigilarFallos,
} from './ayudantes/sesion.ts';

/**
 * DP-14.6-3 · /POS TAMBIÉN PIDE LAS OPCIONES OBLIGATORIAS.
 *
 * Antes el mostrador mandaba la cerveza sin su temperatura: `venta.agregar_linea` no miraba las
 * opciones y el cajero, además, no las leía en la cuenta. Ahora el platillo con un grupo
 * obligatorio abre el diálogo de opciones (como el del mesero); sin elegir no entra; con la
 * elección entra y el cajero la lee en la línea. Y el servidor no depende de la pantalla: la
 * llamada al comando sin la elección se rechaza con `OPCION_OBLIGATORIA` y no escribe nada.
 *
 * La cerveza se vuelve «con opción obligatoria» en la propia prueba, como en
 * `restaurante-menu-personalizado.spec.ts`. Corre en serie (`--workers=1`): resetea la demo.
 */

const SLUG = 'prueba-restaurante';
const GRUPO = 'Temperatura';
const OPCION = 'Bien fría';
const FONDO_CENTAVOS = 150_000;
/** Un id que ningún grupo del platillo puede tener. */
const GRUPO_AJENO = '00000000-0000-4000-8000-000000000001';

interface Sobre {
  readonly ok?: boolean;
  readonly error?: {
    readonly codigo?: string;
    readonly datos?: { readonly regla?: string };
  };
  readonly datos?: { readonly ordenId?: string };
}

async function comando(page: Page, ruta: string, datos: Record<string, unknown>) {
  const respuesta = await page.request.post(ruta, {
    headers: cabecerasDeEscrituraDePrueba(),
    data: datos,
    timeout: 120_000,
  });
  const cuerpo = (await respuesta.json().catch(() => ({}))) as Sobre;
  return { estado: respuesta.status(), cuerpo };
}

/** La cerveza clara pasa a pedir su temperatura. Devuelve su id. */
async function cervezaConOpcionObligatoria(duena: Page): Promise<string> {
  const [cerveza] = await consultarPuente<{ id: string }>(duena, 'ProductoTerminado', {
    filtro: { nombre: CARTA.cerveza.nombre },
    limite: 1,
  });
  expect(cerveza, 'La siembra no trae la cerveza clara.').toBeDefined();
  const id = cerveza?.id ?? '';
  const { estado, cuerpo } = await comando(duena, '/api/catalogo/modificadores', {
    productoId: id,
    grupos: [{ nombre: GRUPO, obligatorio: true, opciones: [{ nombre: OPCION }] }],
  });
  expect(estado, `modificadores: ${JSON.stringify(cuerpo)}`).toBe(200);
  return id;
}

/** La orden del cajero: en una pantalla chica el carrito está tras «Ver orden». */
async function ordenDelCajero(page: Page) {
  const ver = page.getByRole('button', { name: /^Ver orden \(/ });
  if (await ver.isVisible()) {
    await expect(ver).toBeEnabled();
    await ver.click();
  }
  return page
    .getByRole('heading', { name: 'Orden', exact: true })
    .locator('xpath=ancestor::div[3]');
}

test.describe('/pos pide las opciones obligatorias (DP-14.6-3)', () => {
  test.use({ actionTimeout: 20_000, navigationTimeout: 30_000 });

  test.beforeAll(async ({ playwright }, info) => {
    await exigirDemostracion(playwright, info, SLUG);
  });

  test('el platillo con opción obligatoria abre el diálogo; sin elegir no entra; con la elección el cajero la lee', async ({
    browser,
  }, info) => {
    test.setTimeout(8 * 60_000);
    const duena = await new Equipo(browser, SLUG).pagina(info, 'dueno');
    const fallos = vigilarFallos(duena);
    const reseteo = await comando(duena, '/api/pruebas/resetear', { confirmacion: 'RESETEAR' });
    expect(reseteo.estado, 'No se pudo resetear la demo.').toBe(200);
    const productoId = await cervezaConOpcionObligatoria(duena);

    await test.step('el mostrador de esta terminal tiene caja abierta', async () => {
      await duena.goto('/caja');
      if ((await sesionDeLaCaja(duena)) === null) await abrirLaCaja(duena, FONDO_CENTAVOS);
    });

    let ordenId = '';
    await test.step('por la API: la cerveza sin su opción se rechaza con OPCION_OBLIGATORIA y no escribe nada', async () => {
      const orden = await comando(duena, '/api/venta/crear-orden', {});
      expect(orden.estado, 'crear-orden').toBe(200);
      ordenId = orden.cuerpo.datos?.ordenId ?? '';
      expect(ordenId, 'crear-orden no devolvió la orden.').not.toBe('');

      const sinOpcion = await comando(duena, '/api/venta/agregar-linea', {
        ordenId,
        productoId,
        cantidad: '1',
      });
      expect(sinOpcion.estado, 'La cerveza sin su temperatura entró.').toBeGreaterThanOrEqual(400);
      expect(sinOpcion.estado).toBeLessThan(500);
      expect(sinOpcion.cuerpo.error?.datos?.regla, JSON.stringify(sinOpcion.cuerpo)).toBe(
        'OPCION_OBLIGATORIA',
      );

      const ajena = await comando(duena, '/api/venta/agregar-linea', {
        ordenId,
        productoId,
        cantidad: '1',
        opciones: [{ grupoId: GRUPO_AJENO, opcionIds: [GRUPO_AJENO] }],
      });
      expect(ajena.cuerpo.error?.datos?.regla, JSON.stringify(ajena.cuerpo)).toBe(
        'OPCION_NO_VALIDA',
      );

      expect(
        await lineasDeLaCuenta(duena, ordenId),
        'Un rechazo del servidor dejó una línea escrita.',
      ).toHaveLength(0);
    });

    await test.step('en /pos: el diálogo se abre; sin elegir, no se agrega', async () => {
      await duena.goto('/pos');
      await duena.getByPlaceholder('Buscar producto...').fill('Cerveza clara');
      await duena.getByText(CARTA.cerveza.nombre, { exact: true }).first().click();
      const dialogo = duena.getByRole('dialog', { name: 'Personalizar producto' });
      await expect(dialogo).toBeVisible();
      await expect(dialogo.getByText(GRUPO)).toBeVisible();

      await dialogo.getByRole('button', { name: 'Agregar al pedido' }).click();
      await expect(dialogo.getByText(`Selecciona una opción en: ${GRUPO}`)).toBeVisible();
      await expect(dialogo, 'El diálogo se cerró sin elección.').toBeVisible();
      expect(
        await lineasDeLaCuenta(duena, ordenId),
        'Sin elegir, el platillo entró a la cuenta.',
      ).toHaveLength(0);
    });

    await test.step('con la elección la línea queda en la cuenta, y el cajero la lee', async () => {
      const dialogo = duena.getByRole('dialog', { name: 'Personalizar producto' });
      await dialogo.getByRole('button', { name: OPCION, exact: true }).click();
      const agregada = duena.waitForResponse(
        (r) =>
          new URL(r.url()).pathname === '/api/venta/agregar-linea' &&
          r.request().method() === 'POST',
      );
      await dialogo.getByRole('button', { name: 'Agregar al pedido' }).click();
      expect((await agregada).status(), 'El servidor rechazó la línea con su opción.').toBe(200);
      await expect(dialogo).toHaveCount(0);

      await expect
        .poll(async () => (await lineasDeLaCuenta(duena, ordenId)).map((l) => l.nombre), {
          message: 'La línea con su opción no llegó a la cuenta.',
        })
        .toEqual([CARTA.cerveza.nombre]);
      const orden = await ordenDelCajero(duena);
      await expect(orden.getByText(CARTA.cerveza.nombre)).toBeVisible();
      await expect(
        orden.getByText(`${GRUPO}: ${OPCION}`),
        'El cajero no lee la opción en la cuenta.',
      ).toBeVisible();
    });

    fallos();
  });
});
