import { randomInt } from 'node:crypto';

import { devices, expect, type Page, test } from '@playwright/test';

import {
  categoriaA,
  cocineroDe,
  crearEstacion,
  desactivarEstacion,
  estaciones,
  laEstacion,
  platilloDe,
  renombrarEstacion,
  type Cocinero,
} from './ayudantes/estaciones.ts';
import {
  abrirElQrDeLaMesa,
  prepararElPortalDelComensal,
  type TelefonoDelComensal,
} from './ayudantes/mesas-heredadas.ts';
import { escribir } from './ayudantes/modo-espera.ts';
import { enviarElPedidoDeLaMesa } from './ayudantes/pedido-de-la-mesa.ts';
import { Equipo } from './ayudantes/roles.ts';
import {
  cabecerasDeEscrituraDePrueba,
  consultarPuente,
  exigirDemostracion,
  vigilarFallos,
} from './ayudantes/sesion.ts';

/**
 * DP-12.5 · LAS ESTACIONES DE PUNTA A PUNTA, con más de dos: Don Poncho tendrá varias, todavía
 * sin nombre, y nada debe suponer «Cocina y Bebidas».
 *
 * En Configuración → Negocio se crean Parrilla, Fríos, Dulce y Temporal; Dulce pasa a «Postres» y
 * Temporal se desactiva (su categoría vuelve a la general). Cada estación recibe su categoría y su
 * cocinero. Un pedido del mesero con un platillo de cada una sale en una comanda POR estación;
 * cada pantalla de Cocina ve y ANUNCIA sólo lo suyo (la dueña, todo); cada estación conecta sólo
 * su teléfono, que ve lo suyo; y el pedido del comensal desde el portal también se parte. Todo se
 * comprueba en el SERVIDOR. Por platillo no se asigna: el modelo la toma de la categoría.
 */

const SLUG = 'prueba-restaurante';
const MESA = 6;
const MESA_DEL_PORTAL = 7;
/**
 * El reseteo de la demo no borra las estaciones que crea una prueba (sólo se desactivan): cada
 * corrida usa nombres propios y al final apaga las suyas.
 */
const N = String(randomInt(100, 1000));
const NOMBRE = {
  parrilla: `Parrilla ${N}`,
  frios: `Fríos ${N}`,
  dulce: `Dulce ${N}`,
  postres: `Postres ${N}`,
  temporal: `Temporal ${N}`,
};

/** Las estaciones de las comandas de una cuenta, como las guardó el servidor. */
async function estacionesDeLaCuenta(lector: Page, ventaId: string): Promise<readonly string[]> {
  const comandas = await consultarPuente<{ estacion_preparacion_nombre?: string | null }>(
    lector,
    'PedidoPreparacion',
    { filtro: { venta_id: ventaId }, limite: 50 },
  );
  return comandas.map((c) => c.estacion_preparacion_nombre ?? '(sin estación)').sort();
}

async function agregar(telefono: Page, nombre: string): Promise<void> {
  await telefono
    .locator('button.menu-tarjeta')
    .filter({ has: telefono.getByText(nombre, { exact: true }) })
    .click();
  await telefono.getByRole('button', { name: /^Agregar/ }).click();
  await expect(telefono.getByText(`${nombre} agregado al pedido de la mesa`)).toBeVisible();
}

