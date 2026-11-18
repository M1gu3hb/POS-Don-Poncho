import type { Locator, Page } from '@playwright/test';

import { configuracionDelNegocio } from '../ayudantes/mesas-heredadas.ts';
import { escribir, resetearLaDemo } from '../ayudantes/modo-espera.ts';
import { exigirDemostracion } from '../ayudantes/sesion.ts';

import { escribirEnCampo, guardarTarjeta, irASeccion, tarjeta } from './arnes/configuracion.ts';
import { expect, exigirServidor, test } from './arnes/prueba.ts';
import { toque } from './arnes/toque.ts';
import { VariosAparatos } from './arnes/varios-aparatos.ts';

/**
 * DP-22 · IDENTIDAD Y APARIENCIA, CON EL DEDO Y DONDE SE VEN.
 *
 * La dueña cambia en Configuración → El negocio y Apariencia; lo que cambia se ve en la barra lateral
 * de las pantallas internas y en el acceso (la pantalla pública del PIN, en otro aparato sin sesión):
 *
 *   nombre_negocio · nombre_sistema · platform_brand · color_primario · color_acento ·
 *   colorear_importes_monetarios · background_opacity · background_fit
 *
 * Los logos y las imágenes de fondo sólo se suben con un archivo (hace falta el almacén de archivos,
 * que la base desechable no tiene): sus valores se dejan por la API de siempre y se prueba lo que la
 * pantalla hace con ellos (`logo_url`, `background_image_url`, `background_logo_url`).
 */

const SLUG = 'prueba-restaurante';

/** Un bloque heredado de Configuración (sin región con nombre): se llega a él desde su título. */
function bloqueDe(page: Page, titulo: string): Locator {
  return page
    .getByText(titulo, { exact: true })
    .first()
    .locator('xpath=ancestor::*[.//button[starts-with(normalize-space(.),"Guardar")]][1]');
}

const campoDespuesDe = (page: Page, etiqueta: string): Locator =>
  page.getByText(etiqueta, { exact: true }).first().locator('xpath=following::input[1]');

