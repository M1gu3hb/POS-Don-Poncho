import type { Locator, Page } from '@playwright/test';

import { exigirDemostracion } from '../../ayudantes/sesion.ts';
import { cuentaDeLaMesa, escribir, resetearLaDemo } from '../../ayudantes/modo-espera.ts';
import { guardarTarjeta, irASeccion } from '../arnes/configuracion.ts';
import { expect, exigirServidor, test } from '../arnes/prueba.ts';
import { toque } from '../arnes/toque.ts';
import { VariosAparatos } from '../arnes/varios-aparatos.ts';

import { capturar, guardado, pngLiso, prepararConfiguracion, SLUG, subirImagen } from './comun.ts';

/**
 * DP-22 · LOS LOGOS Y EL FONDO, SUBIDOS CON EL DEDO Y VISTOS DONDE SE USAN.
 *
 * La dueña sube una imagen en Configuración (Logo y marca; Fondo del sistema) y la ve en el aparato
 * donde cuenta: la barra lateral y el fondo de las pantallas internas (Windows 1366×768 al 125 %), y
 * el encabezado del portal del comensal (teléfono). Cada ajuste demuestra sus DOS estados dentro de la
 * misma prueba (sin imagen → imagen A → imagen B → sin imagen) y la imagen que sale es la SUBIDA: se
 * compara el archivo servido contra el que se entregó al selector.
 *
 *   logo_url · background_image_url · background_logo_url · background_opacity · background_fit
 *
 * Hace falta el almacén local de archivos (`almacen.sh`): sin él, subir una foto contesta 503.
 */

const MESA = 7;
const ROJO = pngLiso(200, 40, 40);
const AZUL = pngLiso(40, 60, 200);

/** La barra lateral y sus imágenes, abierta si el aparato la esconde detrás de un menú. */
async function irAlInicio(page: Page): Promise<void> {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const abrirMenu = page.getByRole('button', { name: 'Abrir menú' });
  if (await abrirMenu.isVisible()) await toque(page, abrirMenu);
}

/** Las URL de las imágenes de la barra lateral que no son de la casa (vienen del almacén). */
async function logosDeLaBarra(page: Page): Promise<string[]> {
  return page
    .locator('img')
    .evaluateAll((imgs) =>
      imgs
        .map((i) => (i as HTMLImageElement).src)
        .filter((src) => src.includes('/api/publico/archivo/')),
    );
}

async function bytesDe(page: Page, url: string): Promise<Buffer> {
  const respuesta = await page.request.get(url);
  expect(respuesta.ok(), `GET ${url}`).toBe(true);
  return respuesta.body();
}

/** Un bloque heredado de Configuración (sin región con nombre): el más cercano a su etiqueta que lleva un «Guardar». */
function bloqueDe(page: Page, etiqueta: string): Locator {
  return page
    .getByText(etiqueta, { exact: true })
    .first()
    .locator('xpath=ancestor::*[.//button[starts-with(normalize-space(.),"Guardar")]][1]');
}

const subirDe = (region: Locator, posicion: number): Locator =>
  region.getByText('Subir imagen').nth(posicion);

async function guardarIdentidad(page: Page, region: Locator): Promise<void> {
  await guardarTarjeta(page, region);
  await expect(region.getByText('✓ Guardado')).toBeVisible();
}

