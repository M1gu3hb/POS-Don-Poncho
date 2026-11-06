import { expect, test, type Page } from '@playwright/test';

import { mantenerPresionada } from '../ayudantes/tacto.ts';
import { consultarPuente, vigilarFallos } from '../ayudantes/sesion.ts';

import { anotar, escribir, Jornada } from './ayudantes-qa.ts';
import { abrirEstaciones, cobrarEnCaja, sacarTodo } from './flujos-qa.ts';
import { importe, PRECIO, type Renglon } from './carta-qa.ts';

/**
 * QA-1 · 05 · LA CÁMARA SIMULADA, LA PULSACIÓN LARGA Y EL MODO ESPERA.
 *   Mesero 1 (tableta) entra a /mesero SIN recargar (viene de /caja) y escanea con cámara simulada; la
 *   cámara se apaga al cerrar y, sin permiso, se elige la mesa de una lista; mantener presionada una mesa
 *   abre «Pedido del portal». Después, el modo espera: la caja duerme y la despierta una cuenta pedida,
 *   el mesero no duerme nunca, y una cocina duerme y la despierta una comanda nueva (mesa 19, que se cobra).
 */

test.use({
  launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] },
});

const M19: readonly Renglon[] = [
  { platillo: 'guacamole', veces: 1 },
  { platillo: 'corona', veces: 1 },
];

async function espiarLaCamara(pagina: Page): Promise<void> {
  await pagina.context().addInitScript(() => {
    const camaras: MediaStream[] = [];
    const ventana = window as unknown as { __camaras: MediaStream[]; __negarCamara?: boolean };
    ventana.__camaras = camaras;
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (pedido) => {
      if (ventana.__negarCamara === true) {
        throw new DOMException('El permiso de la cámara se negó.', 'NotAllowedError');
      }
      const flujo = await original(pedido);
      camaras.push(flujo);
      return flujo;
    };
  });
}

const vivas = (pagina: Page): Promise<number> =>
  pagina.evaluate(
    () =>
      (window as unknown as { __camaras: MediaStream[] }).__camaras
        .flatMap((f) => f.getTracks())
        .filter((t) => t.readyState === 'live').length,
  );

const espera = (p: Page) => p.getByRole('dialog', { name: /Modo espera/ });

