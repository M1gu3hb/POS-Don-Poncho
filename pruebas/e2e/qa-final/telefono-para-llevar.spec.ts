import { join } from 'node:path';

import { sesionDeLaCaja } from '../ayudantes/conciliacion.ts';
import {
  CARTA,
  abrirLaCaja,
  cerrarElTicket,
  leerElCobro,
  pesos,
  yaAbierto,
} from '../ayudantes/mesas-heredadas.ts';
import { Equipo } from '../ayudantes/roles.ts';
import { cabecerasDeEscrituraDePrueba, exigirDemostracion } from '../ayudantes/sesion.ts';

import { navegadorDe, prepararContexto } from './arnes/ligero.ts';
import { expect, exigirServidor, test } from './arnes/prueba.ts';
import { abrirTeclado } from './arnes/teclado.ts';
import { toque } from './arnes/toque.ts';
import { vigilarPagina } from './arnes/vigilancia.ts';

import type { Locator, Page } from '@playwright/test';
import type { Aparato } from './arnes/aparatos.ts';

/**
 * EL TELÉFONO DEL PEDIDO PARA LLEVAR, EN EL NAVEGADOR (DP-D157).
 *
 * La cajera captura nombre y teléfono en el diálogo de para llevar con el dedo y el teclado en
 * pantalla del arnés (el campo tiene que quedar a la vista con el teclado puesto). Un teléfono que
 * no es un teléfono se rechaza ANTES de armar el pedido, con su aviso, y no escribe nada; con uno
 * bueno el pedido se arma y se cobra, y el teléfono sale en la lista de «Para llevar» de la Caja.
 */

const SLUG = 'prueba-restaurante';
const NOMBRE = 'Doña Lupe';
const TELEFONO = '55 2468 5678';
const AVISO_DEL_TELEFONO = 'El teléfono sólo lleva números, espacios, guiones y un + al inicio.';

/** Teclea en un campo con el teclado en pantalla puesto, comprobando que el campo no queda tapado. */
async function teclear(page: Page, aparato: Aparato, campo: Locator, texto: string): Promise<void> {
  await toque(page, campo);
  const teclado = await abrirTeclado(page, aparato.teclado);
  try {
    // El campo sigue a la vista: arriba de lo que tapa el teclado (o encogió la ventana y lo siguió).
    const caja = await campo.boundingBox();
    expect(caja, 'El campo desapareció al abrir el teclado.').not.toBeNull();
    expect((caja?.y ?? 0) + (caja?.height ?? 0)).toBeLessThanOrEqual(teclado.visible.abajo + 1);
    await campo.fill('');
    await campo.pressSequentially(texto, { delay: 15 });
    await expect(campo).toHaveValue(texto);
  } finally {
    await teclado.cerrar();
  }
}

test.describe('el teléfono del pedido para llevar', () => {
  test.use({ actionTimeout: 60_000, navigationTimeout: 120_000 });

  test.beforeAll(async ({ playwright }, info) => {
    await exigirServidor(info.project.use.baseURL);
    await exigirDemostracion(playwright, info, SLUG);
  });

  test('se captura con el teclado en pantalla, uno inválido se rechaza y el bueno sale en la lista de la Caja', async ({
    browser,
    aparato,
  }, info) => {
    test.setTimeout(10 * 60_000);
    const equipo = new Equipo(navegadorDe(browser, aparato), SLUG);
    try {
      const duena = await equipo.pagina(info, 'dueno');
      await prepararContexto(duena.context(), aparato);
      const reseteo = await duena.request.post('/api/pruebas/resetear', {
        headers: cabecerasDeEscrituraDePrueba(),
        data: { confirmacion: 'RESETEAR' },
      });
      expect(reseteo.status(), await reseteo.text()).toBe(200);

      const rosa = await equipo.pagina(info, 'cajero');
      await prepararContexto(rosa.context(), aparato);
      vigilarPagina(rosa);
      await rosa.goto('/caja', { waitUntil: 'domcontentloaded' });
      if ((await sesionDeLaCaja(rosa)) === null) await abrirLaCaja(rosa, 150_000);

      await toque(rosa, rosa.getByRole('button', { name: /^Para llevar/ }));
      const dialogo = rosa.getByRole('dialog', { name: 'Pedido para llevar' });
      await yaAbierto(dialogo);
      await toque(
        rosa,
        dialogo.getByRole('button', { name: new RegExp(`^${CARTA.sopa.nombre} \\$`) }),
      );

      await teclear(rosa, aparato, dialogo.getByLabel('Nombre'), NOMBRE);
      const campoDelTelefono = dialogo.getByLabel('Teléfono');

      // ── Un teléfono que no es un teléfono: su aviso, y no se arma nada ─────────────────────
      await teclear(rosa, aparato, campoDelTelefono, '55-ABCD-5678');
      let armados = 0;
      rosa.on('request', (r) => {
        if (new URL(r.url()).pathname === '/api/restaurante/armar-para-llevar') armados += 1;
      });
      await toque(rosa, dialogo.getByRole('button', { name: /^Cobrar \$/ }).first());
      await expect(
        rosa.getByText(AVISO_DEL_TELEFONO),
        'El teléfono inválido no se rechazó con su aviso.',
      ).toBeVisible();
      await rosa.screenshot({
        path: join(
          'qa',
          'qa-final',
          'capturas',
          'telefono-para-llevar',
          aparato.id,
          'telefono-invalido.png',
        ),
      });
      expect(armados, 'Se armó el pedido con un teléfono inválido.').toBe(0);
      await expect(dialogo).toBeVisible();

      // ── El bueno: se arma con nombre y teléfono, se cobra y sale en la lista ───────────────
      await teclear(rosa, aparato, campoDelTelefono, TELEFONO);
      await rosa.screenshot({
        path: join(
          'qa',
          'qa-final',
          'capturas',
          'telefono-para-llevar',
          aparato.id,
          'telefono-capturado.png',
        ),
      });
      const [armado] = await Promise.all([
        rosa.waitForResponse(
          (r) =>
            new URL(r.url()).pathname === '/api/restaurante/armar-para-llevar' &&
            r.request().method() === 'POST',
        ),
        toque(rosa, dialogo.getByRole('button', { name: /^Cobrar \$/ }).first()),
      ]);
      expect(armado.status(), await armado.text()).toBe(200);
      expect(armado.request().postData() ?? '').toContain(TELEFONO);
      const cobro = rosa.getByRole('dialog').filter({ hasText: 'Cobrar —' });
      await yaAbierto(cobro);
      await cobro.getByPlaceholder('0.00').fill(pesos(CARTA.sopa.centavos));
      const [respuesta] = await Promise.all([
        rosa.waitForResponse(
          (r) =>
            new URL(r.url()).pathname === '/api/venta/cobrar' && r.request().method() === 'POST',
        ),
        toque(rosa, cobro.getByRole('button', { name: /^Cobrar \$/ })),
      ]);
      expect((await leerElCobro(respuesta)).estado).toBe(200);
      await cerrarElTicket(rosa);

      const lista = rosa.getByRole('region', { name: 'Pedidos para llevar de hoy' });
      await expect(lista).toContainText(NOMBRE, { timeout: 60_000 });
      await expect(
        lista,
        'El teléfono no salió en la lista de «Para llevar» de la Caja.',
      ).toContainText(`Tel. ${TELEFONO}`);
      await rosa.screenshot({
        path: join(
          'qa',
          'qa-final',
          'capturas',
          'telefono-para-llevar',
          aparato.id,
          'lista-para-llevar.png',
        ),
      });
    } finally {
      await equipo.cerrar();
    }
  });
});
