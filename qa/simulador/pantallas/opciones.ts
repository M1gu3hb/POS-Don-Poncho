/**
 * LAS OPCIONES DE UN PLATILLO (Platillos → «Opciones»): grupos de «elige una» o «elige varias»,
 * obligatorios o no, con mínimo y máximo y con precio en cada opción (positivo o negativo).
 */
import { expect, type Locator, type Page } from '@playwright/test';

import type { GrupoDePrueba } from '../dia0/datos.ts';
import { apareceEn, cerrado, dialogoCon, elegir } from './comun.ts';

export async function irAPlatillos(pagina: Page, appUrl: string): Promise<void> {
  await pagina.goto(`${appUrl}/productos`, { waitUntil: 'domcontentloaded' });
  await expect(pagina.getByPlaceholder('Buscar producto...')).toBeVisible();
}

/** Abre el diálogo de opciones del platillo (lo busca por nombre en la lista). */
export async function abrirOpciones(pagina: Page, platillo: string) {
  await pagina.getByPlaceholder('Buscar producto...').fill(platillo);
  const tarjeta = pagina
    .getByText(platillo, { exact: true })
    .locator('xpath=ancestor::div[.//button[@title="Opciones de preparación / modificadores"]][1]');
  const dialogo = dialogoCon(pagina, `Opciones de ${platillo}`);
  // Recién cargada la lista, el primer toque a veces cae antes de que la pantalla esté lista y no abre
  // nada: se mira si abrió y, si no, se toca otra vez (hasta tres veces; luego sí falla).
  for (let intento = 1; intento <= 3; intento += 1) {
    await tarjeta.first().getByTitle('Opciones de preparación / modificadores').click();
    if (await apareceEn(dialogo, 6_000)) break;
    if (intento === 3) break;
  }
  await expect(dialogo.getByRole('button', { name: 'Crear grupo nuevo' })).toBeVisible({
    timeout: 30_000,
  });
  return dialogo;
}

/** ¿El platillo ya tiene un grupo con ese nombre? (se mira dentro del diálogo abierto) */
export async function tieneElGrupo(
  pagina: Page,
  platillo: string,
  grupo: string,
): Promise<boolean> {
  return (
    (await dialogoCon(pagina, `Opciones de ${platillo}`)
      .getByText(grupo, { exact: true })
      .count()) > 0
  );
}

/** Crea un grupo nuevo con sus opciones y lo acepta (falta «Guardar» del diálogo). */
export async function crearGrupo(pagina: Page, platillo: string, g: GrupoDePrueba): Promise<void> {
  const dialogo = dialogoCon(pagina, `Opciones de ${platillo}`);
  await dialogo.getByRole('button', { name: 'Crear grupo nuevo' }).click();
  await dialogo.getByLabel('Nombre del grupo').fill(g.nombre);
  if (g.tipo === 'multiple')
    await elegir(pagina, dialogo, 'Cuántas se pueden elegir', 'Elige varias');
  if (g.minimo !== undefined) await dialogo.getByLabel('Mínimo (opcional)').fill(String(g.minimo));
  if (g.maximo !== undefined) await dialogo.getByLabel('Máximo (opcional)').fill(String(g.maximo));
  const obligatorio = dialogo.getByRole('switch', { name: 'Obligatorio' });
  if (((await obligatorio.getAttribute('aria-checked')) === 'true') !== g.obligatorio)
    await obligatorio.click();
  for (const [i, o] of g.opciones.entries()) {
    const nombre = dialogo.getByLabel(`Nombre de la opción ${String(i + 1)}`);
    if ((await nombre.count()) === 0)
      await dialogo.getByRole('button', { name: 'Agregar opción' }).click();
    await nombre.fill(o.nombre);
    await dialogo.getByLabel('Precio en pesos').nth(i).fill(String(o.deltaPesos));
  }
  await dialogo.getByRole('button', { name: 'Aceptar grupo' }).click();
  await expect(dialogo.getByRole('button', { name: 'Crear grupo nuevo' })).toBeVisible();
}

