import { cancelarComoCajaConElPin } from '../ayudantes/cancelar-desde-la-mesa.ts';
import { dialogoDeLaMesa, laMesa, yaAbierto, CARTA, pesos } from '../ayudantes/mesas-heredadas.ts';
import { Equipo, personaDe } from '../ayudantes/roles.ts';
import { cabecerasDeEscrituraDePrueba, exigirDemostracion } from '../ayudantes/sesion.ts';

import { navegadorDe, prepararContexto } from './arnes/ligero.ts';
import { expect, exigirServidor, test } from './arnes/prueba.ts';
import { toque } from './arnes/toque.ts';
import { vigilarPagina } from './arnes/vigilancia.ts';
import {
  SLUG,
  cajaAbierta,
  capturar,
  mandar,
  mesaConPedido,
  resetearLaDemo,
  sqlLocal,
} from './parte7/comun.ts';

/**
 * PARTE 7 · puntos 3 (cancelar con motivo y con quién autorizó) y 4 (descuento con la clave de
 * gerencia), con el dedo.
 *
 * 3 · DP-24 · La mesera no ve «Quitar un platillo» ni «Cancelar la cuenta» y el servidor le niega el
 *     comando a mano; la dueña quita un platillo ya enviado (el motivo es obligatorio), y la caja
 *     cancela la cuenta ya pedida sólo con la clave de gerencia; el motivo y quién autorizó quedan
 *     en la auditoría y lo cancelado sale en el corte.
 * 4 · La cajera aplica un descuento desde la Caja: pide la clave de gerencia, con una clave mala no
 *     aplica y lo dice, el descuento queda con quién lo autorizó y el total y el papel suman.
 */

const MOTIVO_DE_LA_CUENTA = 'el cliente se fue sin pedir';
const PIN_MALO = '8642';

