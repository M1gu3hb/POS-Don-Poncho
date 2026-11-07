import { expect, test, type Page } from '@playwright/test';

import { sesionDeLaCaja } from './ayudantes/conciliacion.ts';
import {
  abrirElCobro,
  abrirLaCaja,
  abrirLaMesa,
  alMapa,
  CARTA,
  cerrarElTicket,
  comandar,
  cuentaEnElServidor,
  enPantalla,
  lineasDeLaCuenta,
  yaAbierto,
  type PlatilloPedido,
} from './ayudantes/mesas-heredadas.ts';
import { pedirLaCuenta } from './ayudantes/cancelar-desde-la-mesa.ts';
import { Equipo, personaDe } from './ayudantes/roles.ts';
import {
  cabecerasDeEscrituraDePrueba,
  consultarPuente,
  exigirDemostracion,
  vigilarFallos,
} from './ayudantes/sesion.ts';

/**
 * DP-14.1 (puntos 1 y 2) · LO QUE EL MESERO QUITÓ NO LLEGA A LA CAJA, Y LA CAJA DESCUENTA Y CANCELA.
 *
 * La Caja leía los renglones de la cuenta sin filtrar y el puente servía los anulados: el cobro,
 * «Dividir» y el ticket enseñaban el platillo quitado mientras el total ya no lo contaba. Y el
 * descuento y «Cancelar la cuenta» sólo vivían en `/restaurante/cobro`, que ninguna pantalla enlaza.
 */

const SLUG = 'prueba-restaurante';
const PEDIDO: readonly PlatilloPedido[] = [
  { nombre: CARTA.arrachera.nombre, veces: 1 },
  { nombre: CARTA.cerveza.nombre, veces: 1 },
  { nombre: CARTA.guacamole.nombre, veces: 1 },
];
const QUITADO = CARTA.guacamole.nombre;
const LO_QUE_SIGUE = CARTA.arrachera.centavos + CARTA.cerveza.centavos;

/** Quita el guacamole de la cuenta, como la gerente, por el comando. */
async function quitarElGuacamole(duena: Page, ordenId: string): Promise<void> {
  const filas = await consultarPuente<{ id: string; producto_nombre: string }>(
    duena,
    'DetalleVenta',
    { filtro: { venta_id: ordenId }, limite: 50 },
  );
  const linea = filas.find((f) => f.producto_nombre === QUITADO);
  if (linea === undefined) throw new Error('La cuenta no trae el guacamole.');
  const respuesta = await duena.request.post('/api/restaurante/anular-linea', {
    headers: cabecerasDeEscrituraDePrueba(),
    data: { ordenId, lineaId: linea.id, motivo: 'cliente_cambio' },
  });
  expect(respuesta.status(), `anular-linea: ${await respuesta.text()}`).toBe(200);
}

