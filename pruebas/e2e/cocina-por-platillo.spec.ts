import { randomInt } from 'node:crypto';

import { expect, test, type Locator, type Page } from '@playwright/test';

import {
  categoriaA,
  cocineroDe,
  crearEstacion,
  laEstacion,
  platilloDe,
} from './ayudantes/estaciones.ts';
import { dialogoDeLaMesa, laMesa, yaAbierto } from './ayudantes/mesas-heredadas.ts';
import { escribir } from './ayudantes/modo-espera.ts';
import { Equipo } from './ayudantes/roles.ts';
import {
  cabecerasDeEscrituraDePrueba,
  consultarPuente,
  exigirDemostracion,
  vigilarFallos,
} from './ayudantes/sesion.ts';

/**
 * DP-24 · 4.1–4.4 · LA COCINA POR PLATILLO, EL MESERO Y EL AVISO, CON EL DEDO.
 *
 * Dos estaciones (la nueva «Parrilla» y «Barra», que viene en la demo), cada una con su cocinero
 * en su navegador; la mesera abre la mesa y manda dos platillos de la Parrilla y uno de la Barra.
 *
 *   · cada Cocina ve sólo lo suyo; los platillos se mueven UNO por UNO y una misma mesa tiene
 *     platillos en dos columnas a la vez, cada uno bajo su bloque «Mesa N»;
 *   · el aviso grande («Mesa N · Listo en …: … · Recoger en …») llega SÓLO a la mesera de esa
 *     mesa —no a la dueña—, se apila, se quita tocando y no se pierde al recargar;
 *   · la nubecita del mapa dice «Parrilla 1/2» y «Barra ✓» (la Barra se ve antes de que termine
 *     la Parrilla);
 *   · la tarjeta de cada estación en la mesa cuenta «Listos 1 de 2» / «Entregados 1 de 2», y si
 *     luego sale otro platillo la MISMA tarjeta vuelve a ofrecer entregar.
 *
 * Todo con `tap()` (el proyecto «tablet» tiene pantalla táctil) y se comprueba en el SERVIDOR.
 */

const SLUG = 'prueba-restaurante';
const MESA = 3;
const N = String(randomInt(100, 1000));
const PARRILLA = `Parrilla ${N}`;

interface PlatilloLeido {
  readonly producto_nombre?: string | null;
  readonly estado?: string | null;
}
interface ComandaLeida {
  readonly estado: string;
  readonly estacion_preparacion_nombre?: string | null;
  readonly items?: readonly PlatilloLeido[];
}

async function comandasDe(lector: Page, ordenId: string): Promise<readonly ComandaLeida[]> {
  return consultarPuente<ComandaLeida>(lector, 'PedidoPreparacion', {
    filtro: { venta_id: ordenId },
    limite: 20,
  });
}

const estadoDe = (comandas: readonly ComandaLeida[], nombre: string): string | undefined =>
  comandas.flatMap((c) => c.items ?? []).find((i) => i.producto_nombre === nombre)?.estado ??
  undefined;

/** El bloque de la mesa dentro de una columna de la cocina. */
function bloqueEn(cocina: Page, columna: 'nuevo' | 'en_preparacion' | 'listo'): Locator {
  return cocina
    .locator(`section[aria-labelledby="columna-${columna}"] li[data-bloque]`)
    .filter({ hasText: new RegExp(`Mesa ${String(MESA)}(?!\\d)`) });
}

function renglon(bloque: Locator, nombre: string): Locator {
  return bloque.locator('ul > li').filter({ hasText: nombre }).first();
}

