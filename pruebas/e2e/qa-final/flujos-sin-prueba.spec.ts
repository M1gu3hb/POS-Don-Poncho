import {
  CARTA,
  abrirElQrDeLaMesa,
  abrirLaMesa,
  armarElPedido,
  dialogoDeLaMesa,
  enPantalla,
  lineasDeLaCuenta,
  mesaEnElServidor,
  prepararElPortalDelComensal,
} from '../ayudantes/mesas-heredadas.ts';
import { Equipo } from '../ayudantes/roles.ts';
import { exigirDemostracion } from '../ayudantes/sesion.ts';

import { navegadorDe, prepararContexto } from './arnes/ligero.ts';
import { expect, exigirServidor, test } from './arnes/prueba.ts';
import { toque } from './arnes/toque.ts';
import { vigilarPagina } from './arnes/vigilancia.ts';
import { SLUG, capturar, mesaConPedido, resetearLaDemo, sqlLocal } from './parte7/comun.ts';

import type { Locator, Page } from '@playwright/test';

/**
 * DP-22 · LOS FLUJOS QUE QUEDABAN «SIN PRUEBA», con el dedo del arnés:
 *   · «Pedido · Cantidades (más, menos, muchas)»: el «+» y el «−» del carrito del mesero.
 *   · «Portal QR · Calificar la visita»: la carita del comensal, en el teléfono.
 */

const MESA = 5;
const MESA_DEL_PORTAL = 3;
const MUCHAS = 12;

/** El botón de más o de menos del renglón del carrito del mesero; en el teléfono, abre antes el carrito. */
async function botonDelCarrito(
  page: Page,
  mesa: Locator,
  accion: 'Agregar' | 'Quitar',
  nombre: string,
): Promise<Locator> {
  const boton = mesa
    .getByRole('button', { name: `${accion} uno de ${nombre}` })
    .filter({ visible: true });
  if ((await boton.count()) === 0) {
    const carrito = page
      .getByRole('button', { name: /\d+ productos? .*Ver pedido/ })
      .filter({ visible: true });
    if ((await carrito.count()) > 0) await toque(page, carrito.last());
  }
  const enLaPagina = page
    .getByRole('button', { name: `${accion} uno de ${nombre}` })
    .filter({ visible: true });
  await expect(enLaPagina.first(), `No se ve «${accion} uno de ${nombre}».`).toBeVisible();
  return enLaPagina.first();
}

/** En el teléfono el carrito es una hoja con velo: si está abierta, se toca el velo (arriba) para cerrarla. */
async function cerrarElCarrito(page: Page): Promise<void> {
  const velo = page.locator('div.fixed.inset-0[class*="z-[65]"]');
  if ((await velo.count()) === 0) return;
  await toque(page, { x: 20, y: 40 });
  await expect(velo).toHaveCount(0);
}

/** La cantidad que dice el renglón del carrito (el número entre el «−» y el «+»). */
async function cantidadDelRenglon(boton: Locator): Promise<number> {
  const texto = await boton.locator('xpath=..').locator('span').first().innerText();
  return Number(texto.trim());
}

