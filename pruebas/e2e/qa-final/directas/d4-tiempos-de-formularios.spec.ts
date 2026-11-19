import { writeFileSync } from 'node:fs';

import { campoDe, dialogoCon } from '../../../../qa/simulador/pantallas/comun.ts';
import { sesionDeLaCaja } from '../../ayudantes/conciliacion.ts';
import { abrirLaCaja, esperadoDelCajon, yaAbierto } from '../../ayudantes/mesas-heredadas.ts';
import { Equipo } from '../../ayudantes/roles.ts';
import { exigirDemostracion } from '../../ayudantes/sesion.ts';
import { navegadorDe, prepararContexto } from '../arnes/ligero.ts';
import { expect, exigirServidor, test } from '../arnes/prueba.ts';
import { toque } from '../arnes/toque.ts';
import { resetearLaDemo } from '../parte7/comun.ts';

import type { Locator, Page } from '@playwright/test';

/**
 * DIRECTA 4 · CUÁNTO TARDAN DE VERDAD LOS FORMULARIOS LENTOS (merma, retiro de caja, registrar compra,
 * cierre de caja). Tres veces cada uno, en local. Dos tiempos: del toque en el botón que envía hasta que
 * la pantalla confirma, y la petición al servidor (del `request` al `response`, por el reloj del
 * navegador: `request.timing()`).
 */
const SLUG = 'prueba-restaurante';
const SALIDA = process.env['MORPHIQPOS_D4_SALIDA'] ?? 'qa/qa-final/informes/d4-tiempos.json';

interface Muestra {
  readonly formulario: string;
  readonly vuelta: number;
  readonly pantallaMs: number;
  readonly servidorMs: number | null;
  readonly ruta: string;
  readonly estado: number;
}
const muestras: Muestra[] = [];

/** Toca `boton`; mide hasta que `confirma` resuelve, y la petición a `ruta`. */
async function medir(
  page: Page,
  formulario: string,
  vuelta: number,
  ruta: string,
  boton: Locator,
  confirma: () => Promise<void>,
): Promise<void> {
  const respuesta = page.waitForResponse((r) => new URL(r.url()).pathname === ruta);
  const t0 = Date.now();
  await toque(page, boton);
  const r = await respuesta;
  await confirma();
  const pantallaMs = Date.now() - t0;
  await r.finished();
  const t = r.request().timing();
  const servidorMs =
    t.responseEnd >= 0 && t.requestStart >= 0 ? Math.round(t.responseEnd - t.requestStart) : null;
  expect(r.status(), `${formulario} #${String(vuelta)}: ${(await r.text()).slice(0, 200)}`).toBe(
    200,
  );
  muestras.push({ formulario, vuelta, pantallaMs, servidorMs, ruta, estado: r.status() });
}

async function elegirOpcion(page: Page, zona: Locator, etiqueta: string, opcion: string | RegExp) {
  await toque(page, campoDe(zona, etiqueta).getByRole('combobox'));
  await toque(page, page.getByRole('option', { name: opcion, exact: typeof opcion === 'string' }));
}

