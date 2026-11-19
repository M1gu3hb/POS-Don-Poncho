import type { Locator, Page } from '@playwright/test';

import { CARTA } from '../../ayudantes/mesas-heredadas.ts';
import { exigirDemostracion } from '../../ayudantes/sesion.ts';
import { escribir } from '../../ayudantes/modo-espera.ts';
import { guardarTarjeta, irASeccion } from '../arnes/configuracion.ts';
import { expect, exigirServidor, test } from '../arnes/prueba.ts';
import { toque } from '../arnes/toque.ts';
import { VariosAparatos } from '../arnes/varios-aparatos.ts';
import { mesaConPedido, resetearLaDemo } from '../parte7/comun.ts';

import { capturar, guardado, MI_NEGOCIO, prepararConfiguracion, SLUG } from './comun.ts';
import { sqlLocal } from '../parte7/comun.ts';

/**
 * DP-22 · EL PORTAL DEL COMENSAL: QUIÉN PIDE LA CUENTA Y LOS SONIDOS, CON EL DEDO.
 *
 *   portal_qr_cuenta_modo · experiencia.sonidos_en_el_portal
 *
 * La dueña cambia en Configuración (Windows 1366×768 al 125 %) y lo ve el comensal en su teléfono
 * (360×800, sin sesión, desde el QR de una mesa con cuenta abierta).
 */

const MESA = 7;

/** El grupo de la pantalla del portal que lleva su propio «Guardar» y contiene esa fila. */
function grupoConFila(page: Page, fila: string): Locator {
  return page
    .locator('div.space-y-4')
    .filter({ has: page.getByText(fila, { exact: true }) })
    .last();
}