test.describe('flujos que no tenían prueba', () => {
  test.use({ actionTimeout: 60_000, navigationTimeout: 120_000 });

  test.beforeAll(async ({ playwright }, info) => {
    await exigirServidor(info.project.use.baseURL);
    await exigirDemostracion(playwright, info, SLUG);
  });

  test('Pedido · Cantidades: «+» y «−» en el carrito, bajar a cero quita el renglón, 12 suman bien y la cuenta dice lo mismo', async ({
    browser,
    aparato,
  }, info) => {
    test.setTimeout(10 * 60_000);
    const equipo = new Equipo(navegadorDe(browser, aparato), SLUG);
    try {
      const duena = await equipo.pagina(info, 'dueno');
      await prepararContexto(duena.context(), aparato);
      await resetearLaDemo(duena);
      const lupita = await equipo.pagina(info, 'mesero');
      await prepararContexto(lupita.context(), aparato);
      vigilarPagina(lupita);
      await lupita.goto('/mesero', { waitUntil: 'domcontentloaded' });
      const { ordenId } = await abrirLaMesa(lupita, duena, MESA, 2);
      const mesa = dialogoDeLaMesa(lupita, MESA);
      const nombre = CARTA.arrachera.nombre;

      // Una pieza al tocar el platillo; el «+» la sube y el «−» la baja.
      await armarElPedido(lupita, MESA, [{ nombre, veces: 1 }]);
      const mas = await botonDelCarrito(lupita, mesa, 'Agregar', nombre);
      expect(await cantidadDelRenglon(mas)).toBe(1);
      await toque(lupita, mas);
      await expect.poll(async () => cantidadDelRenglon(mas)).toBe(2);
      const menos = await botonDelCarrito(lupita, mesa, 'Quitar', nombre);
      await toque(lupita, menos);
      await expect.poll(async () => cantidadDelRenglon(mas)).toBe(1);

      // Bajar a cero quita el renglón.
      await toque(lupita, menos);
      await expect(
        lupita.getByRole('button', { name: `Quitar uno de ${nombre}` }).filter({ visible: true }),
        'Con cero, el renglón sigue en el carrito.',
      ).toHaveCount(0);

      await cerrarElCarrito(lupita);

      // Una cantidad grande: 12 se ve bien y suma bien.
      await armarElPedido(lupita, MESA, [{ nombre, veces: 1 }]);
      const masDeNuevo = await botonDelCarrito(lupita, mesa, 'Agregar', nombre);
      for (let n = 2; n <= MUCHAS; n += 1) {
        await toque(lupita, masDeNuevo);
        await expect.poll(async () => cantidadDelRenglon(masDeNuevo)).toBe(n);
      }
      await expect(
        lupita
          .getByText(enPantalla(CARTA.arrachera.centavos * MUCHAS))
          .filter({ visible: true })
          .first(),
        `El importe de ${String(MUCHAS)} piezas no suma ${enPantalla(CARTA.arrachera.centavos * MUCHAS)}.`,
      ).toBeVisible();
      await capturar(lupita, 'flujos-sin-prueba', aparato.id, 'cantidades-doce');

      // Se envía y la cuenta dice lo mismo.
      const enviar = lupita
        .getByRole('button', { name: 'Enviar a Cocina', exact: true })
        .filter({ visible: true });
      const enviada = lupita.waitForResponse(
        (r) =>
          new URL(r.url()).pathname === '/api/restaurante/enviar-pedido' &&
          r.request().method() === 'POST',
      );
      await toque(lupita, enviar.first());
      expect((await enviada).status()).toBe(200);
      await expect
        .poll(async () => lineasDeLaCuenta(duena, ordenId), {
          message: 'La cuenta no dice las 12 piezas.',
        })
        .toEqual([{ nombre, cantidad: MUCHAS, centavos: CARTA.arrachera.centavos * MUCHAS }]);
    } finally {
      await equipo.cerrar();
    }
  });

  test('Portal QR · Calificar la visita: la carita se toca, se guarda en la cuenta y la pantalla lo dice', async ({
    browser,
    aparato,
  }, info) => {
    test.setTimeout(10 * 60_000);
    const navegador = navegadorDe(browser, aparato);
    const equipo = new Equipo(navegador, SLUG);
    const abiertos: { cerrar(): Promise<void> }[] = [];
    try {
      const duena = await equipo.pagina(info, 'dueno');
      await prepararContexto(duena.context(), aparato);
      await resetearLaDemo(duena);
      await prepararElPortalDelComensal(duena, {
        mesa: MESA_DEL_PORTAL,
        zona: 'Interior',
        mesero: null,
      });
      const lupita = await equipo.pagina(info, 'mesero');
      await prepararContexto(lupita.context(), aparato);
      const { ordenId } = await mesaConPedido(lupita, duena, MESA_DEL_PORTAL, [
        { nombre: CARTA.sopa.nombre },
      ]);
      const token = (await mesaEnElServidor(duena, MESA_DEL_PORTAL)).qrToken ?? '';
      expect(token, 'La mesa no tiene su QR.').not.toBe('');

      const comensal = await abrirElQrDeLaMesa(browser, info, SLUG, token);
      abiertos.push(comensal);
      const telefono = comensal.page;
      await toque(telefono, telefono.getByRole('button', { name: 'Atención' }));
      await toque(telefono, telefono.getByRole('button', { name: 'Pedir cuenta' }));
      const hoja = telefono
        .locator('div.fixed.inset-0')
        .filter({ hasText: `Pedir cuenta — Mesa ${String(MESA_DEL_PORTAL)}` });
      await expect(hoja.getByText('¿Quieres dejar propina?')).toBeVisible();
      await toque(telefono, hoja.getByRole('button', { name: /^10%/ }));
      await toque(telefono, hoja.getByRole('button', { name: 'Confirmar' }));
      await expect(telefono.getByText('¡Cuenta solicitada!')).toBeVisible();
      await toque(telefono, hoja.getByRole('button', { name: 'Cerrar', exact: true }).last());

      // La carita: se toca, se envía y la pantalla dice que quedó.
      const valoracion = telefono
        .locator('div.fixed.inset-0')
        .filter({ hasText: '¿Cómo estuvo tu experiencia?' });
      await expect(valoracion).toBeVisible({ timeout: 30_000 });
      const enviar = valoracion.getByRole('button', { name: 'Enviar', exact: true });
      await expect(enviar, 'Enviar debe esperar a que se toque una carita.').toBeDisabled();
      await toque(telefono, valoracion.getByRole('button', { name: /Excelente/ }));
      await expect(enviar).toBeEnabled();
      await capturar(telefono, 'flujos-sin-prueba', aparato.id, 'carita-tocada');
      await toque(telefono, enviar);
      await expect(
        valoracion.getByText('¡Gracias! Tu valoración fue registrada.'),
        'La pantalla no dice que la valoración quedó.',
      ).toBeVisible();
      await capturar(telefono, 'flujos-sin-prueba', aparato.id, 'carita-guardada');

      // Lo que el servidor guardó: UNA calificación, en la cuenta de la mesa, con la carita del servidor.
      expect(
        sqlLocal(
          `select satisfaccion_score || '|' || satisfaccion_emoji from ordenes where id = '${ordenId}'`,
        ),
      ).toBe('5|🤩');
      await toque(telefono, valoracion.getByRole('button', { name: 'Cerrar', exact: true }).last());
      await expect(valoracion).toHaveCount(0);
    } finally {
      for (const a of abiertos) await a.cerrar();
      await equipo.cerrar();
    }
  });
});
