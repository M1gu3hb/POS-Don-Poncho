import {
  dialogoDeLaMesa,
  laMesa,
  mesaEnElServidor,
  yaAbierto,
} from '../ayudantes/mesas-heredadas.ts';
import { Equipo } from '../ayudantes/roles.ts';
import { exigirDemostracion } from '../ayudantes/sesion.ts';

import { navegadorDe, prepararContexto } from './arnes/ligero.ts';
import { expect, exigirServidor, test } from './arnes/prueba.ts';
import { abrirTeclado } from './arnes/teclado.ts';
import { toque } from './arnes/toque.ts';
import { vigilarPagina } from './arnes/vigilancia.ts';
import { SLUG, capturar, mesaConPedido, resetearLaDemo, retrasarLaCuenta } from './parte7/comun.ts';

/**
 * PARTE 7 · MESERO: puntos 8 (buscar un producto), 9 (el tiempo de cada mesa) y 10 (la nota por
 * comensal), con el dedo, en el teléfono (360×800) y la tableta (800×1280).
 */

const MESA = 5;
const OTRA_MESA = 7;
const NOTA = 'sin cebolla, para el niño';

test.describe('parte 7 · el mesero', () => {
  test.use({ actionTimeout: 60_000, navigationTimeout: 120_000 });

  test.beforeAll(async ({ playwright }, info) => {
    await exigirServidor(info.project.use.baseURL);
    await exigirDemostracion(playwright, info, SLUG);
  });

  test('8 · buscar un producto con el teclado en pantalla: acentos o no, sin resultados, y el teclado no tapa', async ({
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
      await mesaConPedido(lupita, duena, MESA, [{ nombre: 'Cerveza clara 355 ml' }]);
      await lupita.goto('/mesero', { waitUntil: 'domcontentloaded' });
      await toque(lupita, laMesa(lupita, MESA));
      const mesa = dialogoDeLaMesa(lupita, MESA);
      await yaAbierto(mesa);

      const buscador = mesa.getByPlaceholder('Buscar producto...');
      await toque(lupita, buscador);
      const teclado = await abrirTeclado(lupita, aparato.teclado);
      try {
        const resultado = mesa.getByRole('button', { name: /^Limonada natural 500 ml/ });
        for (const texto of ['limon', 'limón', 'LIMÓN']) {
          await buscador.fill('');
          await buscador.pressSequentially(texto, { delay: 15 });
          await expect(
            resultado,
            `Buscar «${texto}» no encontró «Limonada natural 500 ml».`,
          ).toBeVisible();
          const caja = await resultado.boundingBox();
          expect(caja, 'El resultado no tiene caja.').not.toBeNull();
          expect(
            (caja?.y ?? 0) + (caja?.height ?? 0),
            `El teclado tapa el resultado de «${texto}».`,
          ).toBeLessThanOrEqual(teclado.visible.abajo + 1);
        }
        await capturar(lupita, 'buscar-producto', aparato.id, 'con-acento-y-teclado');

        await buscador.fill('');
        await buscador.pressSequentially('zzzqx', { delay: 15 });
        await expect(
          mesa.getByText('Sin resultados para tu búsqueda'),
          'La búsqueda sin coincidencias no lo dice.',
        ).toBeVisible();
        await capturar(lupita, 'buscar-producto', aparato.id, 'sin-resultados');

        await buscador.fill('');
        await buscador.pressSequentially('limon', { delay: 15 });
        await toque(lupita, resultado);
      } finally {
        await teclado.cerrar();
      }
      // «Agregar»: el pedido en armado dice el platillo (el botón de enviar queda a la vista).
      await expect(
        mesa.getByText(/Limonada natural 500 ml/).first(),
        'El platillo encontrado no se agregó al pedido.',
      ).toBeVisible();
      await capturar(lupita, 'buscar-producto', aparato.id, 'agregado');
    } finally {
      await equipo.cerrar();
    }
  });

  test('9 · el plano dice cuánto lleva abierta cada mesa y una mesa libre no dice nada', async ({
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
      const abierta = await mesaConPedido(lupita, duena, MESA, [
        { nombre: 'Cerveza clara 355 ml' },
      ]);
      retrasarLaCuenta(abierta.ordenId, 35);
      await lupita.goto('/mesero', { waitUntil: 'domcontentloaded' });
      await expect(laMesa(lupita, MESA)).toBeVisible();

      const tiempo = lupita.locator(`[data-mesa-id="${abierta.mesaId}"] [data-tiempo-de-la-mesa]`);
      await expect(tiempo, 'La mesa abierta no dice su tiempo.').toContainText('35 min');
      await expect(tiempo).toHaveAttribute('data-tiempo-de-la-mesa', '35');
      // Una mesa libre no lleva tiempo.
      const libre = await mesaEnElServidor(duena, OTRA_MESA);
      expect(libre.estado).toBe('libre');
      await expect(
        lupita.locator(`[data-mesa-id="${libre.mesaId}"] [data-tiempo-de-la-mesa]`),
      ).toHaveCount(0);
      // El tiempo no tapa nada: la tesela sigue siendo un blanco de 44 px o más.
      const tesela = lupita.locator(`[data-mesa-id="${abierta.mesaId}"]`);
      const caja = await tesela.boundingBox();
      expect(caja?.width ?? 0).toBeGreaterThanOrEqual(44);
      expect(caja?.height ?? 0).toBeGreaterThanOrEqual(44);
      await capturar(lupita, 'tiempo-de-la-mesa', aparato.id, 'plano');
      // Tocar el tiempo abre la mesa, como cualquier otro punto de la tesela.
      await toque(lupita, tiempo);
      await yaAbierto(dialogoDeLaMesa(lupita, MESA));
    } finally {
      await equipo.cerrar();
    }
  });

  test('10 · la nota por platillo dice «sin cebolla, para el niño» y la cocina la ve en ese platillo', async ({
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
      await mesaConPedido(lupita, duena, MESA, [
        { nombre: 'Sopa de tortilla', notas: NOTA },
        { nombre: 'Arrachera al carbón' },
      ]);
      const tono = await equipo.pagina(info, 'cocina');
      await prepararContexto(tono.context(), aparato);
      vigilarPagina(tono);
      await tono.goto('/cocina', { waitUntil: 'domcontentloaded' });
      const sopa = tono.getByText('Sopa de tortilla').first();
      await expect(sopa).toBeVisible({ timeout: 60_000 });
      // El renglón es el `li` más interno: la tarjeta de la cuenta también es un `li`.
      const renglones = tono.locator('li:not(:has(li))');
      await expect(
        renglones.filter({ hasText: 'Sopa de tortilla' }).filter({ hasText: NOTA }),
        'Cocina no muestra la nota en el renglón de la sopa.',
      ).toHaveCount(1);
      await expect(
        renglones.filter({ hasText: 'Arrachera al carbón' }).filter({ hasText: NOTA }),
        'La nota de la sopa salió en otro platillo.',
      ).toHaveCount(0);
      await capturar(tono, 'nota-por-comensal', aparato.id, 'cocina');
    } finally {
      await equipo.cerrar();
    }
  });
});