test.describe('las estaciones de punta a punta (DP-12.5)', () => {
  test.use({ actionTimeout: 20_000, navigationTimeout: 30_000 });

  test.beforeAll(async ({ playwright }, info) => {
    await exigirDemostracion(playwright, info, SLUG);
  });

  test('crear, renombrar y desactivar; cada estación ve, anuncia y conecta lo suyo; mesero y portal parten la comanda', async ({
    browser,
  }, info) => {
    test.setTimeout(10 * 60_000);
    const equipo = new Equipo(browser, SLUG);
    const cocineros: Cocinero[] = [];
    const telefonos: TelefonoDelComensal[] = [];
    const telefonoDeCocina = await browser.newContext({
      ...devices['Pixel 7'],
      ...(info.project.use.baseURL === undefined ? {} : { baseURL: info.project.use.baseURL }),
      locale: 'es-MX',
    });
    try {
      const duena = await equipo.pagina(info, 'dueno');
      const sinFallos = vigilarFallos(duena);
      const reseteo = await duena.request.post('/api/pruebas/resetear', {
        headers: cabecerasDeEscrituraDePrueba(),
        data: { confirmacion: 'RESETEAR' },
      });
      expect(reseteo.status(), `resetear_demo: ${await reseteo.text()}`).toBe(200);
      const token = await prepararElPortalDelComensal(duena, {
        mesa: MESA_DEL_PORTAL,
        zona: 'Terraza',
        mesero: null,
        pedidosDelComensal: true,
      });
      await escribir(duena, '/api/datos/escribir', {
        entidad: 'ConfiguracionNegocio',
        operacion: 'update',
        datos: { estaciones_preparacion_activas: true },
      });

      await test.step('en Configuración se crean cuatro estaciones y «Dulce» pasa a «Postres»', async () => {
        await duena.goto('/configuracion?tab=negocio');
        for (const nombre of [NOMBRE.parrilla, NOMBRE.frios, NOMBRE.dulce, NOMBRE.temporal]) {
          await crearEstacion(duena, nombre);
        }
        await renombrarEstacion(duena, NOMBRE.dulce, NOMBRE.postres);
        const nombres = (await estaciones(duena)).map((e) => e.nombre);
        expect(nombres).toEqual(
          expect.arrayContaining([NOMBRE.parrilla, NOMBRE.frios, NOMBRE.postres, NOMBRE.temporal]),
        );
        expect(nombres).not.toContain(NOMBRE.dulce);
      });

      const general = (await estaciones(duena)).find((e) => e.es_general === true);
      if (general === undefined) throw new Error('El negocio no tiene estación general.');

      await test.step('Temporal se desactiva y su categoría vuelve a la general', async () => {
        await categoriaA(duena, 'Tacos', await laEstacion(duena, NOMBRE.temporal));
        await duena.reload();
        await desactivarEstacion(duena, NOMBRE.temporal);
        // La pregunta se cierra al tocar «Sí, desactivar»; el servidor contesta después.
        await expect
          .poll(async () => (await laEstacion(duena, NOMBRE.temporal)).activo, {
            message: 'La estación no quedó apagada.',
          })
          .toBe(false);
        const tacos = async () =>
          (
            await consultarPuente<{ nombre: string; estacion_preparacion_id?: string | null }>(
              duena,
              'CategoriaProducto',
              { limite: 50 },
            )
          ).find((c) => c.nombre === 'Tacos')?.estacion_preparacion_id;
        await expect
          .poll(tacos, { message: 'Tacos se quedó en la estación apagada.' })
          .toBe(general.id);
      });

      const [parrilla, frios, postres] = [
        await laEstacion(duena, NOMBRE.parrilla),
        await laEstacion(duena, NOMBRE.frios),
        await laEstacion(duena, NOMBRE.postres),
      ];
      // La Barra viene en la demo; sus bebidas, sin estación (caen en la general): se le mandan.
      await categoriaA(duena, 'Bebidas', await laEstacion(duena, 'Barra'));
      await categoriaA(duena, 'Platos fuertes', parrilla);
      await categoriaA(duena, 'Entradas', frios);
      await categoriaA(duena, 'Postres', postres);
      const platillo = {
        parrilla: (await platilloDe(duena, 'Platos fuertes')).nombre,
        frios: (await platilloDe(duena, 'Entradas')).nombre,
        postres: (await platilloDe(duena, 'Postres')).nombre,
      };
      const deParrilla = await cocineroDe(browser, info, duena, SLUG, parrilla);
      const deFrios = await cocineroDe(browser, info, duena, SLUG, frios);
      const dePostres = await cocineroDe(browser, info, duena, SLUG, postres);
      cocineros.push(deParrilla, deFrios, dePostres);
      for (const c of cocineros) await expect(c.pagina).toHaveURL(/\/cocina$/);

      let ordenId = '';
      await test.step('el mesero manda uno de cada estación: sale una comanda por estación', async () => {
        const [mesa] = await consultarPuente<{ id: string }>(duena, 'Mesa', {
          filtro: { numero: MESA },
          limite: 1,
        });
        const apertura = await escribir(duena, '/api/restaurante/abrir-mesa', {
          mesaId: mesa?.id,
          personas: 4,
        });
        ordenId = String(apertura.datos?.['ordenId']);
        const lineas = [];
        for (const categoria of ['Platos fuertes', 'Entradas', 'Postres', 'Tacos', 'Bebidas']) {
          lineas.push({ productoId: (await platilloDe(duena, categoria)).id, cantidad: '1' });
        }
        await escribir(duena, '/api/restaurante/enviar-pedido', { ordenId, lineas });
        expect(await estacionesDeLaCuenta(duena, ordenId)).toEqual(
          [general.nombre, 'Barra', NOMBRE.frios, NOMBRE.parrilla, NOMBRE.postres].sort(),
        );
      });

      await test.step('cada Cocina ve y anuncia sólo lo suyo; la dueña ve todo', async () => {
        const casos = [
          { c: deParrilla, suyo: platillo.parrilla },
          { c: deFrios, suyo: platillo.frios },
          { c: dePostres, suyo: platillo.postres },
        ];
        const todos = casos.map((x) => x.suyo);
        for (const { c, suyo } of casos) {
          await expect(c.pagina.getByText('1 pedido(s) activos')).toBeVisible({ timeout: 15_000 });
          await expect
            .poll(async () => (await c.dicho()).join(' | '), {
              message: `La estación de «${suyo}» no lo anunció.`,
            })
            .toContain(suyo);
          const ajenos = todos.filter((t) => t !== suyo);
          for (const frase of await c.dicho()) {
            for (const ajeno of ajenos)
              expect(frase, 'Anunció lo de otra estación.').not.toContain(ajeno);
          }
          if (info.project.name === 'telefono') continue;
          await expect(c.pagina.getByText(suyo).first()).toBeVisible();
          for (const ajeno of ajenos) await expect(c.pagina.getByText(ajeno)).toHaveCount(0);
        }
        await duena.goto('/cocina');
        await expect(duena.getByText('5 pedido(s) activos')).toBeVisible();
      });

      await test.step('cada estación conecta sólo su teléfono, y el de Parrilla ve lo suyo', async () => {
        const pantalla = deParrilla.pagina;
        await pantalla.getByRole('button', { name: 'Conectar teléfono' }).click();
        const dialogo = pantalla.getByRole('dialog', { name: 'Conectar teléfono' });
        for (const ajena of [NOMBRE.frios, NOMBRE.postres, general.nombre]) {
          await expect(dialogo.getByRole('button', { name: ajena, exact: true })).toHaveCount(0);
        }
        await dialogo.getByRole('button', { name: NOMBRE.parrilla, exact: true }).click();
        const enlace = await dialogo.getByRole('link').getAttribute('href');
        expect(enlace).toMatch(/\/cocina-telefono\//);
        await pantalla.keyboard.press('Escape');
        const telefono = await telefonoDeCocina.newPage();
        await telefono.goto(new URL(enlace ?? '').pathname);
        await telefono.getByRole('button', { name: 'Toca para activar el sonido' }).click();
        await expect(telefono.getByText(NOMBRE.parrilla, { exact: true })).toBeVisible();
        const tarjeta = telefono.getByRole('article', { name: `Comanda de Mesa ${String(MESA)}` });
        await expect(tarjeta).toContainText(platillo.parrilla);
        await expect(telefono.getByText(platillo.frios)).toHaveCount(0);
      });

      await test.step('el pedido del comensal desde el portal también se parte por estación', async () => {
        const comensal = await abrirElQrDeLaMesa(browser, info, SLUG, token);
        telefonos.push(comensal);
        await agregar(comensal.page, platillo.frios);
        await agregar(comensal.page, platillo.postres);
        await enviarElPedidoDeLaMesa(comensal.page, token);
        const [mesa] = await consultarPuente<{ venta_activa_id?: string | null }>(duena, 'Mesa', {
          filtro: { numero: MESA_DEL_PORTAL },
          limite: 1,
        });
        expect(await estacionesDeLaCuenta(duena, mesa?.venta_activa_id ?? '')).toEqual(
          [NOMBRE.frios, NOMBRE.postres].sort(),
        );
      });

      // Las de esta corrida se apagan: la siguiente crea las suyas.
      for (const estacion of [parrilla, frios, postres]) {
        await escribir(duena, '/api/datos/escribir', {
          entidad: 'EstacionPreparacion',
          operacion: 'update',
          id: estacion.id,
          datos: { activo: false },
        });
      }
      sinFallos();
    } finally {
      for (const telefono of telefonos) await telefono.cerrar();
      for (const c of cocineros) await c.pagina.context().close();
      await telefonoDeCocina.close();
      await equipo.cerrar();
    }
  });
});