test.describe('parte 7 · cancelar y descontar', () => {
  test.use({ actionTimeout: 60_000, navigationTimeout: 120_000 });

  test.beforeAll(async ({ playwright }, info) => {
    await exigirServidor(info.project.use.baseURL);
    await exigirDemostracion(playwright, info, SLUG);
  });

  test('3 · quitar un platillo y cancelar la cuenta: motivo obligatorio, mesa propia, clave de gerencia, auditoría y corte', async ({
    browser,
    aparato,
  }, info) => {
    test.setTimeout(10 * 60_000);
    const equipo = new Equipo(navegadorDe(browser, aparato), SLUG);
    try {
      const duena = await equipo.pagina(info, 'dueno');
      await prepararContexto(duena.context(), aparato);
      await resetearLaDemo(duena);
      const rosa = await equipo.pagina(info, 'cajero');
      await prepararContexto(rosa.context(), aparato);
      await cajaAbierta(rosa);
      const lupita = await equipo.pagina(info, 'mesero');
      await prepararContexto(lupita.context(), aparato);
      vigilarPagina(lupita);
      const gerente = personaDe(SLUG, 'gerente');

      const propia = await mesaConPedido(lupita, duena, 5, [
        { nombre: 'Sopa de tortilla' },
        { nombre: 'Cerveza clara 355 ml' },
      ]);

      // ── DP-24 · La mesera NO ve los botones y el servidor le niega el comando a mano ───────────
      await lupita.goto('/mesero', { waitUntil: 'domcontentloaded' });
      await toque(lupita, laMesa(lupita, 5));
      const mesaDeLupita = dialogoDeLaMesa(lupita, 5);
      await yaAbierto(mesaDeLupita);
      await expect(mesaDeLupita.getByRole('button', { name: 'Quitar un platillo' })).toHaveCount(0);
      await expect(
        mesaDeLupita.getByRole('button', { name: 'Cancelar la cuenta', exact: true }),
      ).toHaveCount(0);
      const sinPermiso = await lupita.request.post('/api/restaurante/cancelar-orden', {
        headers: cabecerasDeEscrituraDePrueba(),
        data: { ordenId: propia.ordenId, motivo: 'a ver si deja' },
      });
      expect(sinPermiso.status(), 'La mesera canceló una cuenta.').toBe(403);
      await capturar(lupita, 'cancelar', aparato.id, 'la-mesera-no-ve-los-botones');

      // ── Un platillo ya enviado: lo quita la dueña, y el motivo es obligatorio ───────────────
      await duena.goto('/mesero', { waitUntil: 'domcontentloaded' });
      await toque(duena, laMesa(duena, 5));
      const mesa = dialogoDeLaMesa(duena, 5);
      await yaAbierto(mesa);
      await toque(duena, mesa.getByRole('button', { name: 'Quitar un platillo' }));
      const lista = duena.getByRole('dialog', { name: 'Quitar un platillo' });
      await yaAbierto(lista);
      await toque(duena, lista.getByRole('button', { name: 'Quitar Sopa de tortilla' }));
      const anular = duena.getByRole('dialog', { name: 'Quitar Sopa de tortilla' });
      await yaAbierto(anular);
      const confirmarQuitar = anular.getByRole('button', { name: 'Quitar de la cuenta' });
      await expect(confirmarQuitar, 'Se puede quitar sin motivo.').toBeDisabled();
      await capturar(duena, 'cancelar', aparato.id, 'quitar-sin-motivo');
      await toque(duena, anular.getByRole('radio', { name: 'Me equivoqué al tomar la orden' }));
      const [quitada] = await Promise.all([
        duena.waitForResponse(
          (r) =>
            new URL(r.url()).pathname === '/api/restaurante/anular-linea' &&
            r.request().method() === 'POST',
        ),
        toque(duena, confirmarQuitar),
      ]);
      expect(quitada.status(), await quitada.text()).toBe(200);
      await expect(duena.getByText('Platillo quitado de la cuenta').first()).toBeVisible();

      // ── La cuenta entera, ya pedida: la caja la cancela sólo con la clave de gerencia ──────
      await mandar(lupita, '/api/restaurante/solicitar-cuenta', { ordenId: propia.ordenId });
      await cancelarComoCajaConElPin(rosa, propia.ordenId, MOTIVO_DE_LA_CUENTA, gerente);

      // ── La auditoría dice quién autorizó y por qué; el corte lo dice también ────────────────
      const auditoria = sqlLocal(
        `select accion || ' | ' || coalesce(payload ->> 'motivo', '-') || ' | autorizo ' || coalesce((select nombre from empleados_visibles e where e.id::text = payload ->> 'autorizadoPor'), '-') from auditoria where accion in ('restaurante.cancelar_orden','restaurante.anular_linea') order by 1`,
      );
      process.stdout.write(`AUDITORIA:\n${auditoria}\n`);
      expect(auditoria).toContain(
        `restaurante.cancelar_orden | ${MOTIVO_DE_LA_CUENTA} | autorizo ${gerente.nombre}`,
      );
      expect(auditoria).toContain('restaurante.anular_linea');

      await duena.goto('/registros', { waitUntil: 'domcontentloaded' });
      await toque(duena, duena.getByRole('tab', { name: /^Cancelaciones/ }));
      const cancelaciones = duena.getByText(MOTIVO_DE_LA_CUENTA).first();
      await expect(cancelaciones, 'Registros no lista la cancelación con su motivo.').toBeVisible({
        timeout: 60_000,
      });
      await capturar(duena, 'cancelar', aparato.id, 'registros-cancelaciones');
      await expect(
        duena
          .getByText(new RegExp(`Autoriz[óo].*${gerente.nombre}|${gerente.nombre}.*autoriz`, 'i'))
          .first(),
        'La lista de cancelaciones (y el corte) no dice quién autorizó.',
      ).toBeVisible({ timeout: 5_000 });
    } finally {
      await equipo.cerrar();
    }
  });

  test('4 · el descuento desde la Caja pide la clave de gerencia: clave mala no aplica, queda quién autorizó y el total y el papel suman', async ({
    browser,
    aparato,
  }, info) => {
    test.setTimeout(10 * 60_000);
    const equipo = new Equipo(navegadorDe(browser, aparato), SLUG);
    try {
      const duena = await equipo.pagina(info, 'dueno');
      await prepararContexto(duena.context(), aparato);
      await resetearLaDemo(duena);
      const rosa = await equipo.pagina(info, 'cajero');
      await prepararContexto(rosa.context(), aparato);
      await cajaAbierta(rosa);
      const lupita = await equipo.pagina(info, 'mesero');
      await prepararContexto(lupita.context(), aparato);
      const gerente = personaDe(SLUG, 'gerente');
      const { ordenId } = await mesaConPedido(lupita, duena, 5, [
        { nombre: CARTA.arrachera.nombre, cantidad: '2' },
      ]);
      await mandar(lupita, '/api/restaurante/solicitar-cuenta', { ordenId });

      await rosa.goto('/caja', { waitUntil: 'domcontentloaded' });
      await toque(rosa, rosa.getByRole('tab', { name: /^Pendientes/ }));
      await toque(rosa, rosa.getByRole('button', { name: /^Mesa 5 Cuenta/ }));
      const cobro = rosa.getByRole('dialog').filter({ hasText: 'Cobrar — Mesa 5' });
      await yaAbierto(cobro);
      await toque(rosa, cobro.getByRole('button', { name: 'Descuento', exact: true }));
      const dialogo = rosa.getByRole('dialog', { name: 'Descuento' });
      await yaAbierto(dialogo);
      await toque(rosa, dialogo.getByRole('button', { name: 'En porcentaje' }));
      await dialogo.locator('#descuento-porcentaje').fill('10');
      await dialogo.locator('#descuento-motivo').fill('cortesía de la casa');
      const aplicar = dialogo.getByRole('button', { name: 'Aplicar el descuento' });
      await expect(
        aplicar,
        'Se puede aplicar un descuento sin la clave de gerencia.',
      ).toBeDisabled();
      await capturar(rosa, 'descuento', aparato.id, 'pide-la-clave');

      // Clave mala: no aplica y lo dice.
      await toque(
        rosa,
        dialogo.getByRole('group', { name: 'Quién autoriza' }).getByRole('button', {
          name: gerente.nombre,
        }),
      );
      await dialogo.locator('#descuento-pin').fill(PIN_MALO);
      const [respuestaMala] = await Promise.all([
        rosa.waitForResponse((r) => new URL(r.url()).pathname === '/api/identidad/supervisor'),
        toque(rosa, dialogo.getByRole('button', { name: 'Autorizar' })),
      ]);
      expect(respuestaMala.status(), 'El servidor aceptó una clave mala.').toBeGreaterThanOrEqual(
        400,
      );
      await expect(dialogo.getByText(`Autorizó ${gerente.nombre}.`)).toHaveCount(0);
      await expect(aplicar).toBeDisabled();
      await capturar(rosa, 'descuento', aparato.id, 'clave-mala');
      const avisoDeClaveMala = await dialogo.innerText();
      process.stdout.write(`TEXTO-CLAVE-MALA: ${avisoDeClaveMala.replaceAll('\n', ' / ')}\n`);
      expect(avisoDeClaveMala, 'La clave mala no dijo nada.').toMatch(
        /PIN|clave|incorrect|no es v/i,
      );

      // Clave buena: autoriza y aplica.
      await dialogo.locator('#descuento-pin').fill(gerente.pin);
      await toque(rosa, dialogo.getByRole('button', { name: 'Autorizar' }));
      await expect(dialogo.getByText(`Autorizó ${gerente.nombre}.`)).toBeVisible();
      await expect(aplicar).toBeEnabled();
      const [aplicado] = await Promise.all([
        rosa.waitForResponse(
          (r) =>
            new URL(r.url()).pathname === '/api/restaurante/descontar-cuenta' &&
            r.request().method() === 'POST',
        ),
        toque(rosa, aplicar),
      ]);
      expect(aplicado.status(), await aplicado.text()).toBe(200);
      await expect(dialogo).toBeHidden();

      // Queda quién lo autorizó, y el total ya es el descontado: 10 % de 2 arracheras.
      const total = CARTA.arrachera.centavos * 2;
      const descuento = Math.round(total * 0.1);
      await expect(
        cobro.getByText(`Autorizó ${gerente.nombre} · cortesía de la casa`),
        'El cobro no dice quién autorizó el descuento.',
      ).toBeVisible();
      await expect(
        cobro.getByRole('button', { name: `Cobrar $${pesos(total - descuento)}` }),
      ).toBeVisible();
      await capturar(rosa, 'descuento', aparato.id, 'aplicado');

      // Se cobra y el papel suma: subtotal, descuento y total.
      await toque(rosa, cobro.getByRole('button', { name: 'Efectivo', exact: true }));
      await cobro.getByPlaceholder('0.00').fill('600.00');
      const [cobrado] = await Promise.all([
        rosa.waitForResponse((r) => new URL(r.url()).pathname === '/api/venta/cobrar'),
        toque(rosa, cobro.getByRole('button', { name: /^Cobrar \$/ })),
      ]);
      const cuerpo = (await cobrado.json()) as { datos?: { totalCentavos?: string } };
      expect(cobrado.status()).toBe(200);
      expect(cuerpo.datos?.totalCentavos).toBe(String(total - descuento));
      const ticket = rosa.getByRole('dialog').filter({ hasText: 'TICKET DE PAGO' });
      await yaAbierto(ticket);
      const papel = await ticket.innerText();
      process.stdout.write(`TICKET: ${papel.replaceAll('\n', ' / ')}\n`);
      expect(papel).toContain(`$${pesos(total - descuento)}`);
      expect(papel).toContain(`$${pesos(descuento)}`);
      await capturar(rosa, 'descuento', aparato.id, 'ticket');
    } finally {
      await equipo.cerrar();
    }
  });
});
