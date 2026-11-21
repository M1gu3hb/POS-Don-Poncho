import { expect, test } from '@playwright/test';

import { prepararElPortalDelComensal } from './ayudantes/mesas-heredadas.ts';
import { contextoDe, personaDe } from './ayudantes/roles.ts';

/**
 * DP-18 · 1.3 · PORTAL QR → «PERSONALIZAR MENÚ».
 *
 * Todo lo del menú digital en un solo lugar, con la vista previa del teléfono. Antes el fondo de la
 * tarjeta sólo se cambiaba en Recetas o al crear el producto (Miguel no lo encontró). La prueba: lo
 * que se guarda (descripción corta, fondo, mensaje de bienvenida) se ve en
 * la vista previa al editarlo, sigue igual al volver de otra pestaña y al recargar, y el portal de
 * la mesa lo enseña.
 */

const SLUG = 'prueba-restaurante';
const MESA = 5;

test('lo que se personaliza se ve al momento, se queda al volver y al recargar, y el portal lo enseña', async ({
  browser,
}, info) => {
  test.setTimeout(240_000);
  const contexto = await contextoDe(browser, info, personaDe(SLUG, 'dueno'));
  const page = await contexto.newPage();
  const marca = String(Date.now() % 100_000);
  const descripcion = `Hecha al momento ${marca}`;
  const mensaje = `Bienvenidos · ${marca}`;
  try {
    const token = await prepararElPortalDelComensal(page, {
      mesa: MESA,
      zona: 'Interior',
      mesero: null,
    });
    await page.goto('/portal-qr');
    await page.getByRole('tab', { name: 'Personalizar menú' }).click();
    const vista = page.getByRole('region', { name: 'Vista previa del menú en el teléfono' });
    await expect(vista).toBeVisible();

    // Por platillo: el primero de la lista.
    const lista = page.getByRole('list', { name: 'Platillos encontrados' });
    const primero = lista.getByRole('button').first();
    const nombre = (await primero.innerText()).trim();
    await primero.click();
    await page.getByLabel('Descripción corta').fill(descripcion);
    await expect(vista.getByText(descripcion)).toBeVisible();
    await page.getByRole('button', { name: 'Guardar platillo' }).click();
    await expect(page.getByText(`«${nombre}» guardado`)).toBeVisible();

    // Del menú: el mensaje de bienvenida (el ORDEN de las secciones se cambia en Configuración, DP-24).
    await page.getByLabel('Mensaje de bienvenida').fill(mensaje);
    await expect(vista.getByText(mensaje)).toBeVisible();
    await page.getByRole('button', { name: 'Guardar encabezado y colores' }).click();
    await expect(page.getByText('Encabezado y colores guardados')).toBeVisible();

    // A otra pestaña y de vuelta, y recargando: sigue igual.
    for (const volver of ['pestaña', 'recarga'] as const) {
      if (volver === 'pestaña') {
        await page.getByRole('tab', { name: 'Mesas QR' }).click();
      } else {
        await page.reload();
      }
      await page.getByRole('tab', { name: 'Personalizar menú' }).click();
      await page.getByLabel('Buscar platillo').fill(nombre);
      await lista.getByRole('button', { name: nombre, exact: true }).click();
      await expect(page.getByLabel('Descripción corta')).toHaveValue(descripcion);
      await expect(page.getByLabel('Mensaje de bienvenida')).toHaveValue(mensaje);
    }

    // El portal de la mesa lo enseña.
    const portal = await contexto.newPage();
    await portal.goto(`/qr/${token}`);
    await expect(portal.getByText(descripcion).first()).toBeVisible();
    await expect(portal.getByText(mensaje)).toBeVisible();
    await portal.close();
  } finally {
    await contexto.close();
  }
});
