import { expect, type Page, test } from '@playwright/test';

import { Equipo } from './ayudantes/roles.ts';
import { exigirDemostracion, vigilarFallos } from './ayudantes/sesion.ts';

/**
 * DP-21 · Bloque 9 · LA BARRA LATERAL, CON UN BOTÓN CLARO (O5/M3). SIN CORRER: la corre el
 * orquestador con el build.
 *
 * LO QUE SUPONE DEL NEGOCIO DE PRUEBA (ajustar si falla al correrla):
 *   · `prueba-restaurante`: la dueña ve MÁS de 2 secciones en el menú (empieza abierta) y el mesero
 *     ve 1 o 2 (empieza plegada: «Mesas», quizá «Cocina»);
 *   · la barra fija sólo existe de 1024 px para arriba (`lg:`): el escritorio y la tableta en
 *     horizontal (Galaxy Tab S4 landscape, 1138 px) la tienen; el teléfono (Pixel 7) sólo trae el
 *     botón «Menú» del cajón, y por eso las pruebas de la barra fija se saltan ahí;
 *   · la elección vive en `localStorage['mpos.barra-lateral']` ('plegada' | 'abierta').
 */

const SLUG = 'prueba-restaurante';
const CLAVE = 'mpos.barra-lateral';
const MIN_TACTIL_PX = 44;

async function exigirBotonGrande(pagina: Page, nombre: string, texto: string): Promise<void> {
  const boton = pagina.getByRole('button', { name: nombre });
  await expect(boton).toBeVisible();
  await expect(boton).toContainText(texto);
  const caja = await boton.boundingBox();
  if (caja === null) throw new Error(`«${nombre}» no tiene caja.`);
  expect(caja.width, `«${nombre}» mide ${String(caja.width)} px de ancho.`).toBeGreaterThanOrEqual(
    MIN_TACTIL_PX - 0.5,
  );
  expect(caja.height, `«${nombre}» mide ${String(caja.height)} px de alto.`).toBeGreaterThanOrEqual(
    MIN_TACTIL_PX - 0.5,
  );
  // Visible de verdad: ni al 50 % de opacidad ni escondido por otra capa.
  const opacidad = await boton.evaluate((nodo) => Number(getComputedStyle(nodo).opacity));
  expect(opacidad).toBe(1);
}

test.describe('la barra lateral (DP-21 · O5/M3)', () => {
  test.use({ actionTimeout: 20_000, navigationTimeout: 30_000 });

  test.beforeAll(async ({ playwright }, info) => {
    await exigirDemostracion(playwright, info, SLUG);
  });

  test('el botón de plegar es grande, se ve plegada y desplegada, y el aparato se acuerda', async ({
    browser,
  }, info) => {
    test.skip(
      (info.project.use.viewport?.width ?? 0) < 1024,
      'la barra fija sólo existe de 1024 px',
    );
    const equipo = new Equipo(browser, SLUG);
    try {
      const duena = await equipo.pagina(info, 'dueno');
      const sinFallos = vigilarFallos(duena);
      await duena.goto('/');
      await duena.evaluate((clave) => {
        localStorage.removeItem(clave);
      }, CLAVE);
      await duena.reload();

      await test.step('desplegada: «Ocultar» (44 × 44 como mínimo, con letra)', async () => {
        await exigirBotonGrande(duena, 'Ocultar menú', 'Ocultar');
      });
      await test.step('plegada: «Mostrar», igual de grande y a la vista', async () => {
        await duena.getByRole('button', { name: 'Ocultar menú' }).click();
        await exigirBotonGrande(duena, 'Mostrar menú', 'Mostrar');
      });
      await test.step('la elección se recuerda al recargar', async () => {
        expect(await duena.evaluate((c) => localStorage.getItem(c), CLAVE)).toBe('plegada');
        await duena.reload();
        await exigirBotonGrande(duena, 'Mostrar menú', 'Mostrar');
        await duena.getByRole('button', { name: 'Mostrar menú' }).click();
        await exigirBotonGrande(duena, 'Ocultar menú', 'Ocultar');
        expect(await duena.evaluate((c) => localStorage.getItem(c), CLAVE)).toBe('abierta');
        await duena.reload();
        await exigirBotonGrande(duena, 'Ocultar menú', 'Ocultar');
      });
      await duena.evaluate((clave) => {
        localStorage.removeItem(clave);
      }, CLAVE);
      sinFallos();
    } finally {
      await equipo.cerrar();
    }
  });

  test('un puesto de una o dos secciones (el mesero) empieza plegado, y lo que elige manda', async ({
    browser,
  }, info) => {
    test.skip(
      (info.project.use.viewport?.width ?? 0) < 1024,
      'la barra fija sólo existe de 1024 px',
    );
    const equipo = new Equipo(browser, SLUG);
    try {
      const mesero = await equipo.pagina(info, 'mesero');
      await mesero.goto('/mesero');
      await mesero.evaluate((clave) => {
        localStorage.removeItem(clave);
      }, CLAVE);
      await mesero.reload();
      await exigirBotonGrande(mesero, 'Mostrar menú', 'Mostrar');

      // Lo que elige el aparato manda sobre la omisión.
      await mesero.getByRole('button', { name: 'Mostrar menú' }).click();
      await exigirBotonGrande(mesero, 'Ocultar menú', 'Ocultar');
      await mesero.reload();
      await exigirBotonGrande(mesero, 'Ocultar menú', 'Ocultar');
      await mesero.evaluate((clave) => {
        localStorage.removeItem(clave);
      }, CLAVE);
    } finally {
      await equipo.cerrar();
    }
  });

  test('abajo de 1024 px el botón «Menú» del cajón mide lo mismo y dice «Menú»', async ({
    browser,
  }, info) => {
    test.skip((info.project.use.viewport?.width ?? 0) >= 1024, 'aquí hay barra fija, no cajón');
    const equipo = new Equipo(browser, SLUG);
    try {
      const mesero = await equipo.pagina(info, 'mesero');
      await mesero.goto('/mesero');
      await exigirBotonGrande(mesero, 'Abrir menú', 'Menú');
      await mesero.getByRole('button', { name: 'Abrir menú' }).click();
      await expect(mesero.getByRole('navigation', { name: 'Menú principal' })).toBeVisible();
    } finally {
      await equipo.cerrar();
    }
  });
});
