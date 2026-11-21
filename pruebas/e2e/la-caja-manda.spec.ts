import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Page, type TestInfo } from '@playwright/test';

import {
  abrirLaTarjeta,
  cajaTactil,
  cobrarConElDedo,
  MEDIANA,
  totalACobrar,
} from './ayudantes/caja-tactil.ts';
import { pedirLaCuenta } from './ayudantes/cancelar-desde-la-mesa.ts';
import { sesionDeLaCaja } from './ayudantes/conciliacion.ts';
import {
  abrirLaCaja,
  abrirLaMesa,
  alMapa,
  CARTA,
  cerrarElTicket,
  comandar,
  comandasDeLaCuenta,
  cuentaEnElServidor,
  esperadoDelCajon,
  importeDe,
  pagosDeLaCuenta,
  yaAbierto,
  type PlatilloPedido,
} from './ayudantes/mesas-heredadas.ts';
import { Equipo, personaDe } from './ayudantes/roles.ts';
import {
  cabecerasDeEscrituraDePrueba,
  exigirDemostracion,
  vigilarFallos,
} from './ayudantes/sesion.ts';

/**
 * DP-24 · «LA CAJA MANDA»: lo que la cajera hace con la cuenta SIN salir de la tarjeta de cobro, y
 * las propinas en el corte. Con el dedo, en la pantalla de 1024×768.
 *
 *   1 · «Agregar»: el mismo buscador y la misma rejilla; lo agregado sale a cocina y sube el total.
 *   2 · «Para llevar»: igual, y va marcado PARA LLEVAR en la cuenta.
 *   3 · Quitar un platillo: motivo obligatorio y, siendo la cajera, el PIN de un gerente. Sin PIN el
 *       botón no se enciende.
 *   4 · Cobra con 10 % de propina en efectivo.
 *   5 · El corte: «Propinas del día» por persona (la mesera que atendió, con su cuenta y su importe)
 *       y «Liquidar» con el PIN de un gerente; lo entregado SALE DEL CAJÓN: el efectivo esperado
 *       baja lo mismo y la caja cierra con ese conteo.
 *
 * El dinero se comprueba contra el servidor. Corre en serie (`--workers=1`): resetea la demo.
 */

const SLUG = 'prueba-restaurante';
const MESA = 2;
const FONDO_CENTAVOS = 150_000;
const PEDIDO: readonly PlatilloPedido[] = [
  { nombre: CARTA.arrachera.nombre, veces: 1 },
  { nombre: CARTA.cerveza.nombre, veces: 2 },
];
const SOPA: readonly PlatilloPedido[] = [{ nombre: CARTA.sopa.nombre, veces: 1 }];
const GUACAMOLE: readonly PlatilloPedido[] = [{ nombre: CARTA.guacamole.nombre, veces: 1 }];
const PEDIDO_CENTAVOS = importeDe(PEDIDO);
const SOPA_CENTAVOS = importeDe(SOPA);
const GUACAMOLE_CENTAVOS = importeDe(GUACAMOLE);
/** Lo que se cobra: el pedido y el guacamole para llevar (la sopa se quita). */
const VENTA = PEDIDO_CENTAVOS + GUACAMOLE_CENTAVOS;
const PROPINA = Math.round(VENTA * 0.1);
const CAPTURAS = process.env['MORPHIQPOS_CAPTURAS'];

/** «$689.00», como lo pinta la tarjeta (importes de menos de mil pesos). */
const enPantalla = (centavos: number): string => `$${(centavos / 100).toFixed(2)}`;
const pesos = (centavos: number): string => (centavos / 100).toFixed(2);
/** El mosaico de un platillo en la rejilla: «Sopa de tortilla $115.00». */
const tesela = (nombre: string): RegExp => new RegExp(`^${nombre} \\$`);

async function retratar(caja: Page, info: TestInfo, nombre: string): Promise<void> {
  const carpeta = CAPTURAS ?? info.outputDir;
  mkdirSync(carpeta, { recursive: true });
  await caja.screenshot({ path: join(carpeta, `la-caja-manda-${nombre}.png`) });
}

const ruta = (r: { url(): string }): string => new URL(r.url()).pathname;

