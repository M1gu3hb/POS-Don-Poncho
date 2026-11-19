import { dialogoDeLaMesa, laMesa, yaAbierto } from '../ayudantes/mesas-heredadas.ts';
import { Equipo } from '../ayudantes/roles.ts';
import { exigirDemostracion } from '../ayudantes/sesion.ts';

import { navegadorDe, prepararContexto } from './arnes/ligero.ts';
import { expect, exigirServidor, test } from './arnes/prueba.ts';
import { abrirTeclado } from './arnes/teclado.ts';
import { toque } from './arnes/toque.ts';
import { vigilarPagina } from './arnes/vigilancia.ts';
import { SLUG, capturar, mandar, mesaConPedido, resetearLaDemo } from './parte7/comun.ts';

/**
 * DP-22 · LOS HALLAZGOS VISUALES QUE QUEDABAN ABIERTOS (34, 35, 38 y el resto del 5), con el dedo.
 *
 *  · 34 · teléfono: con el teclado abierto al buscar, la barra flotante «Solicitar cuenta» no tapa
 *    la primera tarjeta del resultado.
 *  · 35 · con la cuenta ya pedida, la mesa tiene un camino visible para imprimir otra hoja de la
 *    precuenta (y la pantalla explica por qué el total espera al servidor).
 *  · 38 · con la cuenta ya pedida, el mesero conserva «Cambiar de mesa» (el servidor lo permite).
 *
 * Las capturas quedan en `qa/qa-final/capturas/parte7/visual/<aparato>/`.
 */

const MESA = 5;

/** ¿Se cruzan dos cajas? (con un píxel de tolerancia por el redondeo) */
function seCruzan(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  return (
    a.x < b.x + b.width - 1 &&
    b.x < a.x + a.width - 1 &&
    a.y < b.y + b.height - 1 &&
    b.y < a.y + a.height - 1
  );
}

test.describe('visual pendientes · el mesero', () => {
  test.use({ actionTimeout: 60_000, navigationTimeout: 120_000 });

  test.beforeAll(async ({ playwright }, info) => {
    await exigirServidor(info.project.use.baseURL);
    await exigirDemostracion(playwright, info, SLUG);
  });

  test('34 · con el teclado abierto al buscar, la barra «Solicitar cuenta» no tapa el resultado', async ({
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
        await buscador.fill('');
        await buscador.pressSequentially('limon', { delay: 15 });
        const resultado = mesa.getByRole('button', { name: /^Limonada natural 500 ml/ });
        await expect(resultado).toBeVisible();
        const tarjeta = await resultado.boundingBox();
        expect(tarjeta, 'El resultado no tiene caja.').not.toBeNull();
        // La barra flotante: o se esconde mientras se escribe, o no se cruza con el resultado.
        const barra = lupita.getByRole('button', { name: /Solicitar cuenta/ });
        for (const candidata of await barra.all()) {
          if (!(await candidata.isVisible())) continue;
          const caja = await candidata.boundingBox();
          if (caja === null || tarjeta === null) continue;
          expect(
            seCruzan(caja, tarjeta),
            'La barra flotante «Solicitar cuenta» tapa la tarjeta del resultado de la búsqueda.',
          ).toBe(false);
        }
        await capturar(lupita, 'visual', aparato.id, '34-buscar-con-teclado');
      } finally {
        await teclado.cerrar();
      }
      // Sin teclado (el buscador soltó el foco), la barra vuelve: «Solicitar cuenta» sigue a mano.
      await buscador.blur();
      await expect(
        lupita.getByRole('button', { name: /Solicitar cuenta/ }).first(),
        'Al cerrar el teclado la barra «Solicitar cuenta» no volvió.',
      ).toBeVisible();
    } finally {
      await equipo.cerrar();
    }
  });

  test('35 y 38 · con la cuenta pedida: «Imprimir otra hoja» y «Cambiar de mesa» a la mano', async ({
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
      await mandar(lupita, '/api/restaurante/solicitar-cuenta', {
        ordenId: abierta.ordenId,
        propinaTipo: 'sin_propina',
      });
      await lupita.goto('/mesero', { waitUntil: 'domcontentloaded' });
      await toque(lupita, laMesa(lupita, MESA));
      const mesa = dialogoDeLaMesa(lupita, MESA);
      await yaAbierto(mesa);

      // En el teléfono el pedido vive en la barra de abajo y su hoja; en la tableta, en el panel.
      const enTelefono = (lupita.viewportSize()?.width ?? 1024) < 768;
      if (enTelefono) {
        await toque(lupita, lupita.getByRole('button', { name: /Cuenta pedida/ }).first());
      }
      const cambiar = mesa.getByRole('button', { name: 'Cambiar de mesa' }).first();
      await expect(
        cambiar,
        '38 · Con la cuenta ya pedida, el mesero se quedó sin «Cambiar de mesa».',
      ).toBeVisible();
      const otraHoja = mesa.getByRole('link', { name: /Imprimir otra hoja/ }).first();
      await expect(
        otraHoja,
        '35 · Con la cuenta ya pedida, la mesa no ofrece imprimir otra hoja de la precuenta.',
      ).toBeVisible();
      await capturar(lupita, 'visual', aparato.id, '35-38-cuenta-pedida');
      const cajaCambiar = await cambiar.boundingBox();
      const cajaHoja = await otraHoja.boundingBox();
      expect(cajaCambiar?.height ?? 0, 'Cambiar de mesa: menos de 44 px').toBeGreaterThanOrEqual(
        44,
      );
      expect(cajaHoja?.height ?? 0, 'Imprimir otra hoja: menos de 44 px').toBeGreaterThanOrEqual(
        44,
      );

      await toque(lupita, otraHoja);
      await expect(lupita).toHaveURL(/\/restaurante\/precuenta\?cuenta=/);
      await expect(lupita.getByRole('button', { name: /Imprimir/ }).first()).toBeVisible();
      await capturar(lupita, 'visual', aparato.id, '35-la-precuenta');
    } finally {
      await equipo.cerrar();
    }
  });
});

