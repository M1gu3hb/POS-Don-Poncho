import type { Locator, Page } from '@playwright/test';

import { configuracionDelNegocio } from '../ayudantes/mesas-heredadas.ts';
import { cuentaDeLaMesa, escribir, resetearLaDemo } from '../ayudantes/modo-espera.ts';
import { exigirDemostracion } from '../ayudantes/sesion.ts';

import { escribirEnCampo, fijarInterruptor } from './arnes/configuracion.ts';
import { expect, exigirServidor, test } from './arnes/prueba.ts';
import { toque } from './arnes/toque.ts';
import { VariosAparatos } from './arnes/varios-aparatos.ts';

/**
 * DP-22 · EL PORTAL DEL COMENSAL, CON EL DEDO Y EN EL TELÉFONO.
 *
 * La dueña cambia en Configuración → Portal de comensales («Activación y menú» y «Cuenta y propina
 * desde QR») y el comensal, en otro aparato sin sesión, lo ve (o no) en su pantalla:
 *
 *   portal_qr_mensaje_bienvenida · portal_qr_mostrar_sin_imagen ·
 *   portal_qr_permitir_ordenar · portal_qr_permitir_cuenta · portal_qr_permitir_ayuda
 *
 * Lo que el servidor decide con esas casillas (rechazar el aviso, no mandar la precuenta) lo prueba
 * `packages/app/src/portal/ajustes-del-portal.integracion.test.ts`. El portal lo deja encendido, con
 * su QR y con pedidos del comensal, la preparación por la API de siempre (no es lo que se prueba).
 */

const SLUG = 'prueba-restaurante';
const MESA = 7;
const AVISOS = ['Quiero ordenar', 'Pedir cuenta', 'Necesito ayuda'] as const;

/** Un grupo de la pantalla del portal: el bloque que lleva su propio «Guardar» y contiene esa fila. */
function grupoConFila(page: Page, fila: string): Locator {
  return page
    .locator('div.space-y-4')
    .filter({ has: page.getByText(fila, { exact: true }) })
    .last();
}

function interruptorDe(page: Page, fila: string): Locator {
  return page
    .getByText(fila, { exact: true })
    .locator('xpath=ancestor::div[contains(@class,"flex items-start")][1]')
    .getByRole('switch');
}

