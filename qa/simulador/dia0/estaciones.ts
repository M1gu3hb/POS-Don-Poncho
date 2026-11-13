/**
 * DÍA 0 · ESTACIONES: Parrilla, Postres y Pulques además de Cocina y Bebidas, y cada categoría con la
 * suya (los productos siguen a su categoría). Configuración → Operación, como lo haría el dueño.
 */
import { expect, type Page } from '@playwright/test';

import { consultar, llamar } from '../api-app.ts';
import { CATEGORIA_A_ESTACION, ESTACIONES_NUEVAS } from './datos.ts';
import { irAConfiguracion, type Dia0 } from './contexto.ts';

/** ¿Ya hay una estación con ese nombre? La fila de una estación es la que trae su lápiz «Editar estación». */
async function existeLaEstacion(pagina: Page, nombre: string): Promise<boolean> {
  // Las filas más chicas con su lápiz; el nombre es la primera línea (una categoría puede llamarse igual).
  const filas = await pagina
    .locator(
      'xpath=//div[.//button[@title="Editar estación"] and not(.//div[.//button[@title="Editar estación"]])]',
    )
    .allInnerTexts();
  return filas.some((t) => (t.split('\n')[0] ?? '').trim() === nombre);
}

async function crearEstacion(d: Dia0, nombre: string): Promise<void> {
  const { pagina } = d;
  await pagina.getByRole('button', { name: 'Nueva estación' }).click();
  const dialogo = pagina.getByRole('dialog').filter({ hasText: 'Nueva estación' });
  await dialogo.getByPlaceholder('Ej. Barra, Postres, Barbacoa').fill(nombre);
  await dialogo.getByRole('button', { name: 'Crear', exact: true }).click();
  await expect(dialogo).toBeHidden();
}

/** La fila de una categoría: el bloque que tiene su nombre y su lápiz «Editar categoría». */
function filaDeCategoria(pagina: Page, nombre: string) {
  // La fila más chica que trae su lápiz «Editar categoría» y el nombre; el nombre de la categoría
  // puede coincidir con el de una estación, así que se mira la primera línea al asignar.
  return pagina
    .locator(
      'xpath=//div[.//button[@title="Editar categoría"] and not(.//div[.//button[@title="Editar categoría"]])]',
    )
    .filter({ has: pagina.getByText(nombre, { exact: true }) });
}

async function crearCategoria(d: Dia0, nombre: string): Promise<void> {
  const { pagina } = d;
  await pagina.getByPlaceholder('Ej. Tacos').fill(nombre);
  await pagina.getByRole('button', { name: 'Agregar', exact: true }).click();
  await expect(pagina.getByText(nombre, { exact: true }).first()).toBeVisible();
}

async function asignarCategoria(d: Dia0, categoria: string, estacion: string): Promise<void> {
  const { pagina } = d;
  const fila = filaDeCategoria(pagina, categoria).first();
  // La primera línea es el nombre de la categoría (puede llamarse como la estación); la insignia viene después.
  const lineas = (await fila.innerText()).split('\n').map((l) => l.trim());
  if (lineas.slice(1).includes(estacion)) return;
  await fila.getByTitle('Editar categoría').click();
  const dialogo = pagina.getByRole('dialog').filter({ hasText: 'Editar categoría' });
  await dialogo.getByRole('combobox').click();
  await pagina.getByRole('option', { name: estacion }).click();
  const escritura = pagina.waitForResponse(
    (r) => new URL(r.url()).pathname === '/api/datos/escribir' && r.request().method() === 'POST',
  );
  await dialogo.getByRole('button', { name: 'Guardar' }).click();
  const respuesta = await escritura;
  if (respuesta.status() === 200) {
    await expect(dialogo).toBeHidden({ timeout: 20_000 });
    d.nota('estaciones', `categoría «${categoria}» → ${estacion}`);
    return;
  }
  // DEFECTO DEL SISTEMA: el diálogo manda «estacion_preparacion_nombre» y el puente lo rechaza (422).
  await d.incidente({
    pantalla: 'Configuración → Operación → Categorías de productos → Editar categoría',
    hizo: `Elegí la estación «${estacion}» para la categoría «${categoria}» y toqué Guardar`,
    esperaba: 'La categoría queda con su estación y el diálogo se cierra',
    paso: `POST /api/datos/escribir → ${String(respuesta.status())}: ${(await respuesta.text()).slice(0, 160)}`,
    evidencia: { correlationId: respuesta.headers()['x-correlation-id'] ?? '' },
    gravedad: 'alto',
    clase: 'servidor',
  });
  await dialogo.getByRole('button', { name: 'Cancelar' }).click();
  await asignarPorLaApi(d, categoria, estacion);
}

/** Lo que hace la pantalla pero sin el campo que el puente rechaza: sólo `estacion_preparacion_id`. */
async function asignarPorLaApi(d: Dia0, categoria: string, estacion: string): Promise<void> {
  const categorias = await consultar<{ id: string; nombre: string }>(d.pagina, 'CategoriaProducto');
  const estaciones = await consultar<{ id: string; nombre: string }>(
    d.pagina,
    'EstacionPreparacion',
  );
  const c = categorias.find((x) => x.nombre === categoria);
  const e = estaciones.find((x) => x.nombre === estacion);
  if (c === undefined || e === undefined)
    throw new Error(`No encuentro la categoría ${categoria} o la estación ${estacion}.`);
  const r = await llamar(d.pagina, '/api/datos/escribir', {
    entidad: 'CategoriaProducto',
    operacion: 'update',
    id: c.id,
    datos: { estacion_preparacion_id: e.id },
  });
  if (!r.ok)
    throw new Error(`La API tampoco pudo asignar la estación: ${String(r.estado)} ${r.mensaje}`);
  d.nota('estaciones', `categoría «${categoria}» → ${estacion} (por la API: la pantalla falla)`);
}

export async function pasoEstaciones(d: Dia0): Promise<void> {
  const { pagina } = d;
  await irAConfiguracion(d, 'Operación');
  await expect(pagina.getByText('Administrar estaciones')).toBeVisible();
  for (const nombre of ESTACIONES_NUEVAS) {
    if (await existeLaEstacion(pagina, nombre)) {
      d.nota('estaciones', `${nombre} ya estaba`);
      continue;
    }
    await crearEstacion(d, nombre);
    d.nota('estaciones', `creada la estación ${nombre}`);
  }
  for (const { categoria, estacion, crear } of CATEGORIA_A_ESTACION) {
    if (crear === true && (await filaDeCategoria(pagina, categoria).count()) === 0) {
      await crearCategoria(d, categoria);
      d.nota('estaciones', `creada la categoría ${categoria}`);
    }
    await asignarCategoria(d, categoria, estacion);
  }
  await d.foto('estaciones');
}