test.describe('visual pendientes · la barra lateral en una pantalla baja', () => {
  test.use({ actionTimeout: 60_000, navigationTimeout: 120_000 });

  test.beforeAll(async ({ playwright }, info) => {
    await exigirServidor(info.project.use.baseURL);
    await exigirDemostracion(playwright, info, SLUG);
  });

  test('5 · si el menú tiene más por desplazar, se nota; al llegar al final, el aviso se va', async ({
    browser,
    aparato,
  }, info) => {
    test.skip(aparato.id !== 'win-1366x768-125', 'La pantalla baja es la de Windows al 125 %.');
    test.setTimeout(5 * 60_000);
    const equipo = new Equipo(navegadorDe(browser, aparato), SLUG);
    try {
      const duena = await equipo.pagina(info, 'dueno');
      await prepararContexto(duena.context(), aparato);
      vigilarPagina(duena);
      await duena.goto('/configuracion', { waitUntil: 'domcontentloaded' });
      const menu = duena.getByRole('navigation', { name: 'Menú principal' });
      await expect(menu).toBeVisible();
      const medidas = async () =>
        menu.evaluate((el) => ({
          sobra: el.scrollHeight - el.scrollTop - el.clientHeight,
          total: el.scrollHeight - el.clientHeight,
        }));
      const inicio = await medidas();
      expect(
        inicio.total,
        'El menú cabe entero: la pantalla no es lo bastante baja para probar el aviso.',
      ).toBeGreaterThan(2);
      const aviso = duena.locator('[data-mas-por-desplazar]');
      await expect(
        aviso,
        'El menú se desplaza y nada lo dice: «Compras» queda cortado sin pista.',
      ).toBeVisible();
      await capturar(duena, 'visual', aparato.id, '5-menu-con-mas');
      await menu.evaluate((el) => {
        el.scrollTop = el.scrollHeight;
      });
      await expect(aviso, 'Al llegar al final del menú el aviso sigue puesto.').toHaveCount(0);
      await capturar(duena, 'visual', aparato.id, '5-menu-al-final');
    } finally {
      await equipo.cerrar();
    }
  });
});
