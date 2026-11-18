import { abrirLaMesa, armarElPedido, botonDeLaMesa, laMesa } from '../ayudantes/mesas-heredadas.ts';
import { Equipo } from '../ayudantes/roles.ts';
import { cabecerasDeEscrituraDePrueba, exigirDemostracion } from '../ayudantes/sesion.ts';

import { navegadorDe } from './arnes/ligero.ts';
import { expect, exigirServidor, test } from './arnes/prueba.ts';
import { toque } from './arnes/toque.ts';
import { vigilarPagina } from './arnes/vigilancia.ts';

/**
 * LA PREGUNTA DEL ANUNCIO EN COCINA (DP-22): «¿Esta pantalla anuncia las comandas en voz?»
 * (`apps/web/src/cocina/PreguntaDelAnuncio.tsx`). Con el dedo, en cada aparato:
 *
 *  · sale UNA sola tarjeta, la primera vez que el aparato abre Cocina sin haber elegido;
 *  · NO tapa las comandas: es una tarjeta en el flujo (no flotante) y no se cruza con ninguna;
 *  · se contesta con el dedo (los dos botones son blancos de 44 px) y se guarda en el aparato;
 *  · no vuelve: ni al recargar ni al volver a entrar a la pantalla.
 */

const SLUG = 'prueba-restaurante';
const MESA = 2;

test.describe('la pregunta del anuncio de Cocina', () => {
  test.use({ actionTimeout: 30_000, navigationTimeout: 60_000 });

  test.beforeAll(async ({ playwright }, info) => {
    await exigirServidor(info.project.use.baseURL);
    await exigirDemostracion(playwright, info, SLUG);
  });

  test('sale una vez, se contesta con el dedo y no tapa las comandas', async ({
    browser,
    aparato,
  }, info) => {
    test.setTimeout(8 * 60_000);
    const equipo = new Equipo(navegadorDe(browser, aparato), SLUG);
    try {
      const duena = await equipo.pagina(info, 'dueno');
      const reseteo = await duena.request.post('/api/pruebas/resetear', {
        headers: cabecerasDeEscrituraDePrueba(),
        data: { confirmacion: 'RESETEAR' },
        timeout: 120_000,
      });
      expect(reseteo.status(), 'resetear la demo').toBe(200);

      // Una comanda en la cocina, mandada por el mesero.
      const mesero = await equipo.pagina(info, 'mesero');
      mesero.setDefaultTimeout(30_000);
      await mesero.goto('/mesero', { waitUntil: 'domcontentloaded' });
      await expect(laMesa(mesero, MESA)).toBeVisible();
      await abrirLaMesa(mesero, duena, MESA, 2);
      await armarElPedido(mesero, MESA, [{ nombre: 'Guacamole con totopos', veces: 1 }]);
      const enviada = mesero.waitForResponse(
        (r) =>
          new URL(r.url()).pathname === '/api/restaurante/enviar-pedido' &&
          r.request().method() === 'POST',
      );
      await (await botonDeLaMesa(mesero, MESA, 'Enviar a Cocina')).click();
      expect((await enviada).status(), 'enviar-pedido').toBe(200);

      // Cocina, con un aparato que nunca ha contestado.
      const cocina = await equipo.pagina(info, 'cocina');
      cocina.setDefaultTimeout(30_000);
      vigilarPagina(cocina);
      await cocina.goto('/cocina', { waitUntil: 'domcontentloaded' });
      const pregunta = cocina.getByRole('region', { name: 'Esta pantalla anuncia las comandas' });
      await expect(pregunta, 'una sola pregunta').toHaveCount(1);
      await expect(pregunta).toBeVisible();
      const preparar = cocina.getByRole('button', { name: 'Preparar', exact: true }).first();
      await expect(preparar, 'la comanda llegó a Cocina').toBeVisible();

      // No tapa: está en el flujo y sus cajas no se cruzan con ninguna comanda.
      const cajaDeLaPregunta = await pregunta.boundingBox();
      const cajaDeLaComanda = await preparar.boundingBox();
      expect(cajaDeLaPregunta, 'la pregunta se ve').not.toBeNull();
      expect(cajaDeLaComanda, 'la comanda se ve').not.toBeNull();
      const posicion = await pregunta.evaluate((e) => getComputedStyle(e).position);
      expect(['fixed', 'sticky', 'absolute'], 'la pregunta flota sobre la pantalla').not.toContain(
        posicion,
      );
      const hondo = (cajaDeLaPregunta?.y ?? 0) + (cajaDeLaPregunta?.height ?? 0);
      expect(
        cajaDeLaComanda?.y ?? 0,
        'la comanda queda debajo de la pregunta, sin cruzarse',
      ).toBeGreaterThanOrEqual(hondo - 1);
      // Y la comanda se puede tocar (nada encima): ya a la vista, el toque cae en ella.
      await preparar.scrollIntoViewIfNeeded();
      const tapa = await preparar.evaluate((e) => {
        const c = e.getBoundingClientRect();
        const golpe = document.elementFromPoint(c.x + c.width / 2, c.y + c.height / 2);
        if (golpe !== null && (e === golpe || e.contains(golpe))) return null;
        return golpe === null
          ? 'nada (fuera de la ventana)'
          : `${golpe.tagName.toLowerCase()} «${(golpe.getAttribute('aria-label') ?? golpe.textContent ?? '').trim().slice(0, 40)}»`;
      });
      expect(tapa, 'algo tapa el botón «Preparar»').toBeNull();

      // Los dos botones se tocan con el dedo y miden 44 px como mínimo.
      for (const nombre of [/^Sí, anunciar aquí/, /^No, ya hay otra/]) {
        const boton = pregunta.getByRole('button', { name: nombre });
        const caja = await boton.boundingBox();
        expect(caja?.height ?? 0, `${String(nombre)} mide menos de 44 px`).toBeGreaterThanOrEqual(
          43.5,
        );
      }
      await toque(cocina, pregunta.getByRole('button', { name: /^Sí, anunciar aquí/ }));
      await expect(pregunta, 'se contestó y la tarjeta se va').toHaveCount(0);

      // No vuelve: ni al recargar ni al salir y volver a entrar.
      await cocina.reload({ waitUntil: 'domcontentloaded' });
      await expect(
        cocina.getByRole('button', { name: 'Preparar', exact: true }).first(),
      ).toBeVisible();
      await expect(pregunta, 'no se vuelve a preguntar al recargar').toHaveCount(0);
      await cocina.goto('/caja', { waitUntil: 'domcontentloaded' }).catch(() => undefined);
      await cocina.goto('/cocina', { waitUntil: 'domcontentloaded' });
      await expect(
        cocina.getByRole('button', { name: 'Preparar', exact: true }).first(),
      ).toBeVisible();
      await expect(pregunta, 'no se vuelve a preguntar al volver').toHaveCount(0);
    } finally {
      await equipo.cerrar();
    }
  });
});