/** Agrega un grupo que otro platillo ya usa (se elige por su nombre). */
export async function agregarGrupoExistente(
  pagina: Page,
  platillo: string,
  grupo: string,
): Promise<void> {
  const dialogo = dialogoCon(pagina, `Opciones de ${platillo}`);
  await dialogo.getByRole('combobox', { name: 'Agregar un grupo que ya existe' }).click();
  await pagina
    .getByRole('option', { name: new RegExp(`^${grupo} ·`) })
    .first()
    .click();
  await dialogo.getByRole('button', { name: 'Agregar', exact: true }).click();
}

export async function guardarOpciones(pagina: Page, platillo: string): Promise<void> {
  const dialogo = dialogoCon(pagina, `Opciones de ${platillo}`);
  await dialogo.getByRole('button', { name: /^Guardar/ }).click();
  // Un grupo que usan otros productos pide confirmar con un segundo toque.
  const confirmar = dialogo.getByRole('button', { name: 'Guardar de todos modos' });
  if (
    await confirmar.waitFor({ state: 'visible', timeout: 1_500 }).then(
      () => true,
      () => false,
    )
  )
    await confirmar.click();
  await cerrado(dialogo);
}

/** Abre el editor del grupo (botón «Editar» de su renglón) dentro del diálogo de opciones. */
async function abrirElGrupo(pagina: Page, platillo: string, grupo: string): Promise<Locator> {
  const dialogo = dialogoCon(pagina, `Opciones de ${platillo}`);
  const renglon = dialogo.getByRole('listitem').filter({ hasText: grupo }).first();
  await renglon.getByRole('button', { name: 'Editar', exact: true }).click();
  await expect(dialogo.getByRole('button', { name: 'Aceptar grupo' })).toBeVisible();
  return dialogo;
}

/** La posición (0, 1, …) de la opción dentro del editor del grupo abierto, por el nombre que lleva su campo. */
async function posicionDeLaOpcion(dialogo: Locator, opcion: string): Promise<number> {
  const nombres = dialogo.getByLabel(/^Nombre de la opción \d+$/);
  const cuantas = await nombres.count();
  for (let i = 0; i < cuantas; i += 1) {
    if ((await nombres.nth(i).inputValue()) === opcion) return i;
  }
  throw new Error(`El grupo no tiene una opción llamada «${opcion}» (hay ${String(cuantas)}).`);
}

/**
 * Enciende o apaga UNA opción de un grupo de un platillo (Platillos → Opciones → Editar → «Activa»),
 * guarda, y vuelve a abrir para leer cómo quedó. Devuelve lo que la pantalla dice ya guardado.
 */
export async function cambiarOpcionActiva(
  pagina: Page,
  appUrl: string,
  platillo: string,
  grupo: string,
  opcion: string,
  activa: boolean,
): Promise<boolean> {
  await irAPlatillos(pagina, appUrl);
  await abrirOpciones(pagina, platillo);
  let dialogo = await abrirElGrupo(pagina, platillo, grupo);
  let interruptor = dialogo
    .getByRole('switch', { name: 'Activa', exact: true })
    .nth(await posicionDeLaOpcion(dialogo, opcion));
  if (((await interruptor.getAttribute('aria-checked')) === 'true') !== activa)
    await interruptor.click();
  await dialogo.getByRole('button', { name: 'Aceptar grupo' }).click();
  await guardarOpciones(pagina, platillo);
  // Se vuelve a abrir: lo que cuenta es lo que la pantalla enseña ya guardado, no lo que se tocó.
  await abrirOpciones(pagina, platillo);
  dialogo = await abrirElGrupo(pagina, platillo, grupo);
  interruptor = dialogo
    .getByRole('switch', { name: 'Activa', exact: true })
    .nth(await posicionDeLaOpcion(dialogo, opcion));
  const quedo = (await interruptor.getAttribute('aria-checked')) === 'true';
  await pagina.keyboard.press('Escape');
  return quedo;
}