test.describe('la Caja manda: agregar, para llevar, quitar con PIN y propinas en el corte', () => {
  test.use({ actionTimeout: 20_000, navigationTimeout: 30_000 });

  test.beforeAll(async ({ playwright }, info) => {
    await exigirDemostracion(playwright, info, SLUG);
  });

  test('la cajera cambia la cuenta desde la tarjeta, cobra y liquida la propina en el corte', async ({
    browser,
  }, info) => {
    test.skip(
      info.project.name !== 'escritorio',
      'La caja es la PC táctil: la prueba pone su tamaño.',
    );
    test.setTimeout(12 * 60_000);
    const equipo = new Equipo(browser, SLUG);
    try {
      const duena = await equipo.pagina(info, 'dueno');
      const reinicio = await duena.request.post('/api/pruebas/resetear', {
        headers: cabecerasDeEscrituraDePrueba(),
        data: { confirmacion: 'RESETEAR' },
        timeout: 120_000,
      });
      expect(reinicio.status(), `resetear: ${await reinicio.text()}`).toBe(200);
      const gerente = personaDe(SLUG, 'gerente');
      const mesera = personaDe(SLUG, 'mesero');
      const rosa = await equipo.pagina(info, 'cajero');
      const lupita = await equipo.pagina(info, 'mesero');
      await rosa.goto('/');
      await rosa.waitForURL(/\/caja$/);
      await lupita.goto('/');
      await lupita.waitForURL(/\/mesero$/);
      if ((await sesionDeLaCaja(rosa)) === null) await abrirLaCaja(rosa, FONDO_CENTAVOS);

      const { ordenId } = await abrirLaMesa(lupita, duena, MESA, 2);
      await comandar(lupita, MESA, PEDIDO);
      await alMapa(lupita);
      await pedirLaCuenta(lupita, ordenId);
      const comandasAlPedir = (await comandasDeLaCuenta(duena, ordenId)).length;

      const caja = await cajaTactil(browser, info, rosa, MEDIANA);
      const fallos = vigilarFallos(caja);
      const tarjeta = await abrirLaTarjeta(caja, MESA);
      await expect(totalACobrar(tarjeta)).toHaveText(enPantalla(PEDIDO_CENTAVOS));

      await test.step('«Agregar»: la sopa entra a la cuenta, sale a cocina y sube el total', async () => {
        await tarjeta.getByRole('button', { name: 'Agregar a la cuenta', exact: true }).tap();
        const agregar = caja
          .getByRole('dialog')
          .filter({ hasText: 'Sale a cocina al agregarlo y se cobra con esta cuenta.' });
        await yaAbierto(agregar);
        await agregar.getByRole('button', { name: tesela(CARTA.sopa.nombre) }).tap();
        await retratar(caja, info, '1-agregar');
        const agregado = caja.waitForResponse(
          (r) => ruta(r) === '/api/restaurante/agregar-en-caja',
        );
        await agregar.getByRole('button', { name: /^Agregar a la cuenta \$/ }).tap();
        expect((await agregado).status(), 'El servidor no agregó la sopa.').toBe(200);
        await expect(agregar).toBeHidden();
        await expect(totalACobrar(tarjeta)).toHaveText(enPantalla(PEDIDO_CENTAVOS + SOPA_CENTAVOS));
        const cuenta = await cuentaEnElServidor(duena, ordenId);
        // Sigue «pedida»: la cuenta no vuelve a la mesa por agregarle desde la caja.
        expect([cuenta.estado, cuenta.totalCentavos]).toEqual([
          'cuenta_solicitada',
          PEDIDO_CENTAVOS + SOPA_CENTAVOS,
        ]);
        const comandas = await comandasDeLaCuenta(duena, ordenId);
        expect(comandas.length, 'La sopa no salió a cocina.').toBe(comandasAlPedir + 1);
      });

      await test.step('«Para llevar»: el guacamole entra marcado PARA LLEVAR', async () => {
        await tarjeta.getByRole('button', { name: 'Para llevar', exact: true }).tap();
        const llevar = caja.getByRole('dialog').filter({ hasText: 'marcado PARA LLEVAR' });
        await yaAbierto(llevar);
        await llevar.getByRole('button', { name: tesela(CARTA.guacamole.nombre) }).tap();
        const agregado = caja.waitForResponse(
          (r) => ruta(r) === '/api/restaurante/agregar-en-caja',
        );
        await llevar.getByRole('button', { name: /^Agregar para llevar \$/ }).tap();
        expect((await agregado).status(), 'El servidor no agregó el guacamole.').toBe(200);
        await expect(llevar).toBeHidden();
        const platillos = tarjeta.getByRole('list', { name: 'Platillos de la cuenta' });
        await expect(platillos).toContainText('PARA LLEVAR');
        await expect(totalACobrar(tarjeta)).toHaveText(
          enPantalla(PEDIDO_CENTAVOS + SOPA_CENTAVOS + GUACAMOLE_CENTAVOS),
        );
        expect((await comandasDeLaCuenta(duena, ordenId)).length).toBe(comandasAlPedir + 2);
        await retratar(caja, info, '2-con-lo-agregado');
      });

      await test.step('quitar la sopa: motivo obligatorio y, siendo la cajera, el PIN de un gerente', async () => {
        await tarjeta.getByRole('button', { name: `Quitar ${CARTA.sopa.nombre}` }).tap();
        const quitar = caja.getByRole('dialog', { name: `Quitar ${CARTA.sopa.nombre}` });
        await yaAbierto(quitar);
        const confirmar = quitar.getByRole('button', { name: 'Quitar de la cuenta' });
        await expect(confirmar).toBeDisabled();
        await quitar.getByRole('radio', { name: 'Me equivoqué al tomar la orden' }).check();
        // Con motivo y SIN PIN, la cajera no quita nada.
        await expect(confirmar).toBeDisabled();
        await quitar
          .getByRole('group', { name: 'Quién autoriza' })
          .getByRole('button', { name: gerente.nombre })
          .tap();
        await quitar.locator('#anular-linea-pin').fill(gerente.pin);
        await quitar.getByRole('button', { name: 'Autorizar' }).tap();
        await expect(quitar.getByText(`Autorizó ${gerente.nombre}.`)).toBeVisible();
        await retratar(caja, info, '3-quitar-con-pin');
        const anulada = caja.waitForResponse((r) => ruta(r) === '/api/restaurante/anular-linea');
        await confirmar.tap();
        expect((await anulada).status(), 'El servidor no quitó la sopa.').toBe(200);
        await expect(quitar).toBeHidden();
        await expect(totalACobrar(tarjeta)).toHaveText(enPantalla(VENTA));
        expect((await cuentaEnElServidor(duena, ordenId)).totalCentavos).toBe(VENTA);
      });

      await test.step('cobra con 10 % de propina, en efectivo exacto', async () => {
        await tarjeta.getByRole('button', { name: '10%', exact: true }).tap();
        await expect(totalACobrar(tarjeta)).toHaveText(enPantalla(VENTA + PROPINA));
        expect((await cobrarConElDedo(caja, tarjeta)).ok).toBe(true);
        await cerrarElTicket(caja);
        expect((await cuentaEnElServidor(duena, ordenId)).estado).toBe('pagada');
        expect(await pagosDeLaCuenta(duena, ordenId)).toMatchObject({
          efectivo: VENTA + PROPINA,
          propinaEfectivo: PROPINA,
          cambio: 0,
          cobradoConPropina: VENTA + PROPINA,
        });
      });

      await test.step('el corte: propinas por persona, «Liquidar» con PIN y el cajón baja lo entregado', async () => {
        expect(await esperadoDelCajon(rosa)).toBe(FONDO_CENTAVOS + VENTA + PROPINA);
        await caja.getByRole('button', { name: /^(Cierre diario|Cierre)$/ }).tap();
        const cierre = caja.getByRole('dialog').filter({ hasText: 'Cierre de caja diario' });
        await yaAbierto(cierre);
        const propinas = cierre.locator('[data-propinas-del-corte]');
        await expect(propinas).toContainText(mesera.nombre);
        await expect(propinas).toContainText('1 cuenta atendida');
        await expect(propinas).toContainText(enPantalla(PROPINA));
        await retratar(caja, info, '4-propinas-en-el-corte');

        await propinas.getByRole('button', { name: /^Liquidar a / }).tap();
        const liquidar = caja.getByRole('dialog', { name: 'Liquidar propinas' });
        await yaAbierto(liquidar);
        await expect(liquidar.getByText(/Se entrega en efectivo de esta caja/)).toBeVisible();
        await expect(liquidar).toContainText(enPantalla(PROPINA));
        // La cajera la entrega con el PIN de un gerente, por ESE importe.
        await liquidar
          .getByRole('group', { name: 'Quién autoriza' })
          .getByRole('button', { name: gerente.nombre })
          .tap();
        await liquidar.locator('#liquidar-propinas-pin').fill(gerente.pin);
        await retratar(caja, info, '5-liquidar-con-pin');
        const liquidada = caja.waitForResponse((r) => ruta(r) === '/api/propinas/liquidar');
        await liquidar.getByRole('button', { name: 'Autorizar' }).tap();
        expect((await liquidada).status(), 'El servidor no registró la liquidación.').toBe(200);
        await expect(liquidar).toBeHidden();

        // Lo entregado salió del cajón: el corte espera eso menos, y ya no hay nada por liquidar.
        const esperado = FONDO_CENTAVOS + VENTA;
        expect(await esperadoDelCajon(rosa)).toBe(esperado);
        await expect(
          cierre.getByText('No hay propinas pendientes de liquidar de este turno.'),
        ).toBeVisible();

        // Y la caja cierra con ese conteo.
        await cierre.getByPlaceholder('0.00').nth(0).fill(pesos(esperado));
        await cierre.getByPlaceholder('0.00').nth(1).fill('0');
        await cierre.getByRole('button', { name: 'Cerrar caja del día' }).tap();
        await expect(cierre).toBeHidden({ timeout: 60_000 });
        expect(await sesionDeLaCaja(rosa), 'La caja sigue abierta después del cierre.').toBeNull();
      });

      fallos();
      await caja.context().close();
    } finally {
      await equipo.cerrar();
    }
  });
});
