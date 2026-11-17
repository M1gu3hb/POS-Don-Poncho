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
import {
  cabecerasDeEscrituraDePrueba,
  consultarPuente,
  exigirDemostracion,
} from '../ayudantes/sesion.ts';

import { navegadorDe, prepararContexto } from './arnes/ligero.ts';
import { expect, exigirServidor, test } from './arnes/prueba.ts';
import { toque } from './arnes/toque.ts';
import { vigilarPagina } from './arnes/vigilancia.ts';

import type { Page } from '@playwright/test';

/**
 * H5 · A7 · EL PEDIDO PARA LLEVAR QUE SE DEJA A MEDIAS NO SE ARRASTRA AL SIGUIENTE (cobro doble).
 *
 * El borrador del pedido para llevar vive en el aparato (localStorage) y sobrevive a una recarga.
 * Antes: (1) se borraba hasta que el diálogo de cobro se cerraba, y una recarga entre el cobro y el
 * cierre lo dejaba vivo; (2) un borrador que quedó de antes se mezclaba en silencio con el pedido
 * nuevo. El arreglo (DP-18): se borra AL COBRAR y un borrador de antes se PREGUNTA («Quedó un pedido
 * sin terminar»: retomarlo o descartarlo).
 *
 * Qué se mira, en el navegador y con dedo (tableta):
 *   · A7-a · se deja un pedido a medias y se recarga: al volver a abrir NO se mezcla, se pregunta; se
 *     descarta, se arma otro, y lo cobrado es sólo lo nuevo (el servidor lo confirma).
 *   · A7-b · el borrador se borra en el instante del cobro, con el diálogo de cobro todavía abierto
 *     (no cuando se cierra); y tras recargar, el pedido siguiente arranca vacío.
 *
 * La evidencia es el mutante: con `pedidoSinTerminar` devolviendo siempre `false` cae A7-a; con el
 * borrado de vuelta en el `useEffect` del cierre del cobro cae A7-b.
 */

const SLUG = 'prueba-restaurante';
const PERFIL_DE_LA_PRUEBA = 'tableta-800x1280';
const PREFIJO_DEL_BORRADOR = 'morphiqpos.borrador-del-pedido.v1.';

/** Espía de `localStorage.removeItem`: dice si el cobro seguía abierto cuando se borró el borrador. */
const ESPIA_DEL_BORRADO = `(() => {
  const original = Storage.prototype.removeItem;
  window.__borrados = [];
  Storage.prototype.removeItem = function (clave) {
    if (String(clave).startsWith('${PREFIJO_DEL_BORRADOR}')) {
      const abierto = document.querySelector('[role="dialog"][data-state="open"]');
      window.__borrados.push({
        clave: String(clave),
        cobroAbierto: abierto !== null && /Cobrar —/.test(abierto.textContent || ''),
      });
    }
    return original.apply(this, arguments);
  };
})();`;

async function abrirParaLlevar(page: Page) {
  await toque(page, page.getByRole('button', { name: /^Para llevar/ }));
  const dialogo = page.getByRole('dialog', { name: 'Pedido para llevar' });
  await yaAbierto(dialogo);
  return dialogo;
}

const tesela = (nombre: string) => new RegExp(`^${nombre} \\$`);