test.describe('el portal: cuenta y sonidos', () => {
  test.use({ actionTimeout: 120_000, navigationTimeout: 60_000 });

  test.beforeAll(async ({ playwright }, info) => {
    await exigirServidor(info.project.use.baseURL);
    await exigirDemostracion(playwright, info, SLUG);
  });

  test('portal_qr_cuenta_modo: con «Mesero dispara» el comensal sólo avisa; con «Cliente solicita» y «Ambos» abre su cuenta con propina', async ({
    aparato,
  }, info) => {
    test.setTimeout(10 * 60_000);
    const aparatos = new VariosAparatos(info, SLUG);
    try {
      const duena = await aparatos.abrir({
        puesto: 'finales-cuenta-duena',
        aparato: aparato.id,
        rol: 'dueno',
        ruta: '/',
      });
      const page = duena.page;
      await resetearLaDemo(page);
      await prepararConfiguracion(page, {
        portal_qr_activo: true,
        portal_qr_permitir_pedidos_cliente: true,
        portal_qr_permitir_cuenta: true,
        portal_qr_cuenta_modo: 'mesero_dispara',
      });
      // Una cuenta abierta con dos platillos: lo que el comensal pediría que le cobren.
      const { mesaId } = await mesaConPedido(page, page, MESA, [
        { nombre: CARTA.arrachera.nombre },
        { nombre: CARTA.cerveza.nombre },
      ]);
      const rotado = await escribir(page, '/api/restaurante/rotar-qr', { mesaId });
      const token = String(rotado.datos?.['qrToken']);
      const comensal = await aparatos.abrir({
        puesto: 'finales-cuenta-comensal',
        aparato: 'telefono-360x800',
        ruta: `/qr/${token}`,
      });
      const telefono = comensal.page;

      /** La dueña elige el modo con el dedo y guarda su grupo. */
      async function elegirModo(texto: string, valor: string): Promise<void> {
        await irASeccion(page, 'portal');
        const grupo = grupoConFila(page, 'Mostrar precuenta al cliente');
        const combo = grupo.getByRole('combobox').first();
        await toque(page, combo);
        await toque(page, page.getByRole('option', { name: texto }));
        await guardarTarjeta(page, grupo);
        await expect.poll(() => guardado(page, 'portal_qr_cuenta_modo')).toBe(valor);
      }

      /** Lo que el comensal ve al tocar «Atención» → «Pedir cuenta» (con el portal recién abierto). */
      async function alPedirLaCuenta(): Promise<{ avisoDelMesero: boolean; suCuenta: boolean }> {
        const avisos = (): number =>
          Number(
            sqlLocal(`select count(*) from solicitudes_qr where tipo = 'cuenta' and ${MI_NEGOCIO}`),
          );
        const antes = avisos();
        await telefono.goto(`/qr/${token}`, { waitUntil: 'domcontentloaded' });
        await toque(telefono, telefono.getByRole('button', { name: 'Atención' }));
        await toque(telefono, telefono.getByText('Pedir cuenta', { exact: true }).first());
        await telefono.waitForTimeout(1500);
        const cuerpo = await telefono.locator('body').innerText();
        return {
          avisoDelMesero: avisos() > antes,
          suCuenta:
            /precuenta|propina/i.test(cuerpo.replace(/Atención/g, '')) && /Arrachera/i.test(cuerpo),
        };
      }

      // ESTADO A · «Mesero dispara» (de fábrica): el comensal avisa, no se salta al mesero.
      await elegirModo('Mesero dispara (recomendado)', 'mesero_dispara');
      const conMesero = await alPedirLaCuenta();
      await capturar(telefono, 'cuenta-modo', 'telefono-360x800', '1-mesero-dispara');
      expect(conMesero.avisoDelMesero, 'avisa al mesero').toBe(true);
      expect(conMesero.suCuenta, 'no abre su cuenta con propina').toBe(false);

      // ESTADO B · «Cliente solicita»: el mismo toque abre su cuenta con la propina.
      await elegirModo('Cliente solicita', 'cliente_solicita');
      const conCliente = await alPedirLaCuenta();
      await capturar(telefono, 'cuenta-modo', 'telefono-360x800', '2-cliente-solicita');
      expect(conCliente.suCuenta, 'abre su cuenta con propina').toBe(true);

      // ESTADO C · «Ambos»: el comensal también puede iniciarla.
      await elegirModo('Ambos', 'ambos');
      const conAmbos = await alPedirLaCuenta();
      await capturar(telefono, 'cuenta-modo', 'telefono-360x800', '3-ambos');
      expect(conAmbos.suCuenta).toBe(true);

      // De vuelta al de fábrica: otra vez sólo avisa.
      await elegirModo('Mesero dispara (recomendado)', 'mesero_dispara');
      expect((await alPedirLaCuenta()).suCuenta).toBe(false);
    } finally {
      await aparatos.cerrar();
    }
  });

  test('experiencia.sonidos_en_el_portal: apagado el teléfono del comensal calla; encendido suena', async ({
    aparato,
  }, info) => {
    test.setTimeout(8 * 60_000);
    const aparatos = new VariosAparatos(info, SLUG);
    try {
      const duena = await aparatos.abrir({
        puesto: 'finales-sonido-duena',
        aparato: aparato.id,
        rol: 'dueno',
        ruta: '/',
      });
      const page = duena.page;
      await resetearLaDemo(page);
      await prepararConfiguracion(page, { portal_qr_activo: true });
      const { mesaId } = await mesaConPedido(page, page, MESA, [
        { nombre: CARTA.arrachera.nombre },
      ]);
      const rotado = await escribir(page, '/api/restaurante/rotar-qr', { mesaId });
      const token = String(rotado.datos?.['qrToken']);
      const comensal = await aparatos.abrir({
        puesto: 'finales-sonido-comensal',
        aparato: 'telefono-360x800',
        ruta: `/qr/${token}`,
      });
      const telefono = comensal.page;

      async function elegir(encendido: boolean): Promise<void> {
        await irASeccion(page, 'sonidos');
        const interruptor = page.getByRole('switch', { name: 'Sonidos en el portal del comensal' });
        await expect(interruptor).toBeVisible();
        if ((await interruptor.getAttribute('aria-checked')) !== String(encendido)) {
          await toque(page, interruptor);
        }
        await expect(interruptor).toHaveAttribute('aria-checked', String(encendido));
        await expect
          .poll(async () => {
            const exp = (await guardado(page, 'experiencia')) as { sonidos_en_el_portal?: boolean };
            return exp?.sonidos_en_el_portal;
          })
          .toBe(encendido);
      }

      /** Lo último que sonó en el portal tras dos toques seguidos (el primero desbloquea el audio). */
      async function loQueSono(): Promise<string | null> {
        await telefono.goto(`/qr/${token}`, { waitUntil: 'domcontentloaded' });
        const atencion = telefono.getByRole('button', { name: 'Atención' });
        await expect(atencion).toBeVisible();
        await telefono.evaluate(() => {
          document.documentElement.removeAttribute('data-ultimo-sonido');
        });
        await toque(telefono, atencion);
        await telefono.waitForTimeout(400);
        await toque(telefono, telefono.getByRole('button', { name: 'Atención' }));
        await telefono.waitForTimeout(400);
        return telefono.evaluate(() => document.documentElement.getAttribute('data-ultimo-sonido'));
      }

      await elegir(false);
      const apagado = await loQueSono();
      await capturar(telefono, 'sonidos-portal', 'telefono-360x800', '1-apagado');
      expect(apagado, 'apagado, el portal no suena').toBeNull();

      await elegir(true);
      const encendido = await loQueSono();
      await capturar(telefono, 'sonidos-portal', 'telefono-360x800', '2-encendido');
      expect(encendido, 'encendido, el portal suena al tocar').not.toBeNull();

      await elegir(false);
      expect(await loQueSono(), 'apagado otra vez, vuelve a callar').toBeNull();
    } finally {
      await aparatos.cerrar();
    }
  });
});
