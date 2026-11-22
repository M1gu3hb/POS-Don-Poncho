import { sesionDeLaCaja } from '../../ayudantes/conciliacion.ts';
import {
  CARTA,
  cuentaEnElServidor,
  leerElCobro,
  pagosDeLaCuenta,
  yaAbierto,
} from '../../ayudantes/mesas-heredadas.ts';
import { abrirConReloj, espera, experiencia, pinDe } from '../../ayudantes/modo-espera.ts';
import { Equipo, personaDe } from '../../ayudantes/roles.ts';
import { exigirDemostracion } from '../../ayudantes/sesion.ts';
import { navegadorDe, prepararContexto } from '../arnes/ligero.ts';
import { expect, exigirServidor, test } from '../arnes/prueba.ts';
import { toque } from '../arnes/toque.ts';
import { capturar, mandar, mesaConPedido, resetearLaDemo, sqlLocal } from '../parte7/comun.ts';
import { abrirLaCaja } from '../../ayudantes/mesas-heredadas.ts';

/**
 * DIRECTA 3 · UN COBRO A MEDIO TECLEAR CUANDO ENTRA EL MODO ESPERA.
 *
 * En Caja se abre el cobro de una cuenta (arrachera + cerveza = $384.00), se elige Efectivo y se teclea
 * un importe a medias ($300). El reloj de la página avanza 3 min 10 s: entra el modo espera (con
 * «Pedir PIN al despertar» encendido). Se despierta y se teclea el PIN de la cajera con los botones de
 * la pantalla. El cobro sigue abierto con el importe tecleado; se completa a $500: total $384.00,
 * cambio $116.00, y la venta queda UNA sola vez.
 */
const SLUG = 'prueba-restaurante';
const MESA = 3;
const TOTAL = CARTA.arrachera.centavos + CARTA.cerveza.centavos;

test.describe('D3 · modo espera con el cobro a medio teclear', () => {
  test.use({ actionTimeout: 60_000, navigationTimeout: 120_000 });

  test.beforeAll(async ({ playwright }, info) => {
    await exigirServidor(info.project.use.baseURL);
    await exigirDemostracion(playwright, info, SLUG);
  });

  test('D3 · el cobro sigue abierto con lo tecleado al volver con el PIN y se cobra una sola vez', async ({
    browser,
    aparato,
  }, info) => {
    test.setTimeout(8 * 60_000);
    const equipo = new Equipo(navegadorDe(browser, aparato), SLUG);
    const pin = personaDe(SLUG, 'cajero').pin;
    const duena = await equipo.pagina(info, 'dueno');
    try {
      await prepararContexto(duena.context(), aparato);
      await resetearLaDemo(duena);
      await experiencia(duena, { pin_al_despertar: true });
      const { ordenId } = await mesaConPedido(duena, duena, MESA, [
        { nombre: CARTA.arrachera.nombre },
        { nombre: CARTA.cerveza.nombre },
      ]);
      await mandar(duena, '/api/restaurante/solicitar-cuenta', {
        ordenId,
        aunConPendientes: true,
        propinaTipo: 'sin_propina',
      });

      const rosa = await equipo.pagina(info, 'cajero');
      await prepararContexto(rosa.context(), aparato);
      await abrirConReloj(rosa, '/caja');
      await rosa.getByRole('tab', { name: /^Pendientes/ }).waitFor({ timeout: 90_000 });
      if ((await sesionDeLaCaja(rosa)) === null) await abrirLaCaja(rosa, 150_000);

      await toque(rosa, rosa.getByRole('tab', { name: /^Pendientes/ }));
      await toque(
        rosa,
        rosa.getByRole('button', { name: new RegExp(`^Mesa ${String(MESA)} Cuenta`) }),
      );
      const cobro = rosa.getByRole('dialog').filter({ hasText: `Cobrar — Mesa ${String(MESA)}` });
      await yaAbierto(cobro);
      await toque(rosa, cobro.getByRole('button', { name: 'Efectivo', exact: true }));
      const importe = cobro.getByPlaceholder('0.00');
      await importe.fill('300.00');
      await capturar(rosa, 'directas', aparato.id, 'd3-1-cobro-a-medias');

      // Entra el modo espera.
      await rosa.clock.fastForward('03:10');
      await expect(espera(rosa)).toBeVisible();
      await capturar(rosa, 'directas', aparato.id, 'd3-2-modo-espera');
      await toque(rosa, espera(rosa));
      await expect(espera(rosa)).toHaveAttribute('data-modo-espera', 'despertando');
      await toque(rosa, espera(rosa));
      const candado = pinDe(rosa);
      await expect(candado).toBeVisible();
      await capturar(rosa, 'directas', aparato.id, 'd3-3-pide-pin');
      for (const digito of pin) {
        await toque(rosa, candado.getByRole('button', { name: digito, exact: true }));
      }
      await expect(candado).toHaveCount(0);
      await expect(espera(rosa)).toHaveCount(0);

      // El cobro sigue abierto, con lo tecleado.
      await expect(cobro, 'El cobro se cerró al volver del modo espera.').toBeVisible();
      await expect(importe, 'El importe tecleado se perdió.').toHaveValue('300.00');
      await capturar(rosa, 'directas', aparato.id, 'd3-4-de-vuelta');

      // Se termina el cobro: $500 recibidos, total $384.00, cambio $116.00.
      await importe.fill('500.00');
      const [respuesta] = await Promise.all([
        rosa.waitForResponse((r) => new URL(r.url()).pathname === '/api/venta/cobrar'),
        toque(rosa, cobro.getByRole('button', { name: /^Cobrar \$/ })),
      ]);
      const salida = await leerElCobro(respuesta);
      expect(salida.estado, salida.mensaje ?? '').toBe(200);
      expect(Number(salida.datos?.totalCentavos)).toBe(TOTAL);
      expect(Number(salida.datos?.cambioCentavos)).toBe(50_000 - TOTAL);
      await capturar(rosa, 'directas', aparato.id, 'd3-5-ticket');

      const cuenta = await cuentaEnElServidor(duena, ordenId);
      expect(cuenta.estado).toBe('pagada');
      expect(cuenta.totalCentavos).toBe(TOTAL);
      const pagos = await pagosDeLaCuenta(duena, ordenId);
      expect(pagos.efectivo).toBe(TOTAL);
      expect(pagos.cambio).toBe(50_000 - TOTAL);
      const filas = Number(sqlLocal(`select count(*) from pagos where orden_id = '${ordenId}'`));
      console.warn(`D3 filas de pago de la cuenta: ${String(filas)}`);
      expect(filas).toBe(1);
    } finally {
      await experiencia(duena, { pin_al_despertar: false }).catch(() => undefined);
      await equipo.cerrar();
    }
  });
});