test.describe('la cocina por platillo (DP-24)', () => {
  test.use({ actionTimeout: 20_000, navigationTimeout: 30_000 });

  test.beforeAll(async ({ playwright }, info) => {
    await exigirDemostracion(playwright, info, SLUG);
  });

  test('platillo por platillo, aviso grande sólo para la mesera y nubecitas en el mapa', async ({
    browser,
  }, info) => {
    test.setTimeout(8 * 60_000);
    const equipo = new Equipo(browser, SLUG);
    const aCerrar: (() => Promise<void>)[] = [];
    try {
      const duena = await equipo.pagina(info, 'dueno');
      const sinFallos = vigilarFallos(duena);
      const reseteo = await duena.request.post('/api/pruebas/resetear', {
        headers: cabecerasDeEscrituraDePrueba(),
        data: { confirmacion: 'RESETEAR' },
      });
      expect(reseteo.status(), `resetear: ${await reseteo.text()}`).toBe(200);
      await escribir(duena, '/api/datos/escribir', {
        entidad: 'ConfiguracionNegocio',
        operacion: 'update',
        datos: { estaciones_preparacion_activas: true },
      });
      await duena.goto('/configuracion?seccion=cocina');
      await crearEstacion(duena, PARRILLA);
      const parrilla = await laEstacion(duena, PARRILLA);
      const barra = await laEstacion(duena, 'Barra');
      await categoriaA(duena, 'Platos fuertes', parrilla);
      await categoriaA(duena, 'Entradas', parrilla);
      await categoriaA(duena, 'Bebidas', barra);
      const fuerte = (await platilloDe(duena, 'Platos fuertes')).nombre;
      const entrada = (await platilloDe(duena, 'Entradas')).nombre;
      const bebida = (await platilloDe(duena, 'Bebidas')).nombre;

      const deParrilla = await cocineroDe(browser, info, duena, SLUG, parrilla);
      const deBarra = await cocineroDe(browser, info, duena, SLUG, barra);
      aCerrar.push(
        () => deParrilla.pagina.context().close(),
        () => deBarra.pagina.context().close(),
      );

      const lupita = await equipo.pagina(info, 'mesero');
      await lupita.goto('/mesero');
      await expect(laMesa(lupita, MESA)).toBeVisible({ timeout: 30_000 });

      // La mesera abre la mesa con SU sesión (queda como quien la atiende) y manda el pedido.
      const [mesa] = await consultarPuente<{ id: string }>(duena, 'Mesa', {
        filtro: { numero: MESA },
        limite: 1,
      });
      const apertura = await lupita.request.post('/api/restaurante/abrir-mesa', {
        headers: cabecerasDeEscrituraDePrueba(),
        data: { mesaId: mesa?.id, personas: 2 },
      });
      expect(apertura.status(), await apertura.text()).toBe(200);
      const ordenId = String(
        ((await apertura.json()) as { datos?: { ordenId?: string } }).datos?.ordenId,
      );
      const idDe = async (categoria: string) => (await platilloDe(duena, categoria)).id;
      const envio = await lupita.request.post('/api/restaurante/enviar-pedido', {
        headers: cabecerasDeEscrituraDePrueba(),
        data: {
          ordenId,
          lineas: [
            { productoId: await idDe('Platos fuertes'), cantidad: '1' },
            { productoId: await idDe('Entradas'), cantidad: '1' },
            { productoId: await idDe('Bebidas'), cantidad: '1' },
          ],
        },
      });
      expect(envio.status(), await envio.text()).toBe(200);

      await test.step('cada cocina ve sólo lo suyo, y la voz anuncia su pedido', async () => {
        await expect(bloqueEn(deParrilla.pagina, 'nuevo')).toHaveCount(1, { timeout: 30_000 });
        await expect(renglon(bloqueEn(deParrilla.pagina, 'nuevo'), fuerte)).toBeVisible();
        await expect(renglon(bloqueEn(deParrilla.pagina, 'nuevo'), entrada)).toBeVisible();
        await expect(deParrilla.pagina.getByText(bebida)).toHaveCount(0);
        await expect(bloqueEn(deBarra.pagina, 'nuevo')).toHaveCount(1, { timeout: 30_000 });
        await expect(renglon(bloqueEn(deBarra.pagina, 'nuevo'), bebida)).toBeVisible();
        await expect(deBarra.pagina.getByText(fuerte)).toHaveCount(0);
        await expect
          .poll(async () => (await deParrilla.dicho()).join(' | '), {
            message: 'La Parrilla no anunció su pedido (la voz de cocina sigue funcionando).',
          })
          .toContain(fuerte);
      });

      await test.step('un platillo a la vez: la misma mesa en dos columnas', async () => {
        const nuevos = bloqueEn(deParrilla.pagina, 'nuevo');
        await renglon(nuevos, fuerte).getByRole('button', { name: 'Preparar', exact: true }).tap();
        const preparando = bloqueEn(deParrilla.pagina, 'en_preparacion');
        await expect(renglon(preparando, fuerte)).toBeVisible({ timeout: 15_000 });
        // El otro platillo sigue en «Nuevos», bajo SU bloque de la misma mesa.
        await expect(renglon(bloqueEn(deParrilla.pagina, 'nuevo'), entrada)).toBeVisible();
        await expect
          .poll(async () => estadoDe(await comandasDe(duena, ordenId), fuerte))
          .toBe('en_preparacion');
        expect(estadoDe(await comandasDe(duena, ordenId), entrada)).toBe('pendiente');
      });

      await test.step('lo que sale se avisa SÓLO a la mesera, grande y con la nubecita', async () => {
        await renglon(bloqueEn(deParrilla.pagina, 'en_preparacion'), fuerte)
          .getByRole('button', { name: 'Listo', exact: true })
          .tap();
        const aviso = lupita.locator('[data-aviso]');
        await expect(aviso).toHaveCount(1, { timeout: 20_000 });
        await expect(aviso).toContainText(`Mesa ${String(MESA)} · Listo en ${PARRILLA}`);
        await expect(aviso).toContainText(`Recoger en ${PARRILLA}`);
        await expect(aviso).toContainText(fuerte);
        await expect(lupita.locator(`[data-nube="${PARRILLA} 1/2"]`)).toBeVisible({
          timeout: 20_000,
        });
        // La dueña NO recibe el aviso.
        await duena.goto('/');
        await expect(duena.locator('[data-aviso]')).toHaveCount(0);

        // Terminó primero la Barra: su nubecita se ve ANTES de que termine la Parrilla.
        const delBarra = bloqueEn(deBarra.pagina, 'nuevo');
        await renglon(delBarra, bebida)
          .getByRole('button', { name: 'Preparar', exact: true })
          .tap();
        await renglon(bloqueEn(deBarra.pagina, 'en_preparacion'), bebida)
          .getByRole('button', { name: 'Listo', exact: true })
          .tap();
        await expect(lupita.locator('[data-aviso]')).toHaveCount(2, { timeout: 20_000 });
        await expect(lupita.locator('[data-nube="Barra ✓"]')).toBeVisible({ timeout: 20_000 });
        // Las dos estaciones, cada una con su aviso, y la Parrilla aún sin terminar.
        await expect(lupita.locator('[data-aviso]').nth(1)).toContainText('Recoger en Barra');
      });

      await test.step('el aviso se quita tocando y los demás no se pierden al recargar', async () => {
        await lupita
          .locator(`[data-aviso][data-estacion="Barra"]`)
          .getByRole('button', { name: 'Entendido', exact: true })
          .tap();
        await expect(lupita.locator('[data-aviso]')).toHaveCount(1);
        await lupita.reload();
        await expect(lupita.locator('[data-aviso]')).toHaveCount(1, { timeout: 20_000 });
        await expect(lupita.locator('[data-aviso]')).toContainText(PARRILLA);
        // Se atiende: «Entendido» lo quita y la pantalla queda libre para tocar la mesa.
        await lupita
          .locator('[data-aviso]')
          .getByRole('button', { name: 'Entendido', exact: true })
          .tap();
        await expect(lupita.locator('[data-aviso]')).toHaveCount(0);
      });

      await test.step('la tarjeta de la estación cuenta, y entrega sólo lo listo', async () => {
        await laMesa(lupita, MESA).tap();
        const dialogo = dialogoDeLaMesa(lupita, MESA);
        await yaAbierto(dialogo);
        const tarjeta = dialogo.locator(`[data-estacion="${PARRILLA}"]`);
        await expect(tarjeta).toContainText('Listos 1 de 2');
        await expect(tarjeta).toContainText('Entregados 0 de 2');
        await tarjeta.getByRole('button', { name: 'Marcar entregado' }).tap();
        await expect(tarjeta).toContainText('Entregados 1 de 2', { timeout: 20_000 });
        await expect
          .poll(async () => estadoDe(await comandasDe(duena, ordenId), fuerte))
          .toBe('entregado');
        expect(estadoDe(await comandasDe(duena, ordenId), entrada)).toBe('pendiente');

        // Sale el otro platillo (el bloque entero, con un toque): la MISMA tarjeta lo ofrece.
        const nuevos = bloqueEn(deParrilla.pagina, 'nuevo');
        await renglon(nuevos, entrada).getByRole('button', { name: 'Preparar', exact: true }).tap();
        await renglon(bloqueEn(deParrilla.pagina, 'en_preparacion'), entrada)
          .getByRole('button', { name: 'Listo', exact: true })
          .tap();
        await expect(tarjeta.getByRole('button', { name: 'Marcar entregado' })).toBeVisible({
          timeout: 20_000,
        });
        await expect(dialogo.locator(`[data-estacion="${PARRILLA}"]`)).toHaveCount(1);
        await tarjeta.getByRole('button', { name: 'Marcar entregado' }).tap();
        await expect
          .poll(async () => estadoDe(await comandasDe(duena, ordenId), entrada))
          .toBe('entregado');
      });

      await test.step('lo que falta en la Barra sigue ahí hasta que se entrega', async () => {
        await expect
          .poll(async () => estadoDe(await comandasDe(duena, ordenId), bebida))
          .toBe('listo');
      });

      await escribir(duena, '/api/datos/escribir', {
        entidad: 'EstacionPreparacion',
        operacion: 'update',
        id: parrilla.id,
        datos: { activo: false },
      });
      sinFallos();
    } finally {
      for (const cerrar of aCerrar) await cerrar();
      await equipo.cerrar();
    }
  });
});
