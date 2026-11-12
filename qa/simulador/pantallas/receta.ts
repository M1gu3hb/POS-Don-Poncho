/**
 * LA PANTALLA DE RECETAS (Recetas → «Nueva receta»): da de alta un platillo con su categoría, su
 * precio, su tipo de venta (pieza, por peso o por porción de contenedor), su foto o su fondo y
 * los ingredientes que descuenta. Es donde el dueño crea los productos en un restaurante.
 */
import { expect, type Locator, type Page, type Response } from '@playwright/test';

import type { ProductoDePrueba } from '../dia0/datos.ts';
import { campoDe, cerrado, dialogoCon, elegir } from './comun.ts';
import { pngSolido } from './png.ts';

const TIPO_DE_VENTA = {
  peso: /^Variable por medida/,
  porcion: /^Por porción de contenedor/,
} as const;

async function llenarPeso(pagina: Page, seccion: Locator, p: ProductoDePrueba): Promise<void> {
  await seccion.getByRole('combobox').first().click();
  await pagina.getByRole('option', { name: TIPO_DE_VENTA.peso }).click();
  if (p.ingredienteBase !== undefined)
    await elegir(
      pagina,
      seccion,
      'Ingrediente base (opcional)',
      new RegExp(`^${p.ingredienteBase}`),
    );
  await elegir(pagina, seccion, 'Unidad mostrada al cliente *', 'kg');
  await campoDe(seccion, /^Precio por kg/)
    .getByRole('spinbutton')
    .fill(String(p.precioPesos));
  if (p.presentaciones !== undefined) {
    await campoDe(seccion, /^Presets en QR/)
      .getByRole('textbox')
      .fill(p.presentaciones.join(', '));
  }
  if (p.soloPresentaciones === true)
    await seccion.getByRole('switch', { name: /sólo en estas presentaciones/ }).click();
}

async function llenarPorcion(pagina: Page, seccion: Locator, p: ProductoDePrueba): Promise<void> {
  await seccion.getByRole('combobox').first().click();
  await pagina.getByRole('option', { name: TIPO_DE_VENTA.porcion }).click();
  const ml = p.presentaciones?.[0] ?? 45;
  if (p.ingredienteBase !== undefined)
    await elegir(
      pagina,
      seccion,
      'Ingrediente base (contenedor) *',
      new RegExp(`^${p.ingredienteBase}`),
    );
  await campoDe(seccion, 'Capacidad del contenedor (ml) *').getByRole('spinbutton').fill('750');
  await campoDe(seccion, 'Porciones por contenedor *')
    .getByRole('spinbutton')
    .fill(String(Math.floor(750 / ml)));
  // «ml por porción (opcional)»: la base lo exige (`producto_porcion_completo`); sin él, error 500.
  await campoDe(seccion, 'Nombre de la porción *').getByRole('textbox').fill('shot');
  await campoDe(seccion, 'Precio por porción *')
    .getByRole('spinbutton')
    .fill(String(p.precioPesos));
}

async function agregarIngredientes(
  dialogo: Locator,
  receta: Readonly<Record<string, number>>,
): Promise<void> {
  let linea = 0;
  for (const [insumo, cantidad] of Object.entries(receta)) {
    await dialogo.getByRole('button', { name: 'Agregar ingrediente' }).click();
    await dialogo.getByPlaceholder('Buscar ingrediente...').nth(linea).fill(insumo);
    await dialogo
      .getByRole('button', { name: new RegExp(`^${insumo}`) })
      .first()
      .click();
    // El precio es el primer campo numérico; después, la cantidad de cada línea.
    await dialogo
      .getByRole('spinbutton')
      .nth(1 + linea)
      .fill(String(cantidad));
    linea += 1;
  }
}

/** Da de alta UN producto de prueba por la pantalla de Recetas. Falla si no queda en el catálogo. */
export async function crearProducto(pagina: Page, p: ProductoDePrueba): Promise<void> {
  await pagina.getByRole('button', { name: 'Nueva receta' }).first().click();
  const dialogo = dialogoCon(pagina, 'Nueva receta');
  await dialogo.getByPlaceholder('Ej: Capuchino').fill(p.nombre);
  await elegir(pagina, dialogo, 'Categoría', p.categoria);
  // Una categoría nueva aún no enseña su área: el servidor exige elegirla (Cocina o Bebidas).
  // Con «Según su categoría» basta si la categoría ya tiene platillos; «Del carbón» es nueva: Cocina.
  if (p.categoria === 'Del carbón') await elegir(pagina, dialogo, 'Área de preparación', 'Cocina');
  await dialogo.getByPlaceholder('0.00').first().fill(String(p.precioPesos));
  const seccion = dialogo.locator('section').filter({ hasText: 'Tipo de venta' }).last();
  if (p.tipo === 'con_foto') {
    await dialogo.locator('input[type=file]').setInputFiles({
      name: `${p.nombre}.png`,
      mimeType: 'image/png',
      buffer: pngSolido(240, 180, [196, 120, 60]),
    });
    await expect(dialogo.locator('img').first()).toBeVisible({ timeout: 30_000 });
  } else if (p.tipo === 'sin_foto_con_fondo') {
    await dialogo.getByLabel('Talavera', { exact: true }).click();
  }
  if (
    p.tipo === 'peso_con_presentaciones' ||
    p.tipo === 'peso_libre' ||
    p.tipo === 'solo_presentaciones'
  )
    await llenarPeso(pagina, seccion, p);
  else if (p.tipo === 'porcion') await llenarPorcion(pagina, seccion, p);
  else if (p.receta !== undefined) await agregarIngredientes(dialogo, p.receta);
  const rechazos: string[] = [];
  const alResponder = (r: Response): void => {
    if (r.request().method() !== 'POST' || r.status() < 400) return;
    void r
      .text()
      .then((t) =>
        rechazos.push(
          `${String(r.status())} ${new URL(r.url()).pathname} ${t.slice(0, 260)} ← ${(r.request().postData() ?? '').slice(0, 700)}`,
        ),
      );
  };
  pagina.on('response', alResponder);
  await dialogo.getByRole('button', { name: 'Crear receta' }).click();
  try {
    await cerrado(dialogo, 30_000);
  } catch (error: unknown) {
    const avisos = await pagina
      .locator('[data-sonner-toast]')
      .allInnerTexts()
      .catch(() => []);
    throw new Error(
      `«Crear receta» de ${p.nombre} no cerró el diálogo. Rechazos: ${rechazos.join('; ') || 'ninguno'}. Avisos: ${avisos.join(' | ')}. ${String(error).slice(0, 80)}`,
      { cause: error },
    );
  } finally {
    pagina.off('response', alResponder);
  }
}
