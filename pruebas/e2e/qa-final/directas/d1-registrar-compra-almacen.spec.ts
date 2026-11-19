import { Equipo } from '../../ayudantes/roles.ts';
import { yaAbierto } from '../../ayudantes/mesas-heredadas.ts';
import { exigirDemostracion } from '../../ayudantes/sesion.ts';
import { navegadorDe, prepararContexto } from '../arnes/ligero.ts';
import { expect, exigirServidor, test } from '../arnes/prueba.ts';
import { toque } from '../arnes/toque.ts';
import { capturar, resetearLaDemo, sqlLocal } from '../parte7/comun.ts';

import type { Page } from '@playwright/test';

/**
 * DIRECTA 1 · «REGISTRAR COMPRA» DEL ALMACÉN (D22-014, hallazgo 28, DP-D181).
 *
 * Una persona con puesto de almacén entra a Inventario, toca «Registrar compra», registra una compra
 * de un insumo (2 kg de Aguacate, por transferencia): el inventario sube +2 000 g y la compra queda
 * en Compras. La contraria: cocina y cajera, que no registran compras, no ven el botón.
 */
const SLUG = 'prueba-restaurante';
const INSUMO = 'Aguacate';
const ORG = `(select id from organizaciones where slug = '${SLUG}')`;

const existencia = (): number =>
  Number(
    sqlLocal(
      `select coalesce(sum(e.cantidad),0) from insumos i left join existencias e on e.insumo_id = i.id where i.organizacion_id = ${ORG} and i.nombre = '${INSUMO}'`,
    ),
  );
const comprasDeTransferencia = (): number =>
  Number(
    sqlLocal(
      `select count(*) from compras where organizacion_id = ${ORG} and total_centavos = 98765`,
    ),
  );

async function elegirOpcion(
  page: Page,
  disparador: ReturnType<Page['locator']>,
  nombre: RegExp | string,
) {
  await toque(page, disparador);
  await toque(page, page.getByRole('option', { name: nombre, exact: typeof nombre === 'string' }));
}

test.describe('D1 · registrar una compra desde Inventario con puesto de almacén', () => {
  test.use({ actionTimeout: 60_000, navigationTimeout: 120_000 });

  test.beforeAll(async ({ playwright }, info) => {
    await exigirServidor(info.project.use.baseURL);
    await exigirDemostracion(playwright, info, SLUG);
  });

  test('D1 · el almacén registra una compra desde Inventario y sube el inventario; cocina y cajera no ven el botón', async ({
    browser,
    aparato,
  }, info) => {
    test.setTimeout(6 * 60_000);
    const equipo = new Equipo(navegadorDe(browser, aparato), SLUG);
    try {
      const duena = await equipo.pagina(info, 'dueno');
      await prepararContexto(duena.context(), aparato);
      await resetearLaDemo(duena);

      const bodega = await equipo.pagina(info, 'almacen');
      await prepararContexto(bodega.context(), aparato);
      await bodega.goto('/inventario', { waitUntil: 'domcontentloaded' });
      await expect(bodega.getByText('Ingredientes e insumos', { exact: true })).toBeVisible();
      await expect(bodega.getByTitle(/^Ajustar stock/).first()).toBeVisible();

      const antes = existencia();
      const comprasAntes = comprasDeTransferencia();
      await toque(bodega, bodega.getByRole('button', { name: /^Registrar compra/ }).first());
      // El botón de Inventario es un enlace a Compras (Inventario.jsx:268): ahí está el formulario.
      await expect(bodega).toHaveURL(/\/compras$/);
      await expect(
        bodega.getByText('Aquí registras las compras y ves las recientes.'),
        'Compras le dice al almacén que SÍ registra compras.',
      ).toBeVisible();
      await capturar(bodega, 'directas', aparato.id, 'd1-compras-del-almacen');
      await toque(bodega, bodega.getByRole('button', { name: /^Registrar compra/ }).first());
      const dialogo = bodega.getByRole('dialog').filter({ hasText: 'Registrar compra' });
      await yaAbierto(dialogo);
      await expect(dialogo.getByText('Línea 1')).toBeVisible();
      await capturar(bodega, 'directas', aparato.id, 'd1-formulario-del-almacen');

      await dialogo.getByPlaceholder('Buscar ingrediente...').fill(INSUMO);
      await toque(bodega, dialogo.getByRole('button', { name: new RegExp(`^${INSUMO}`) }).first());
      await dialogo.getByPlaceholder('0', { exact: true }).first().fill('2');
      await elegirOpcion(
        bodega,
        dialogo
          .getByRole('combobox')
          .filter({ hasText: /^(kg|g|litro|ml|pieza|caja|paquete|bolsa|unidad)$/ })
          .first(),
        'kg',
      );
      await elegirOpcion(bodega, dialogo.getByRole('combobox').first(), 'Transferencia');
      await dialogo.getByPlaceholder('$0').fill('987.65');
      const [respuesta] = await Promise.all([
        bodega.waitForResponse((r) => new URL(r.url()).pathname === '/api/compras/registrar'),
        toque(bodega, dialogo.getByRole('button', { name: 'Guardar compra' })),
      ]);
      expect(respuesta.status(), (await respuesta.text()).slice(0, 300)).toBe(200);
      await expect(dialogo).toBeHidden();

      expect(existencia(), 'El inventario no subió 2 kg.').toBe(antes + 2000);
      expect(comprasDeTransferencia(), 'La compra no quedó guardada.').toBe(comprasAntes + 1);

      // «Compras» muestra la compra (la registra el almacén, no la gerencia).
      await bodega.goto('/compras', { waitUntil: 'domcontentloaded' });
      await expect(bodega.getByText('$987.65').first()).toBeVisible();
      await capturar(bodega, 'directas', aparato.id, 'd1-compra-en-compras');

      // La contraria: puestos que no registran compras no ven el botón.
      for (const rol of ['cocina', 'cajero'] as const) {
        const otro = await equipo.pagina(info, rol);
        await prepararContexto(otro.context(), aparato);
        await otro.goto('/inventario', { waitUntil: 'domcontentloaded' });
        await otro.waitForLoadState('networkidle');
        await capturar(otro, 'directas', aparato.id, `d1-contraria-${rol}`);
        console.warn(`D1 contraria ${rol}: url=${new URL(otro.url()).pathname}`);
        await expect(otro.getByRole('button', { name: /^Registrar compra/ })).toHaveCount(0);
      }
    } finally {
      await equipo.cerrar();
    }
  });
});