test.describe('el portal del comensal', () => {
  test.use({ actionTimeout: 30_000, navigationTimeout: 60_000 });

  test.beforeAll(async ({ playwright }, info) => {
    await exigirServidor(info.project.use.baseURL);
    await exigirDemostracion(playwright, info, SLUG);
  });

  test('mensaje, platillos sin foto y los tres avisos: lo que la dueña apaga, el comensal no lo ve', async ({
    aparato,
  }, info) => {
    test.setTimeout(8 * 60_000);
    const aparatos = new VariosAparatos(info, SLUG);
    try {
      const duena = await aparatos.abrir({
        puesto: 'ajustes-portal-duena',
        aparato: aparato.id,
        rol: 'dueno',
        ruta: '/',
      });
      const page = duena.page;
      await resetearLaDemo(page);

      // El portal encendido, con pedidos del comensal y el QR de la mesa (preparación, por la API).
      await escribir(page, '/api/datos/escribir', {
        entidad: 'ConfiguracionNegocio',
        operacion: 'update',
        datos: {
          portal_qr_activo: true,
          portal_qr_permitir_pedidos_cliente: true,
          portal_qr_cuenta_modo: 'ambos',
        },
      });
      const { mesaId } = await cuentaDeLaMesa(page, MESA);
      const rotado = await escribir(page, '/api/restaurante/rotar-qr', { mesaId });
      const token = String(rotado.datos?.['qrToken']);
      expect(token.length).toBeGreaterThan(10);

      const comensal = await aparatos.abrir({
        puesto: 'ajustes-portal-comensal',
        aparato: 'telefono-360x800',
        ruta: `/qr/${token}`,
      });
      const telefono = comensal.page;
      const enElPortal = (texto: string | RegExp): Locator => telefono.getByText(texto).first();

      /** La dueña cambia la fila con el dedo y guarda su grupo; el servidor tiene que decirlo. */
      async function cambiar(fila: string, encendida: boolean): Promise<void> {
        await page.goto('/configuracion?seccion=portal', { waitUntil: 'domcontentloaded' });
        const grupo = grupoConFila(page, fila);
        await fijarInterruptor(page, interruptorDe(page, fila), encendida);
        const respuesta = page.waitForResponse(
          (r) => r.request().method() === 'POST' && r.url().includes('/api/datos/escribir'),
        );
        await toque(page, grupo.getByRole('button', { name: 'Guardar', exact: true }).last());
        expect((await respuesta).ok()).toBe(true);
      }

      // 1 · El mensaje de bienvenida.
      await page.goto('/configuracion?seccion=portal', { waitUntil: 'domcontentloaded' });
      const mensaje = page.getByPlaceholder('Mensaje que verá el cliente al escanear su QR.');
      await escribirEnCampo(page, mensaje, 'Bienvenidos a la barbacoa de Don Poncho');
      const respuesta = page.waitForResponse(
        (r) => r.request().method() === 'POST' && r.url().includes('/api/datos/escribir'),
      );
      await toque(
        page,
        grupoConFila(page, 'Mostrar productos sin imagen')
          .getByRole('button', { name: 'Guardar', exact: true })
          .last(),
      );
      expect((await respuesta).ok()).toBe(true);
      await expect
        .poll(async () => (await configuracionDelNegocio(page))['portal_qr_mensaje_bienvenida'])
        .toBe('Bienvenidos a la barbacoa de Don Poncho');
      await telefono.reload();
      await expect(enElPortal('Bienvenidos a la barbacoa de Don Poncho')).toBeVisible();

      // 1b · «Mostrar productos sin imagen» vale en los DOS menús (DP-D166). El catálogo de prueba no
      // trae fotos, así que apagada la casilla el comensal no ve ni un platillo; encendida, los ve todos.
      async function elMenuSeVe(como: 'A la carta' | 'Menú digital'): Promise<void> {
        await page.goto('/configuracion?seccion=portal', { waitUntil: 'domcontentloaded' });
        const modo = page.getByRole('combobox', { name: 'Cómo se ve el menú' });
        await expect(modo).toBeVisible();
        await toque(page, modo);
        await toque(page, page.getByRole('option', { name: como, exact: true }));
        await expect(modo).toHaveText(como);
        const respuesta = page.waitForResponse(
          (r) => r.request().method() === 'POST' && r.url().includes('/api/datos/escribir'),
        );
        await toque(
          page,
          grupoConFila(page, 'Mostrar productos sin imagen')
            .getByRole('button', { name: 'Guardar', exact: true })
            .last(),
        );
        expect((await respuesta).ok()).toBe(true);
      }
      const sinPlatillos = telefono.getByText('El menú todavía no tiene platillos.');
      await elMenuSeVe('A la carta');
      await telefono.reload();
      await expect(enElPortal('Bienvenidos a la barbacoa de Don Poncho')).toBeVisible();
      await expect(sinPlatillos).toHaveCount(0);
      await expect(telefono.getByRole('listitem').first()).toBeVisible();

      await cambiar('Mostrar productos sin imagen', false);
      await expect
        .poll(async () => (await configuracionDelNegocio(page))['portal_qr_mostrar_sin_imagen'])
        .toBe(false);
      await telefono.reload();
      await expect(sinPlatillos).toBeVisible();

      await cambiar('Mostrar productos sin imagen', true);
      await telefono.reload();
      await expect(sinPlatillos).toHaveCount(0);
      await expect(telefono.getByRole('listitem').first()).toBeVisible();
      await elMenuSeVe('Menú digital');
      // Menú digital: los mismos dos estados.
      const tarjetas = (): Promise<number> =>
        telefono.getByRole('button', { name: /Ver y agregar/ }).count();
      await telefono.reload();
      await expect.poll(tarjetas).toBeGreaterThan(0);
      await cambiar('Mostrar productos sin imagen', false);
      await telefono.reload();
      await expect(enElPortal('Bienvenidos a la barbacoa de Don Poncho')).toBeVisible();
      await expect.poll(tarjetas).toBe(0);
      await cambiar('Mostrar productos sin imagen', true);
      await telefono.reload();
      await expect.poll(tarjetas).toBeGreaterThan(0);

      /** Lo que el comensal encuentra al tocar «Atención» (el portal recargado, como lo vería al volver). */
      async function avisosDelComensal(): Promise<string[]> {
        await telefono.reload();
        await expect(enElPortal('Bienvenidos a la barbacoa de Don Poncho')).toBeVisible();
        await toque(telefono, telefono.getByRole('button', { name: 'Atención' }));
        await expect(telefono.getByText('Quiero ordenar', { exact: true }).first())
          .toBeVisible({
            timeout: 5_000,
          })
          .catch(() => undefined);
        await telefono.waitForTimeout(400);
        const visibles: string[] = [];
        for (const etiqueta of AVISOS) {
          if (await telefono.getByText(etiqueta, { exact: true }).first().isVisible()) {
            visibles.push(etiqueta);
          }
        }
        await telefono.keyboard.press('Escape');
        return visibles;
      }

      // 2 · Los tres avisos: con todo encendido están los tres; apagado uno, el comensal ya no lo tiene
      // (y los otros dos siguen); encendido otra vez, vuelve.
      expect(await avisosDelComensal()).toEqual([...AVISOS]);
      for (const [fila, clave] of [
        ['Quiero ordenar', 'portal_qr_permitir_ordenar'],
        ['Pedir cuenta', 'portal_qr_permitir_cuenta'],
        ['Necesito ayuda', 'portal_qr_permitir_ayuda'],
      ] as const) {
        await cambiar(fila, false);
        await expect.poll(async () => (await configuracionDelNegocio(page))[clave]).toBe(false);
        expect(await avisosDelComensal(), `sin «${fila}»`).toEqual(
          AVISOS.filter((a) => a !== fila),
        );
        await cambiar(fila, true);
        await expect.poll(async () => (await configuracionDelNegocio(page))[clave]).toBe(true);
        expect(await avisosDelComensal(), `con «${fila}» otra vez`).toEqual([...AVISOS]);
      }
      // 3 · El mensaje borrado: el comensal ya no lo ve.
      await page.goto('/configuracion?seccion=portal', { waitUntil: 'domcontentloaded' });
      await escribirEnCampo(
        page,
        page.getByPlaceholder('Mensaje que verá el cliente al escanear su QR.'),
        '',
      );
      const borrado = page.waitForResponse(
        (r) => r.request().method() === 'POST' && r.url().includes('/api/datos/escribir'),
      );
      await toque(
        page,
        grupoConFila(page, 'Mostrar productos sin imagen')
          .getByRole('button', { name: 'Guardar', exact: true })
          .last(),
      );
      expect((await borrado).ok()).toBe(true);
      await telefono.reload();
      await expect(telefono.getByRole('button', { name: 'Atención' })).toBeVisible();
      await expect(enElPortal('Bienvenidos a la barbacoa de Don Poncho')).toHaveCount(0);
    } finally {
      await aparatos.cerrar();
    }
  });
});