test.describe('D4 · cuánto tardan los formularios lentos', () => {
  test.use({ actionTimeout: 60_000, navigationTimeout: 120_000 });

  test.beforeAll(async ({ playwright }, info) => {
    await exigirServidor(info.project.use.baseURL);
    await exigirDemostracion(playwright, info, SLUG);
  });

  test('D4 · merma, retiro, compra y cierre, tres veces cada uno', async ({
    browser,
    aparato,
  }, info) => {
    test.setTimeout(15 * 60_000);
    const equipo = new Equipo(navegadorDe(browser, aparato), SLUG);
    try {
      const duena = await equipo.pagina(info, 'dueno');
      await prepararContexto(duena.context(), aparato);
      await resetearLaDemo(duena);

      // ── Merma y compra: el almacén, en Inventario ────────────────────────────────────────
      const bodega = await equipo.pagina(info, 'almacen');
      await prepararContexto(bodega.context(), aparato);
      await bodega.goto('/inventario', { waitUntil: 'domcontentloaded' });
      await expect(bodega.getByTitle(/^Ajustar stock/).first()).toBeVisible();
      for (const vuelta of [1, 2, 3]) {
        const fila = bodega
          .getByText('Aguacate', { exact: true })
          .locator('xpath=ancestor::div[.//button[starts-with(@title,"Ajustar stock")]][1]')
          .first();
        await toque(bodega, fila.getByTitle(/^Ajustar stock/));
        const d = dialogoCon(bodega, /Ajustar|stock/i).last();
        await yaAbierto(d);
        await elegirOpcion(bodega, d, 'Tipo de ajuste *', 'Merma / producto perdido');
        await elegirOpcion(bodega, d, 'Método *', /^Sumar \/ restar/);
        await elegirOpcion(bodega, d, 'Sumar o restar *', /^Restar/);
        await d.getByPlaceholder('0', { exact: true }).first().fill('50');
        await elegirOpcion(bodega, d, 'Unidad *', 'g');
        await d.getByPlaceholder(/^Ej: conteo físico inicial/).fill('medición de tiempos');
        await medir(
          bodega,
          'merma',
          vuelta,
          '/api/inventario/ajustar',
          d.getByRole('button', { name: /Guardar ajuste/ }),
          async () => {
            await expect(d).toBeHidden();
          },
        );
      }
      for (const vuelta of [1, 2, 3]) {
        await bodega.goto('/compras', { waitUntil: 'domcontentloaded' });
        await toque(bodega, bodega.getByRole('button', { name: /^Registrar compra/ }).first());
        const d = dialogoCon(bodega, 'Registrar compra');
        await yaAbierto(d);
        await expect(d.getByText('Línea 1')).toBeVisible();
        await elegirOpcion(bodega, d, 'Pago', 'Transferencia');
        await d.getByPlaceholder('Buscar ingrediente...').fill('Aguacate');
        await toque(bodega, d.getByRole('button', { name: /^Aguacate/ }).first());
        await d.getByPlaceholder('0', { exact: true }).first().fill('1');
        await toque(
          bodega,
          d
            .getByRole('combobox')
            .filter({ hasText: /^(kg|g|litro|ml|pieza|caja|paquete|bolsa|unidad)$/ })
            .first(),
        );
        await toque(bodega, bodega.getByRole('option', { name: 'kg', exact: true }));
        await d.getByPlaceholder('$0').fill('150');
        await medir(
          bodega,
          'compra',
          vuelta,
          '/api/compras/registrar',
          d.getByRole('button', { name: 'Guardar compra' }),
          async () => {
            await expect(d).toBeHidden();
          },
        );
      }

      // ── Retiro y cierre: la cajera, en Caja ──────────────────────────────────────────────
      const rosa = await equipo.pagina(info, 'cajero');
      await prepararContexto(rosa.context(), aparato);
      await rosa.goto('/caja', { waitUntil: 'domcontentloaded' });
      await rosa.getByRole('tab', { name: /^Pendientes/ }).waitFor({ timeout: 90_000 });
      if ((await sesionDeLaCaja(rosa)) === null) await abrirLaCaja(rosa, 150_000);
      await toque(rosa, rosa.getByRole('tab', { name: 'Movimientos', exact: true }));
      await expect(rosa.getByRole('heading', { name: 'Retirar' })).toBeVisible();
      for (const vuelta of [1, 2, 3]) {
        await rosa.locator('#retiro-importe').fill('20.00');
        await rosa.locator('#retiro-motivo').fill('medición de tiempos');
        await medir(
          rosa,
          'retiro',
          vuelta,
          '/api/caja/movimiento',
          rosa.getByRole('button', { name: /^Registrar el retiro/ }),
          async () => {
            await expect(rosa.locator('#retiro-importe')).toHaveValue('');
          },
        );
      }
      for (const vuelta of [1, 2, 3]) {
        if ((await sesionDeLaCaja(rosa)) === null) {
          await rosa.goto('/caja', { waitUntil: 'domcontentloaded' });
          await rosa.getByRole('tab', { name: /^Pendientes/ }).waitFor({ timeout: 90_000 });
          await abrirLaCaja(rosa, 150_000);
        }
        await rosa.goto('/caja', { waitUntil: 'domcontentloaded' });
        await rosa.getByRole('tab', { name: /^Pendientes/ }).waitFor({ timeout: 90_000 });
        const esperado = await esperadoDelCajon(rosa);
        await toque(rosa, rosa.getByRole('button', { name: /Cierre diario/ }));
        const cierre = rosa.getByRole('dialog', { name: /Cierre de caja diario/ });
        await yaAbierto(cierre);
        await cierre
          .getByPlaceholder('0.00')
          .first()
          .fill((esperado / 100).toFixed(2));
        await medir(
          rosa,
          'cierre',
          vuelta,
          '/api/caja/cerrar',
          cierre.getByRole('button', { name: /^Cerrar (caja del día|esta caja)/ }),
          async () => {
            await expect(rosa.getByText(/Caja cerrada correctamente/).first()).toBeVisible();
          },
        );
        await rosa.goto('/caja', { waitUntil: 'domcontentloaded' });
        await rosa.getByRole('tab', { name: /^Pendientes/ }).waitFor({ timeout: 90_000 });
      }
    } finally {
      writeFileSync(SALIDA, JSON.stringify(muestras, null, 2));
      for (const m of muestras) {
        console.warn(
          `D4 ${m.formulario} #${String(m.vuelta)} pantalla=${String(m.pantallaMs)}ms servidor=${String(m.servidorMs)}ms`,
        );
      }
      await equipo.cerrar();
    }
  });
});