test.describe('QA-1 · 05 · cámara, pulsación larga y modo espera', () => {
  // La cámara simulada falló una vez de siete corridas (no se reprodujo): un reintento, y el resumen lo cuenta.
  test.describe.configure({ retries: 1 });
  test('escáner con cámara simulada, globo de la mesa y modo espera de caja, mesero y cocina', async ({
    browser,
  }, info) => {
    test.setTimeout(15 * 60_000);
    const j = new Jornada(browser, info);
    const fallos: (() => void)[] = [];
    try {
      const duena = await j.pagina('Dueño Don Poncho', 'pc');
      const mesero = await j.pagina('Mesero 1', 'tableta');
      fallos.push(vigilarFallos(duena), vigilarFallos(mesero));
      await mesero.context().grantPermissions(['camera']);
      await espiarLaCamara(mesero);
      const escanear = mesero.getByRole('button', { name: 'Escanear QR' });
      const cerrar = mesero.getByRole('button', { name: 'Cerrar el escáner' });

      await test.step('entrando a /mesero SIN recargar (viene de /caja), «Escanear QR» recarga una vez y enciende', async () => {
        await mesero.goto('/caja');
        await mesero.waitForURL(/\/mesero$/);
        const cargadoEn = await mesero.evaluate(
          () => performance.getEntriesByType('navigation')[0]?.name ?? '',
        );
        expect(cargadoEn, 'La prueba no cruzó pantallas sin recargar.').toMatch(/\/caja$/);
        await escanear.click();
        await expect.poll(() => vivas(mesero), { message: 'La cámara no encendió.' }).toBe(1);
        await expect(mesero).toHaveURL(/\/mesero$/);
        await cerrar.click();
        await expect.poll(() => vivas(mesero), { message: 'La cámara quedó prendida.' }).toBe(0);
        anotar({
          aparato: 'tableta',
          quien: 'Mesero 1',
          accion: 'Entra a /mesero desde /caja sin recargar y toca «Escanear QR» (cámara simulada)',
          esperado: 'La cámara enciende (1 flujo vivo) y se apaga al cerrar el escáner (0)',
        });
      });

      await test.step('sin permiso de cámara se elige la mesa de una lista y se entra a su portal', async () => {
        await mesero.goto('/mesero');
        await mesero.evaluate(() => {
          (window as unknown as { __negarCamara: boolean }).__negarCamara = true;
        });
        await escanear.click();
        await expect(
          mesero.getByText('Permiso de cámara denegado', { exact: false }),
        ).toBeVisible();
        await mesero.getByRole('button', { name: 'Mesa 18', exact: true }).click();
        const portal = mesero.getByRole('dialog', { name: 'Portal de la mesa · modo mesero' });
        await expect(portal).toBeVisible();
        await portal.press('Escape');
        await expect(portal).toBeHidden();
      });

      await test.step('mantener presionada la mesa: «Ver QR de la mesa» y «Pedido del portal»', async () => {
        await mesero.goto('/mesero');
        const laMesa = mesero
          .locator('[data-mesa-id]')
          .filter({ hasText: /^\s*18(?!\d)/ })
          .first();
        await mantenerPresionada(mesero, info, laMesa);
        const globo = mesero.getByRole('menu', { name: 'Mesa 18' });
        await globo.getByRole('menuitem', { name: 'Ver QR de la mesa' }).click();
        const qr = mesero.getByRole('dialog', { name: 'QR de la mesa 18' });
        await expect(qr.locator('img[data-qr-de-la-mesa]')).toBeVisible();
        await qr.getByRole('button', { name: 'Cancelar' }).click();
        await expect(qr).toBeHidden();
        await mantenerPresionada(mesero, info, laMesa);
        await expect(globo).toBeVisible();
        await globo.getByRole('menuitem', { name: 'Pedido del portal' }).click();
        await expect(
          mesero.getByRole('dialog', { name: 'Portal de la mesa · modo mesero' }),
        ).toBeVisible();
        await mesero.keyboard.press('Escape');
        anotar({
          aparato: 'tableta',
          quien: 'Mesero 1',
          accion: 'Mantiene presionada la mesa 18: Ver QR y Pedido del portal',
          esperado: 'Se ve el QR grande; «Pedido del portal» abre el modo mesero sin escanear',
        });
      });

      // ═══ MODO ESPERA ═══
      const caja = await j.pagina('Caja', 'pc');
      const cocinaClock = await j.pagina('Bebidas', 'pc');
      fallos.push(vigilarFallos(caja), vigilarFallos(cocinaClock));
      await caja.clock.install();
      await caja.goto('/caja');
      await expect(caja.getByRole('heading', { level: 1 }).first()).toBeVisible();
      await cocinaClock.clock.install();
      await cocinaClock.goto('/cocina');
      await expect(cocinaClock.getByRole('heading', { level: 1 }).first()).toBeVisible();

      await test.step('la caja y la cocina duermen; el mesero nunca', async () => {
        await caja.clock.fastForward('03:10');
        await expect(espera(caja)).toBeVisible();
        await cocinaClock.clock.fastForward('02:10');
        await expect(espera(cocinaClock)).toBeVisible();
        await mesero.clock.install();
        await mesero.goto('/mesero');
        await mesero.clock.fastForward('10:00');
        await expect(mesero.locator('html')).toHaveAttribute('data-espera-decision', 'fuera');
        await expect(espera(mesero)).toHaveCount(0);
        anotar({
          aparato: 'pc',
          quien: 'Caja y Bebidas',
          accion: 'Pasan 3:10 (caja) y 2:10 (cocina) sin nada; el mesero pasa 10 minutos',
          esperado: 'Caja y cocina se duermen («Modo espera»); el mesero no',
        });
      });

      await test.step('una comanda nueva despierta la cocina y la cuenta pedida despierta la caja', async () => {
        const [mesa] = await consultarPuente<{ id: string }>(duena, 'Mesa', {
          filtro: { numero: 19 },
          limite: 1,
        });
        const productos = await consultarPuente<{ id: string; nombre: string }>(
          duena,
          'ProductoTerminado',
          { limite: 200 },
        );
        const id = (n: string) => productos.find((p) => p.nombre === n)?.id;
        const ap = await escribir(duena, '/api/restaurante/abrir-mesa', {
          mesaId: mesa?.id,
          personas: 2,
        });
        const ordenId = String(ap['ordenId']);
        await escribir(duena, '/api/restaurante/enviar-pedido', {
          ordenId,
          lineas: [
            { productoId: id(PRECIO.guacamole.nombre), cantidad: '1' },
            { productoId: id(PRECIO.corona.nombre), cantidad: '1' },
          ],
        });
        await cocinaClock.clock.runFor(6_000);
        await expect(espera(cocinaClock), 'La comanda nueva no despertó la cocina.').toHaveCount(0);
        await escribir(duena, '/api/restaurante/solicitar-cuenta', { ordenId });
        await caja.clock.runFor(6_000);
        await expect(espera(caja), 'La cuenta pedida no despertó la caja.').toHaveCount(0);
        anotar({
          aparato: 'pc',
          quien: 'Caja y Bebidas',
          accion: 'Entra una comanda (mesa 19) y se pide su cuenta',
          esperado: 'La cocina y la caja despiertan solas',
        });
        const estaciones = await abrirEstaciones(j);
        expect(await sacarTodo(estaciones, M19)).toBe(2);
        const venta = importe(M19);
        await caja.clock.resume();
        const hecho = await cobrarEnCaja(
          caja,
          /^Mesa 19 Cuenta/,
          'Mesa 19',
          { metodo: 'Efectivo', recibidoCentavos: 20_000 },
          'Sin propina',
        );
        expect(hecho).toMatchObject({
          ventaCentavos: venta,
          propinaCentavos: 0,
          cambioCentavos: 20_000 - venta,
        });
        anotar({
          aparato: 'pc',
          quien: 'Caja',
          accion: 'Cobra la mesa 19 en efectivo ($200 recibidos), sin propina',
          esperado: `venta ${String(venta)}, cambio ${String(20_000 - venta)}`,
          datos: {
            tipo: 'cobro',
            mesa: 19,
            caja: 'Caja',
            venta,
            propina: 0,
            efectivo: venta,
            tarjeta: 0,
            transferencia: 0,
            cambio: 20_000 - venta,
          },
        });
      });
      for (const exigir of fallos) exigir();
    } finally {
      await j.cerrar();
    }
  });
});