test.describe('logos y fondo del sistema', () => {
  test.use({ actionTimeout: 120_000, navigationTimeout: 60_000 });

  test.beforeAll(async ({ playwright }, info) => {
    await exigirServidor(info.project.use.baseURL);
    await exigirDemostracion(playwright, info, SLUG);
  });

  test('logo_url: la barra lateral y el portal llevan el logo que la dueña subió, y sin logo vuelven a lo de la casa', async ({
    aparato,
  }, info) => {
    test.setTimeout(10 * 60_000);
    const aparatos = new VariosAparatos(info, SLUG);
    try {
      const duena = await aparatos.abrir({
        puesto: 'finales-logo-duena',
        aparato: aparato.id,
        rol: 'dueno',
        ruta: '/',
      });
      const page = duena.page;
      await resetearLaDemo(page);
      await prepararConfiguracion(page, {
        logo_url: '',
        background_logo_url: '',
        background_image_url: '',
        portal_qr_activo: true,
        portal_qr_permitir_pedidos_cliente: true,
      });
      const { mesaId } = await cuentaDeLaMesa(page, MESA);
      const rotado = await escribir(page, '/api/restaurante/rotar-qr', { mesaId });
      const token = String(rotado.datos?.['qrToken']);
      const comensal = await aparatos.abrir({
        puesto: 'finales-logo-comensal',
        aparato: 'telefono-360x800',
        ruta: `/qr/${token}`,
      });
      const telefono = comensal.page;
      const acceso = await aparatos.abrir({
        puesto: 'finales-logo-acceso',
        aparato: aparato.id,
        ruta: `/n/${SLUG}/login-pos`,
      });

      // ESTADO 0 · sin logo: ni la barra ni el portal traen imagen del almacén.
      await irAlInicio(page);
      expect(await logosDeLaBarra(page), 'sin logo la barra no trae imagen subida').toEqual([]);
      await capturar(page, 'logo', aparato.id, '1-barra-sin-logo');
      await telefono.reload();
      await expect(telefono.getByRole('button', { name: 'Atención' })).toBeVisible();
      expect(await logosDeLaBarra(telefono)).toEqual([]);

      // ESTADO A · sube el logo rojo con el dedo y guarda.
      await irASeccion(page, 'el-negocio');
      const marca = bloqueDe(page, 'Logo del negocio');
      await subirImagen(page, subirDe(marca, 0), 'logo-a.png', ROJO);
      await guardarIdentidad(page, marca);
      const urlA = String(await guardado(page, 'logo_url'));
      expect(urlA, 'el servidor guardó la dirección del logo').toMatch(/^https?:\/\//);
      expect((await bytesDe(page, urlA)).length, 'el almacén sirve una imagen').toBeGreaterThan(50);

      await irAlInicio(page);
      await expect.poll(() => logosDeLaBarra(page)).toContain(urlA);
      const logoA = page.locator(`img[src="${urlA}"]`).first();
      await expect(logoA).toBeVisible();
      expect(await logoA.evaluate((i) => (i as HTMLImageElement).naturalWidth)).toBe(96);
      await capturar(page, 'logo', aparato.id, '2-barra-con-logo-rojo');
      await telefono.reload();
      await expect(telefono.locator(`img[src="${urlA}"]`).first()).toBeVisible();
      await capturar(telefono, 'logo', 'telefono-360x800', '3-portal-con-logo-rojo');
      // El acceso no tiene sesión: lleva el de la casa, no el de la dueña (DP-D164).
      await acceso.page.reload();
      await acceso.page.waitForLoadState('networkidle');
      expect(await logosDeLaBarra(acceso.page), 'el acceso no lee el logo del negocio').toEqual([]);

      // ESTADO B · cambia al logo azul: la barra y el portal pasan al azul y dejan el rojo.
      await irASeccion(page, 'el-negocio');
      const marca2 = bloqueDe(page, 'Logo del negocio');
      await subirImagen(page, subirDe(marca2, 0), 'logo-b.png', AZUL);
      await guardarIdentidad(page, marca2);
      const urlB = String(await guardado(page, 'logo_url'));
      expect(urlB).not.toBe(urlA);
      expect((await bytesDe(page, urlB)).length, 'el almacén sirve una imagen').toBeGreaterThan(50);
      await irAlInicio(page);
      await expect.poll(() => logosDeLaBarra(page)).toContain(urlB);
      expect(await logosDeLaBarra(page)).not.toContain(urlA);
      await capturar(page, 'logo', aparato.id, '4-barra-con-logo-azul');
      await telefono.reload();
      await expect(telefono.locator(`img[src="${urlB}"]`).first()).toBeVisible();
      await expect(telefono.locator(`img[src="${urlA}"]`)).toHaveCount(0);

      // ESTADO 0 otra vez · «Quitar» y guardar: vuelve a lo de la casa en los dos aparatos.
      await irASeccion(page, 'el-negocio');
      const marca3 = bloqueDe(page, 'Logo del negocio');
      await toque(page, marca3.getByRole('button', { name: 'Quitar' }).first());
      await guardarIdentidad(page, marca3);
      expect(await guardado(page, 'logo_url')).toBe('');
      await irAlInicio(page);
      await expect.poll(() => logosDeLaBarra(page)).toEqual([]);
      await telefono.reload();
      await expect(telefono.getByRole('button', { name: 'Atención' })).toBeVisible();
      expect(await logosDeLaBarra(telefono)).toEqual([]);
    } finally {
      await aparatos.cerrar();
    }
  });

  test('background_image_url, background_logo_url, background_opacity y background_fit: el fondo de las pantallas internas es lo que se subió, como se pidió', async ({
    aparato,
  }, info) => {
    test.setTimeout(12 * 60_000);
    const aparatos = new VariosAparatos(info, SLUG);
    try {
      const duena = await aparatos.abrir({
        puesto: 'finales-fondo-duena',
        aparato: aparato.id,
        rol: 'dueno',
        ruta: '/',
      });
      const page = duena.page;
      await resetearLaDemo(page);
      await prepararConfiguracion(page, {
        logo_url: '',
        background_logo_url: '',
        background_image_url: '',
        background_opacity: 0.12,
        background_fit: 'cover',
      });
      const marca = (): Locator => page.locator('div.brand-watermark').first();
      const estilo = async (): Promise<{ imagen: string; ajuste: string; opacidad: number }> => {
        await page.goto('/', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(3500);
        return page.evaluate(() => {
          const d = document.querySelector('div.brand-watermark');
          if (d === null) return { imagen: '', ajuste: '', opacidad: -1 };
          const e = getComputedStyle(d);
          return {
            imagen: e.backgroundImage,
            ajuste: e.backgroundSize,
            opacidad: Number(e.opacity),
          };
        });
      };

      // ESTADO 0 · sin fondo configurado: sólo el degradado, ninguna marca de agua.
      expect((await estilo()).opacidad, 'sin imagen no hay marca de agua').toBe(-1);
      await capturar(page, 'fondo', aparato.id, '1-sin-fondo');

      // ESTADO A · la imagen roja como «Fondo del sistema».
      await irASeccion(page, 'apariencia');
      const fondo = bloqueDe(page, 'Fondo del sistema (imagen completa)');
      await subirImagen(page, subirDe(fondo, 0), 'fondo-a.png', ROJO);
      await guardarIdentidad(page, fondo);
      const urlA = String(await guardado(page, 'background_image_url'));
      expect((await bytesDe(page, urlA)).length, 'el almacén sirve una imagen').toBeGreaterThan(50);
      const conImagen = await estilo();
      expect(conImagen.imagen).toContain(urlA);
      expect(conImagen.ajuste, 'de fábrica cubre la pantalla').toBe('cover');
      expect(conImagen.opacidad).toBeCloseTo(0.12, 2);
      await capturar(page, 'fondo', aparato.id, '2-fondo-rojo-12-cubrir');

      // background_fit · «Mostrar imagen completa» → contain; «Cubrir» → cover.
      async function elegirAjuste(texto: string): Promise<void> {
        await irASeccion(page, 'apariencia');
        const region = bloqueDe(page, 'Fondo del sistema (imagen completa)');
        const combo = region.getByRole('combobox');
        await toque(page, combo);
        await toque(page, page.getByRole('option', { name: texto }));
        await guardarIdentidad(page, region);
      }
      await elegirAjuste('Mostrar imagen completa');
      expect(await guardado(page, 'background_fit')).toBe('contain');
      expect((await estilo()).ajuste, 'contener muestra la imagen completa').toBe('contain');
      await capturar(page, 'fondo', aparato.id, '3-fondo-rojo-contener');
      await elegirAjuste('Cubrir toda la pantalla (recomendado)');
      expect(await guardado(page, 'background_fit')).toBe('cover');
      expect((await estilo()).ajuste).toBe('cover');

      // background_opacity · el dedo sobre la barra: cerca del principio y cerca del final.
      async function opacidadCon(fraccion: number): Promise<number> {
        await irASeccion(page, 'apariencia');
        const region = bloqueDe(page, 'Fondo del sistema (imagen completa)');
        const barra = region.locator('input[type="range"]');
        await barra.scrollIntoViewIfNeeded();
        const caja = await barra.boundingBox();
        expect(caja, 'la barra de opacidad se ve').not.toBeNull();
        if (caja === null) return -1;
        await toque(page, { x: caja.x + caja.width * fraccion, y: caja.y + caja.height / 2 });
        await guardarIdentidad(page, region);
        return Number(await guardado(page, 'background_opacity'));
      }
      const poca = await opacidadCon(0.08);
      expect(poca).toBeLessThan(0.2);
      const pocaEnPantalla = (await estilo()).opacidad;
      expect(pocaEnPantalla).toBeCloseTo(poca, 2);
      await capturar(page, 'fondo', aparato.id, '4-fondo-rojo-opacidad-baja');
      const mucha = await opacidadCon(0.92);
      expect(mucha).toBeGreaterThan(0.8);
      const muchaEnPantalla = (await estilo()).opacidad;
      expect(muchaEnPantalla).toBeCloseTo(mucha, 2);
      expect(muchaEnPantalla).toBeGreaterThan(pocaEnPantalla + 0.5);
      await capturar(page, 'fondo', aparato.id, '5-fondo-rojo-opacidad-alta');

      // background_logo_url · la marca de agua (la azul) sólo vale sin imagen de fondo.
      await irASeccion(page, 'apariencia');
      const region = bloqueDe(page, 'Fondo del sistema (imagen completa)');
      await subirImagen(page, subirDe(region, 1), 'marca-b.png', AZUL);
      await guardarIdentidad(page, region);
      const urlB = String(await guardado(page, 'background_logo_url'));
      expect((await bytesDe(page, urlB)).length, 'el almacén sirve una imagen').toBeGreaterThan(50);
      expect((await estilo()).imagen, 'con imagen de fondo, la imagen gana').toContain(urlA);
      await irASeccion(page, 'apariencia');
      await toque(
        page,
        bloqueDe(page, 'Fondo del sistema (imagen completa)')
          .getByRole('button', { name: 'Quitar' })
          .first(),
      );
      await guardarIdentidad(page, bloqueDe(page, 'Fondo del sistema (imagen completa)'));
      expect(await guardado(page, 'background_image_url')).toBe('');
      const soloMarca = await estilo();
      expect(soloMarca.imagen, 'sin imagen de fondo, manda la marca de agua').toContain(urlB);
      expect(soloMarca.imagen).not.toContain(urlA);
      await capturar(page, 'fondo', aparato.id, '6-solo-marca-de-agua-azul');

      // Y sin nada: otra vez el degradado solo.
      await irASeccion(page, 'apariencia');
      const final = bloqueDe(page, 'Fondo del sistema (imagen completa)');
      await toque(page, final.getByRole('button', { name: 'Quitar' }).first());
      await guardarIdentidad(page, final);
      expect(await guardado(page, 'background_logo_url')).toBe('');
      expect((await estilo()).opacidad).toBe(-1);
      await expect(marca()).toHaveCount(0);
    } finally {
      await aparatos.cerrar();
    }
  });
});