test.describe('lo quitado no se cobra, y la caja descuenta y cancela', () => {
  test.use({ actionTimeout: 20_000, navigationTimeout: 30_000 });

  test.beforeAll(async ({ playwright }, info) => {
    await exigirDemostracion(playwright, info, SLUG);
  });

  test('quitar un platillo, pedir la cuenta, cobrar y dividir en la Caja: nada de lo quitado', async ({
    browser,
  }, info) => {
    test.setTimeout(8 * 60_000);
    const equipo = new Equipo(browser, SLUG);
    const duena = await equipo.pagina(info, 'dueno');
    const resetear = async () => {
      const respuesta = await duena.request.post('/api/pruebas/resetear', {
        headers: cabecerasDeEscrituraDePrueba(),
        data: { confirmacion: 'RESETEAR' },
        // Resetear la demo entera tarda: con la máquina cargada pasa de los 20 s de una acción.
        timeout: 120_000,
      });
      expect(respuesta.status(), `resetear: ${await respuesta.text()}`).toBe(200);
    };
    await resetear();
    const rosa = await equipo.pagina(info, 'cajero');
    const lupita = await equipo.pagina(info, 'mesero');
    const fallos = [rosa, lupita].map((p) => vigilarFallos(p));
    await rosa.goto('/');
    await rosa.waitForURL(/\/caja$/);
    await lupita.goto('/');
    await lupita.waitForURL(/\/mesero$/);
    if ((await sesionDeLaCaja(rosa)) === null) await abrirLaCaja(rosa, 150_000);

    const servir = async (mesa: number): Promise<string> => {
      const { ordenId } = await abrirLaMesa(lupita, duena, mesa, 2);
      await comandar(lupita, mesa, PEDIDO);
      await alMapa(lupita);
      await quitarElGuacamole(duena, ordenId);
      await pedirLaCuenta(lupita, ordenId);
      return ordenId;
    };

    await test.step('el cobro y el ticket traen sólo lo que se cobra, y suman su total', async () => {
      const ordenId = await servir(3);
      expect(await lineasDeLaCuenta(duena, ordenId)).toHaveLength(2);
      const cobro = await abrirElCobro(rosa, 3);
      await expect(cobro.getByText(QUITADO)).toHaveCount(0);
      await expect(cobro.getByText(CARTA.arrachera.nombre).first()).toBeVisible();
      await cobro.getByRole('button', { name: 'Efectivo', exact: true }).click();
      await cobro.getByPlaceholder('0.00').fill('500.00');
      await cobro.getByRole('button', { name: /^Cobrar \$/ }).click();
      const ticket = rosa.getByRole('dialog').filter({ hasText: 'TICKET DE PAGO' });
      await yaAbierto(ticket);
      await expect(ticket.getByText(QUITADO)).toHaveCount(0);
      await expect(ticket.getByText(enPantalla(LO_QUE_SIGUE)).first()).toBeVisible();
      await cerrarElTicket(rosa);
      const cuenta = await cuentaEnElServidor(duena, ordenId);
      expect([cuenta.estado, cuenta.totalCentavos]).toEqual(['pagada', LO_QUE_SIGUE]);
    });

    await test.step('«Dividir» no ofrece repartir lo que se quitó', async () => {
      await servir(5);
      const cobro = await abrirElCobro(rosa, 5);
      await cobro.getByRole('button', { name: /^Dividir\b/ }).click();
      const dialogo = rosa.getByRole('dialog', { name: 'Dividir la cuenta' });
      await expect(dialogo).toBeVisible();
      await expect(
        dialogo.getByRole('button', { name: new RegExp(`^Añadir ${QUITADO}`) }),
      ).toHaveCount(0);
      await expect(
        dialogo.getByRole('button', {
          name: `Añadir ${CARTA.arrachera.nombre} a la cuenta 1`,
          exact: true,
        }),
      ).toBeVisible();
      await rosa.keyboard.press('Escape');
    });

    for (const exigirSinFallos of fallos) exigirSinFallos();
    await resetear();
  });

  test('en el cobro de la Caja: descuento con la clave de la gerente, y cancelar la cuenta', async ({
    browser,
  }, info) => {
    test.setTimeout(8 * 60_000);
    const equipo = new Equipo(browser, SLUG);
    const duena = await equipo.pagina(info, 'dueno');
    const resetear = async () => {
      const respuesta = await duena.request.post('/api/pruebas/resetear', {
        headers: cabecerasDeEscrituraDePrueba(),
        data: { confirmacion: 'RESETEAR' },
        // Resetear la demo entera tarda: con la máquina cargada pasa de los 20 s de una acción.
        timeout: 120_000,
      });
      expect(respuesta.status(), `resetear: ${await respuesta.text()}`).toBe(200);
    };
    const permitir = async (permitir: boolean) => {
      const respuesta = await duena.request.post('/api/configuracion/permitir-descuentos', {
        headers: cabecerasDeEscrituraDePrueba(),
        data: { permitir },
        timeout: 60_000,
      });
      expect(respuesta.status(), await respuesta.text()).toBe(200);
    };
    await resetear();
    const rosa = await equipo.pagina(info, 'cajero');
    const lupita = await equipo.pagina(info, 'mesero');
    // El 422 de cancelar una cuenta pedida sin PIN es el que la pantalla ESPERA: se perdona sólo
    // mientras se espera.
    let esperandoElRechazoDelPin = false;
    const fallos = [
      vigilarFallos(rosa, { sondeando: () => esperandoElRechazoDelPin }),
      vigilarFallos(lupita),
    ];
    await rosa.goto('/');
    await rosa.waitForURL(/\/caja$/);
    await lupita.goto('/');
    await lupita.waitForURL(/\/mesero$/);
    if ((await sesionDeLaCaja(rosa)) === null) await abrirLaCaja(rosa, 150_000);
    const gerente = personaDe(SLUG, 'gerente');

    const servir = async (mesa: number): Promise<string> => {
      const { ordenId } = await abrirLaMesa(lupita, duena, mesa, 2);
      await comandar(lupita, mesa, PEDIDO.slice(0, 2));
      await alMapa(lupita);
      await pedirLaCuenta(lupita, ordenId);
      return ordenId;
    };

    await test.step('Rosa descuenta $20 con el PIN de la gerente, desde su cobro', async () => {
      const ordenId = await servir(6);
      const cobro = await abrirElCobro(rosa, 6);
      await cobro.getByRole('button', { name: 'Descuento', exact: true }).click();
      const dialogo = rosa.getByRole('dialog', { name: 'Descuento' });
      await dialogo.locator('#descuento-importe').fill('20');
      await dialogo.locator('#descuento-motivo').fill('Cliente frecuente');
      await dialogo
        .getByRole('group', { name: 'Quién autoriza' })
        .getByRole('button', { name: gerente.nombre })
        .click();
      await dialogo.locator('#descuento-pin').fill(gerente.pin);
      await dialogo.getByRole('button', { name: 'Autorizar' }).click();
      await expect(dialogo.getByText(`Autorizó ${gerente.nombre}.`)).toBeVisible();
      const aplicado = rosa.waitForResponse(
        (r) => new URL(r.url()).pathname === '/api/restaurante/descontar-cuenta',
      );
      await dialogo.getByRole('button', { name: 'Aplicar el descuento' }).click();
      expect((await aplicado).status()).toBe(200);
      await expect
        .poll(async () => (await cuentaEnElServidor(duena, ordenId)).totalCentavos)
        .toBe(LO_QUE_SIGUE - 2_000);
      await expect(cobro.getByText(enPantalla(LO_QUE_SIGUE - 2_000)).first()).toBeVisible();
      await rosa.keyboard.press('Escape');
    });

    await test.step('con los descuentos apagados, el botón no aparece', async () => {
      await permitir(false);
      try {
        await servir(2);
        // La pantalla lee la configuración al montar: se vuelve a la caja para leerla de nuevo.
        await rosa.goto('/caja');
        await rosa.waitForURL(/\/caja$/);
        const cobro = await abrirElCobro(rosa, 2);
        await expect(cobro.getByRole('button', { name: 'Descuento', exact: true })).toHaveCount(0);
        await rosa.keyboard.press('Escape');
      } finally {
        await permitir(true);
      }
    });

    await test.step('Rosa cancela la cuenta desde su cobro: ya pedida, con el PIN de la gerente (DP-D51)', async () => {
      const ordenId = await servir(4);
      const cobro = await abrirElCobro(rosa, 4);
      await cobro.getByRole('button', { name: 'Cancelar la cuenta', exact: true }).click();
      const dialogo = rosa.getByRole('dialog', { name: 'Cancelar la cuenta' });
      await dialogo.locator('#cancelar-cuenta-motivo').fill('Se fueron sin consumir');
      const confirmar = dialogo.getByRole('button', { name: 'Cancelar la cuenta sin cobrar' });
      const rechazo = rosa.waitForResponse(
        (r) => new URL(r.url()).pathname === '/api/restaurante/cancelar-orden',
      );
      esperandoElRechazoDelPin = true;
      try {
        await confirmar.click();
        expect((await rechazo).status(), 'Sin PIN, la cuenta pedida se canceló.').toBe(422);
      } finally {
        esperandoElRechazoDelPin = false;
      }
      await dialogo
        .getByRole('group', { name: 'Quién autoriza' })
        .getByRole('button', { name: gerente.nombre })
        .click();
      await dialogo.locator('#cancelar-cuenta-pin').fill(gerente.pin);
      await dialogo.getByRole('button', { name: 'Autorizar' }).click();
      await expect(dialogo.getByText(`Autorizó ${gerente.nombre}.`)).toBeVisible();
      const cancelada = rosa.waitForResponse(
        (r) => new URL(r.url()).pathname === '/api/restaurante/cancelar-orden',
      );
      await confirmar.click();
      expect((await cancelada).status()).toBe(200);
      await expect(cobro).toBeHidden();
      expect((await cuentaEnElServidor(duena, ordenId)).estado).toBe('cancelada');
    });

    for (const exigirSinFallos of fallos) exigirSinFallos();
    await resetear();
  });
});