test.describe('A7 · el para llevar a medias no se arrastra (tableta)', () => {
  test.use({ actionTimeout: 120_000, navigationTimeout: 240_000 });

  test.beforeAll(async ({ playwright }, info) => {
    await exigirServidor(info.project.use.baseURL);
    await exigirDemostracion(playwright, info, SLUG);
  });

  test('lo dejado a medias se pregunta, lo cobrado se borra al cobrar y el siguiente arranca limpio', async ({
    browser,
    aparato,
  }, info) => {
    test.skip(aparato.id !== PERFIL_DE_LA_PRUEBA, `A7 se mide en ${PERFIL_DE_LA_PRUEBA}.`);
    test.setTimeout(10 * 60_000);
    const equipo = new Equipo(navegadorDe(browser, aparato), SLUG);
    try {
      const duena = await equipo.pagina(info, 'dueno');
      await prepararContexto(duena.context(), aparato);
      const resetear = await duena.request.post('/api/pruebas/resetear', {
        headers: cabecerasDeEscrituraDePrueba(),
        data: { confirmacion: 'RESETEAR' },
      });
      expect(resetear.status(), await resetear.text()).toBe(200);

      const rosa = await equipo.pagina(info, 'cajero');
      await prepararContexto(rosa.context(), aparato);
      vigilarPagina(rosa);
      await rosa.addInitScript(ESPIA_DEL_BORRADO);
      await rosa.goto('/caja', { waitUntil: 'domcontentloaded' });
      if ((await sesionDeLaCaja(rosa)) === null) await abrirLaCaja(rosa, 150_000);

      // ── A7-a · un pedido a medias y una recarga ────────────────────────────────────────────
      let dialogo = await abrirParaLlevar(rosa);
      await toque(rosa, dialogo.getByRole('button', { name: tesela(CARTA.guacamole.nombre) }));
      await expect(dialogo.getByRole('button', { name: /^Cobrar \$125\.00/ })).toBeVisible();
      await expect
        .poll(() =>
          rosa.evaluate((prefijo) => {
            const claves: string[] = [];
            for (let i = 0; i < localStorage.length; i += 1) {
              const clave = localStorage.key(i);
              if (clave?.startsWith(prefijo) === true) claves.push(clave);
            }
            return claves.length;
          }, PREFIJO_DEL_BORRADOR),
        )
        .toBe(1);

      await rosa.reload({ waitUntil: 'domcontentloaded' });
      dialogo = await abrirParaLlevar(rosa);
      await expect(
        dialogo.getByText('Quedó un pedido sin terminar'),
        'El pedido que quedó de antes se mezcló en silencio con el nuevo (A7).',
      ).toBeVisible();
      await toque(rosa, dialogo.getByRole('button', { name: 'Descartarlo y empezar uno nuevo' }));
      await toque(rosa, dialogo.getByRole('button', { name: tesela(CARTA.sopa.nombre) }));
      // Sólo lo nuevo: la sopa ($115.00), no la sopa más el guacamole que se había dejado.
      await expect(dialogo.getByRole('button', { name: /^Cobrar \$115\.00/ })).toBeVisible();

      // ── A7-b · el borrador se borra AL COBRAR, no al cerrar el cobro ─────────────────────────
      await rosa.evaluate(() => {
        (window as unknown as { __borrados: unknown[] }).__borrados = [];
      });
      const [armado] = await Promise.all([
        rosa.waitForResponse(
          (r) =>
            new URL(r.url()).pathname === '/api/restaurante/armar-para-llevar' &&
            r.request().method() === 'POST',
        ),
        toque(rosa, dialogo.getByRole('button', { name: /^Cobrar \$115\.00/ })),
      ]);
      expect(armado.status(), await armado.text()).toBe(200);
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
      const salida = await leerElCobro(respuesta);
      expect(salida.estado, salida.mensaje ?? '').toBe(200);
      await cerrarElTicket(rosa);

      const borrados = await rosa.evaluate(
        () => (window as unknown as { __borrados: { cobroAbierto: boolean }[] }).__borrados,
      );
      expect(
        borrados.some((b) => b.cobroAbierto),
        `El borrador no se borró al cobrar sino al cerrar el cobro (A7): ${JSON.stringify(borrados)}`,
      ).toBe(true);

      // Lo cobrado es sólo lo nuevo (el servidor lo dice, no la pantalla).
      const ordenId = salida.datos?.ordenId ?? '';
      expect(ordenId).not.toBe('');
      const lineas = await consultarPuente<{ producto_nombre?: string }>(duena, 'DetalleVenta', {
        filtro: { venta_id: ordenId },
        limite: 20,
      });
      expect(lineas.map((l) => l.producto_nombre)).toEqual([CARTA.sopa.nombre]);

      // El pedido siguiente, aun tras recargar, arranca vacío y sin preguntar.
      await rosa.reload({ waitUntil: 'domcontentloaded' });
      dialogo = await abrirParaLlevar(rosa);
      await expect(dialogo.getByText('Quedó un pedido sin terminar')).toHaveCount(0);
      await expect(dialogo.getByText('Toca los platillos para agregarlos')).toBeVisible();
      await expect(dialogo.getByRole('button', { name: /^Cobrar \$0\.00/ })).toBeDisabled();
    } finally {
      await equipo.cerrar();
    }
  });
});