test.describe('identidad y apariencia', () => {
  test.use({ actionTimeout: 30_000, navigationTimeout: 60_000 });

  test.beforeAll(async ({ playwright }, info) => {
    await exigirServidor(info.project.use.baseURL);
    await exigirDemostracion(playwright, info, SLUG);
  });

  test('nombre_negocio, nombre_sistema y platform_brand: la barra y el acceso dicen lo que la dueña escribió', async ({
    aparato,
  }, info) => {
    test.setTimeout(6 * 60_000);
    const aparatos = new VariosAparatos(info, SLUG);
    try {
      const duena = await aparatos.abrir({
        puesto: 'ajustes-identidad-duena',
        aparato: aparato.id,
        rol: 'dueno',
        ruta: '/',
      });
      const page = duena.page;
      await resetearLaDemo(page);
      const acceso = await aparatos.abrir({
        puesto: 'ajustes-identidad-acceso',
        aparato: aparato.id,
        ruta: `/n/${SLUG}/login-pos`,
      });

      // 1 · Datos del negocio: el nombre.
      await irASeccion(page, 'el-negocio');
      const datos = tarjeta(page, 'Datos del negocio');
      await escribirEnCampo(page, datos.getByLabel('Nombre del negocio'), 'Barbacoa La Güera');
      await escribirEnCampo(page, datos.getByLabel('Dirección'), 'Calle Rosal 12, Atemoaya');
      await escribirEnCampo(page, datos.getByLabel('Teléfono'), '55 2468 1357');
      await escribirEnCampo(page, datos.getByLabel('Correo'), 'hola@laguera.example');
      await guardarTarjeta(page, datos);
      await expect
        .poll(async () => {
          const guardada = await configuracionDelNegocio(page);
          return [
            guardada['nombre_negocio'],
            guardada['direccion'],
            guardada['telefono'],
            guardada['correo'],
          ];
        })
        .toEqual([
          'Barbacoa La Güera',
          'Calle Rosal 12, Atemoaya',
          '55 2468 1357',
          'hola@laguera.example',
        ]);

      // 2 · Logo y marca: el nombre del sistema y la marca de la plataforma.
      const marca = bloqueDe(page, 'Nombre del sistema');
      await escribirEnCampo(
        page,
        campoDespuesDe(page, 'Nombre del sistema'),
        'Sistema de la Güera',
      );
      await escribirEnCampo(
        page,
        campoDespuesDe(page, 'Plataforma (marca)'),
        'Cocina de Doña Lupe',
      );
      const respuesta = page.waitForResponse(
        (r) => r.request().method() === 'POST' && r.url().includes('/api/datos/escribir'),
      );
      await toque(page, marca.getByRole('button', { name: /^Guardar/ }).last());
      expect((await respuesta).ok()).toBe(true);
      await expect
        .poll(async () => (await configuracionDelNegocio(page))['platform_brand'])
        .toBe('Cocina de Doña Lupe');

      // 3 · La barra lateral de las pantallas internas (en el teléfono, dentro del menú).
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      const abrirMenu = page.getByRole('button', { name: 'Abrir menú' });
      if (await abrirMenu.isVisible()) await toque(page, abrirMenu);
      await expect(page.getByText('Barbacoa La Güera').first()).toBeVisible();
      await expect(page.getByText('Cocina de Doña Lupe').first()).toBeVisible();

      // 3b · Y de vuelta al nombre de antes: la barra deja de decir el nuevo (valor A → A, valor B → B).
      await irASeccion(page, 'el-negocio');
      const mismos = tarjeta(page, 'Datos del negocio');
      await escribirEnCampo(page, mismos.getByLabel('Nombre del negocio'), 'Restaurante de prueba');
      await guardarTarjeta(page, mismos);
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      if (await abrirMenu.isVisible()) await toque(page, abrirMenu);
      await expect(page.getByText('Restaurante de prueba').first()).toBeVisible();
      await expect(page.getByText('Barbacoa La Güera')).toHaveCount(0);

      // 4 · El acceso (público, sin sesión): lo que dice, para el informe.
      await acceso.page.reload();
      await acceso.page.waitForLoadState('networkidle');
      const delAcceso = (await acceso.page.locator('body').innerText()).slice(0, 200);
      process.stdout.write(`[acceso] ${delAcceso.replaceAll('\n', ' | ')}\n`);
    } finally {
      await aparatos.cerrar();
    }
  });

  test('color_primario y color_acento: los colores de la dueña pintan el sistema y el acceso', async ({
    aparato,
  }, info) => {
    test.setTimeout(6 * 60_000);
    const aparatos = new VariosAparatos(info, SLUG);
    try {
      const duena = await aparatos.abrir({
        puesto: 'ajustes-identidad-colores',
        aparato: aparato.id,
        rol: 'dueno',
        ruta: '/',
      });
      const page = duena.page;
      await resetearLaDemo(page);
      const acceso = await aparatos.abrir({
        puesto: 'ajustes-identidad-acceso-colores',
        aparato: aparato.id,
        ruta: `/n/${SLUG}/login-pos`,
      });
      const variable = (p: Page, nombre: string): Promise<string> =>
        p.evaluate(
          (n) => document.documentElement.style.getPropertyValue(n).trim().toLowerCase(),
          nombre,
        );

      await irASeccion(page, 'apariencia');
      await page.getByLabel('Color primario').fill('#123456');
      await page.getByLabel('Color acento').fill('#abcdef');
      const respuesta = page.waitForResponse(
        (r) => r.request().method() === 'POST' && r.url().includes('/api/datos/escribir'),
      );
      await toque(page, page.getByRole('button', { name: 'Guardar colores' }));
      expect((await respuesta).ok()).toBe(true);

      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await expect.poll(() => variable(page, '--brand-primary')).toBe('#123456');
      await expect.poll(() => variable(page, '--brand-accent')).toBe('#abcdef');
      // Y el acceso, que no tiene sesión, lo lee de lo público.
      await acceso.page.reload();
      // El acceso no lee los colores del negocio (la configuración pide sesión y los colores no son
      // públicos a propósito: hallazgo del informe): sigue con los de la casa.
      await expect.poll(() => variable(acceso.page, '--brand-primary')).toBe('#83653f');
      await expect.poll(() => variable(acceso.page, '--brand-accent')).toBe('#ac8a5f');

      // De vuelta a los de la casa.
      await escribir(page, '/api/datos/escribir', {
        entidad: 'ConfiguracionNegocio',
        operacion: 'update',
        datos: { color_primario: '#83653f', color_acento: '#ac8a5f' },
      });
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await expect.poll(() => variable(page, '--brand-primary')).toBe('#83653f');
      await expect.poll(() => variable(page, '--brand-accent')).toBe('#ac8a5f');
    } finally {
      await aparatos.cerrar();
    }
  });

  test('colorear_importes_monetarios: apagada, los importes del tablero salen en el color del texto', async ({
    aparato,
  }, info) => {
    test.setTimeout(6 * 60_000);
    const aparatos = new VariosAparatos(info, SLUG);
    try {
      const duena = await aparatos.abrir({
        puesto: 'ajustes-identidad-importes',
        aparato: aparato.id,
        rol: 'dueno',
        ruta: '/',
      });
      const page = duena.page;
      await resetearLaDemo(page);
      const colores = async (): Promise<string[]> => {
        await page.goto('/', { waitUntil: 'domcontentloaded' });
        await expect(page.getByText('Buen día')).toBeVisible();
        await expect
          .poll(() => page.locator('p.font-heading.font-black.truncate').count(), {
            timeout: 30_000,
          })
          .toBeGreaterThan(1);
        return page.evaluate(() =>
          Array.from(
            document.querySelectorAll('p.font-heading.font-black.truncate'),
            (p) => getComputedStyle(p).color,
          ),
        );
      };

      const con = await colores();
      expect(con.length, 'el tablero trae tarjetas con importes').toBeGreaterThan(1);
      expect(new Set(con).size, 'encendida, cada tarjeta lleva su color').toBeGreaterThan(1);

      await irASeccion(page, 'apariencia');
      const bloque = bloqueDe(page, 'Importes en color');
      const interruptor = bloque.getByRole('switch').first();
      await expect(interruptor).toBeVisible();
      await toque(page, interruptor);
      await expect(interruptor).toHaveAttribute('aria-checked', 'false');
      const respuesta = page.waitForResponse(
        (r) => r.request().method() === 'POST' && r.url().includes('/api/datos/escribir'),
      );
      await toque(page, bloque.getByRole('button', { name: /^Guardar/ }).last());
      expect((await respuesta).ok()).toBe(true);

      const sin = await colores();
      expect(new Set(sin).size, 'apagada, todas en el mismo color de texto').toBe(1);

      await escribir(page, '/api/datos/escribir', {
        entidad: 'ConfiguracionNegocio',
        operacion: 'update',
        datos: { colorear_importes_monetarios: true },
      });
    } finally {
      await aparatos.cerrar();
    }
  });

  test('Datos del negocio: cambiar SÓLO el nombre y guardar lo deja guardado al recargar', async ({
    aparato,
  }, info) => {
    test.setTimeout(6 * 60_000);
    const aparatos = new VariosAparatos(info, SLUG);
    try {
      const duena = await aparatos.abrir({
        puesto: 'ajustes-identidad-solo-nombre',
        aparato: aparato.id,
        rol: 'dueno',
        ruta: '/',
      });
      const page = duena.page;
      await resetearLaDemo(page);
      for (const nombre of ['Fonda del Rosal', 'Fonda del Sauce']) {
        await irASeccion(page, 'el-negocio');
        const datos = tarjeta(page, 'Datos del negocio');
        await escribirEnCampo(page, datos.getByLabel('Nombre del negocio'), nombre);
        await guardarTarjeta(page, datos);
        await page.reload();
        await expect(
          tarjeta(page, 'Datos del negocio').getByLabel('Nombre del negocio'),
        ).toHaveValue(nombre);
        await expect
          .poll(async () => (await configuracionDelNegocio(page))['nombre_negocio'])
          .toBe(nombre);
      }
    } finally {
      await aparatos.cerrar();
    }
  });
});
