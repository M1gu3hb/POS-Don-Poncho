import { randomInt } from 'node:crypto';

import { expect, type Browser, type Page, type TestInfo } from '@playwright/test';

import { escribir } from './modo-espera.ts';
import { opcionesDelProyecto } from './roles.ts';
import { consultarPuente, entrar } from './sesion.ts';

/**
 * LAS ESTACIONES EN LAS PRUEBAS DE NAVEGADOR (DP-12.5): la sección «Estaciones de preparación» de
 * Configuración → Negocio (crear, renombrar, desactivar), los cocineros que entran con su PIN de
 * prueba a la pantalla de su estación con la voz espiada, y lo que el servidor guardó.
 */

export interface Estacion {
  readonly id: string;
  readonly nombre: string;
  readonly es_general?: boolean;
  readonly activo?: boolean;
}

export async function estaciones(lector: Page): Promise<readonly Estacion[]> {
  return consultarPuente<Estacion>(lector, 'EstacionPreparacion', { limite: 50 });
}

export async function laEstacion(lector: Page, nombre: string): Promise<Estacion> {
  const encontrada = (await estaciones(lector)).find((e) => e.nombre === nombre);
  if (encontrada === undefined) throw new Error(`El servidor no tiene la estación «${nombre}».`);
  return encontrada;
}

/** La fila de una estación en Configuración: la caja más chica con su nombre y su lápiz. */
function filaDe(duena: Page, nombre: string) {
  return duena
    .locator('div')
    .filter({ has: duena.getByText(nombre, { exact: true }) })
    .filter({ has: duena.getByTitle('Editar estación') })
    .last();
}

export async function crearEstacion(duena: Page, nombre: string): Promise<void> {
  await duena.getByRole('button', { name: 'Nueva estación' }).click();
  const dialogo = duena.getByRole('dialog', { name: 'Nueva estación' });
  await dialogo.getByPlaceholder('Ej. Barra, Postres, Barbacoa').fill(nombre);
  await dialogo.getByRole('button', { name: 'Crear', exact: true }).click();
  await expect(dialogo).toBeHidden();
  await expect(filaDe(duena, nombre)).toBeVisible();
}

export async function renombrarEstacion(duena: Page, de: string, a: string): Promise<void> {
  await filaDe(duena, de).getByTitle('Editar estación').click();
  const dialogo = duena.getByRole('dialog', { name: 'Editar estación' });
  await dialogo.getByPlaceholder('Ej. Barra, Postres, Barbacoa').fill(a);
  await dialogo.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(dialogo).toBeHidden();
  await expect(filaDe(duena, a)).toBeVisible();
}

export async function desactivarEstacion(duena: Page, nombre: string): Promise<void> {
  await filaDe(duena, nombre).getByTitle('Desactivar estación').click();
  const pregunta = duena.getByRole('alertdialog', { name: '¿Desactivar estación?' });
  await pregunta.getByRole('button', { name: 'Sí, desactivar' }).click();
  await expect(pregunta).toBeHidden();
}

/** Manda una categoría a una estación (lo mismo que guarda Configuración → Categorías). */
export async function categoriaA(duena: Page, categoria: string, estacion: Estacion) {
  const [fila] = (
    await consultarPuente<{ id: string; nombre: string }>(duena, 'CategoriaProducto', {
      limite: 50,
    })
  ).filter((c) => c.nombre === categoria);
  if (fila === undefined) throw new Error(`La demo no trae la categoría «${categoria}».`);
  await escribir(duena, '/api/datos/escribir', {
    entidad: 'CategoriaProducto',
    operacion: 'update',
    id: fila.id,
    datos: { estacion_preparacion_id: estacion.id },
  });
}

/** El primer platillo de una categoría, por su nombre. */
export async function platilloDe(
  lector: Page,
  categoria: string,
): Promise<{ id: string; nombre: string }> {
  const categorias = await consultarPuente<{ id: string; nombre: string }>(
    lector,
    'CategoriaProducto',
    { limite: 50 },
  );
  const suya = categorias.find((c) => c.nombre === categoria);
  const productos = await consultarPuente<{ id: string; nombre: string; categoria_id?: string }>(
    lector,
    'ProductoTerminado',
    { limite: 100 },
  );
  const platillo = productos.find((p) => p.categoria_id === suya?.id);
  if (platillo === undefined) throw new Error(`«${categoria}» no tiene platillos.`);
  return platillo;
}

export interface Cocinero {
  readonly pagina: Page;
  /** Lo que su pantalla dijo en voz alta. */
  readonly dicho: () => Promise<readonly string[]>;
}

/** Un cocinero de la estación, con PIN de prueba al azar, en su navegador y con la voz espiada. */
export async function cocineroDe(
  browser: Browser,
  info: TestInfo,
  duena: Page,
  slug: string,
  estacion: Estacion,
): Promise<Cocinero> {
  const pin = String(randomInt(1000, 10_000));
  const nombre = `Cocina ${estacion.nombre} E2E`;
  await escribir(duena, '/api/identidad/empleados', {
    nombre,
    puesto: 'cocina',
    estacionPreparacionId: estacion.id,
    pin,
  });
  const contexto = await browser.newContext(opcionesDelProyecto(info));
  await contexto.addInitScript(() => {
    const dicho: string[] = [];
    Object.defineProperty(window, '__voz', { value: dicho });
    window.speechSynthesis.speak = (frase: SpeechSynthesisUtterance) => {
      dicho.push(frase.text);
      setTimeout(() => {
        frase.dispatchEvent(new Event('end'));
      }, 20);
    };
  });
  const pagina = await contexto.newPage();
  await entrar(pagina, { slug, nombre, pin });
  return {
    pagina,
    dicho: () =>
      pagina.evaluate(() => [...((window as unknown as { __voz?: string[] }).__voz ?? [])]),
  };
}
