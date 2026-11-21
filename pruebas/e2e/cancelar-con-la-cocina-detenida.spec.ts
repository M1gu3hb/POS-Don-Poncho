import { expect, test, type Page } from '@playwright/test';

import {
  asegurarLaMesa,
  empezarElDia,
  SLUG,
  tocar,
  type Dia,
} from './ayudantes/cancelar-desde-la-mesa.ts';
import {
  abrirLaMesa,
  CARTA,
  comandar,
  dialogoDeLaMesa,
  exigirEstadoDeLaMesa,
} from './ayudantes/mesas-heredadas.ts';
import { exigirDemostracion } from './ayudantes/sesion.ts';

/**
 * DP-14.6-7 · «COMPROBANDO LA COCINA…» TIENE TIEMPO LÍMITE, Y SIN COCINA TODO QUEDA COMO PÉRDIDA.
 *
 * DP-24 · Cancelar ya no es del mesero: el diálogo lo usa la dueña (la gerencia nunca teclea PIN) y
 * la caja (siempre con el PIN de un gerente: lo prueban `cancelar-sin-comprobar-la-cocina` y
 * `quien-quita-y-cancela`, de integración).
 *
 * Antes de cancelar una cuenta el diálogo relee lo que la cocina ya preparó (para avisar de la
 * pérdida). Si esa lectura no contesta, el diálogo se quedaba en «Comprobando…» para siempre. Ahora:
 *   · colgada: a los 8 s deja de esperar, dice que no pudo comprobar y ofrece «Reintentar»; con
 *     la lectura ya sana, «Reintentar» lo deja seguir normal (sin PIN) y la cuenta se cancela;
 *   · rota: dice que no pudo comprobar; la gerencia cancela sin PIN y todo queda como pérdida.
 * La lectura es la del puente (`/api/datos/consultar`, entidad `PedidoPreparacion`) y se detiene
 * con `page.route`. NOTA: el diálogo con esa comprobación es el de la mesa del mesero; el de la
 * Caja (`Caja.jsx`) no pasa la lectura de la cocina y no tiene este paso (ver la entrega).
 * Corre en serie (`--workers=1`): cancela cuentas de la demo.
 */

type Modo = 'sana' | 'colgada' | 'rota';
const LECTURA_DE_LA_COCINA = '**/api/datos/consultar';
const COMPROBANDO = 'Comprobando lo que ya preparó la cocina…';
const NO_PUDE = 'No pude comprobar la cocina';

/** Detiene (o rompe) SÓLO la lectura de las comandas; lo demás pasa tal cual. */
async function controlarLaCocina(pagina: Page): Promise<{ modo: Modo }> {
  const control: { modo: Modo } = { modo: 'sana' };
  await pagina.route(LECTURA_DE_LA_COCINA, async (ruta) => {
    const cuerpo = ruta.request().postDataJSON() as { entidad?: string } | null;
    if (cuerpo?.entidad !== 'PedidoPreparacion') {
      await ruta.fallback();
      return;
    }
    try {
      while (control.modo === 'colgada' && !pagina.isClosed()) {
        await new Promise((listo) => setTimeout(listo, 200));
      }
      if (control.modo === 'rota') await ruta.abort('failed');
      else await ruta.continue();
    } catch (error: unknown) {
      // La página se cerró con la lectura en el aire: no hay a quién contestarle.
      if (!pagina.isClosed()) throw error;
    }
  });
  return control;
}

async function abrirElDialogo(lupita: Page, info: Parameters<typeof tocar>[1], mesa: number) {
  await asegurarLaMesa(lupita, mesa);
  await tocar(
    dialogoDeLaMesa(lupita, mesa).getByRole('button', { name: 'Cancelar la cuenta', exact: true }),
    info,
  );
  const dialogo = lupita.getByRole('dialog', { name: 'Cancelar la cuenta' });
  await expect(dialogo).toBeVisible();
  return dialogo;
}

async function cancelarYVerQueSeCancelo(lupita: Page, boton: ReturnType<Page['locator']>) {
  const respuesta = lupita.waitForResponse(
    (r) =>
      new URL(r.url()).pathname === '/api/restaurante/cancelar-orden' &&
      r.request().method() === 'POST',
  );
  await boton.click();
  expect((await respuesta).status(), 'El servidor rechazó la cancelación.').toBe(200);
  await expect(lupita.getByText('Cuenta cancelada').first()).toBeVisible();
}

test.describe('cancelar con la lectura de la cocina detenida (DP-14.6-7)', () => {
  test.use({ actionTimeout: 20_000, navigationTimeout: 30_000 });

  test.beforeAll(async ({ playwright }, info) => {
    await exigirDemostracion(playwright, info, SLUG);
  });

  test('colgada: a los 8 s «Reintentar»; rota: sólo con el PIN de un gerente', async ({
    browser,
  }, info) => {
    test.setTimeout(8 * 60_000);
    const dia: Dia = await empezarElDia(browser, info);
    const { duena, lupita } = dia;
    const control = await controlarLaCocina(duena);

    try {
      await test.step('mesa 3, lectura colgada: «Comprobando…», a los 8 s «Reintentar», y con la lectura sana sigue normal', async () => {
        await abrirLaMesa(lupita, duena, 3, 2);
        await comandar(lupita, 3, [{ nombre: CARTA.pastor.nombre, veces: 1 }]);
        control.modo = 'colgada';
        const dialogo = await abrirElDialogo(duena, info, 3);
        await dialogo.locator('#cancelar-cuenta-motivo').fill('Capturé la mesa equivocada');
        const confirmar = dialogo.getByRole('button', { name: 'Cancelar la cuenta sin cobrar' });
        await expect(dialogo.getByText(COMPROBANDO)).toBeVisible();
        await expect(confirmar, 'Se puede cancelar a ciegas.').toBeDisabled();

        await expect(
          dialogo.getByText(NO_PUDE),
          'La comprobación no se rindió a los 8 s.',
        ).toBeVisible({ timeout: 15_000 });
        await expect(dialogo.getByText(COMPROBANDO)).toHaveCount(0);
        await expect(dialogo.getByRole('button', { name: 'Reintentar' })).toBeVisible();
        // La gerencia no teclea PIN: sin cocina puede cancelar (todo queda como pérdida).
        await expect(dialogo.getByRole('group', { name: 'Quién autoriza' })).toHaveCount(0);
        await expect(confirmar).toBeEnabled();

        control.modo = 'sana';
        await tocar(dialogo.getByRole('button', { name: 'Reintentar' }), info);
        await expect(dialogo.getByText(NO_PUDE)).toHaveCount(0);
        await expect(dialogo.getByText(COMPROBANDO)).toHaveCount(0);
        await expect(dialogo.getByRole('group', { name: 'Quién autoriza' })).toHaveCount(0);
        await expect(confirmar).toBeEnabled();
        await cancelarYVerQueSeCancelo(duena, confirmar);
        await exigirEstadoDeLaMesa(duena, 3, 'libre', 'La mesa 3 cancelada no volvió al servicio.');
      });

      await test.step('mesa 4, lectura rota: no se pudo comprobar, y la gerencia cancela sin PIN (todo, pérdida)', async () => {
        control.modo = 'sana';
        await abrirLaMesa(lupita, duena, 4, 2);
        await comandar(lupita, 4, [{ nombre: CARTA.pastor.nombre, veces: 1 }]);
        control.modo = 'rota';
        const dialogo = await abrirElDialogo(duena, info, 4);
        await dialogo.locator('#cancelar-cuenta-motivo').fill('Se fueron antes de pedir');
        const confirmar = dialogo.getByRole('button', { name: 'Cancelar la cuenta sin cobrar' });
        await expect(dialogo.getByText(NO_PUDE)).toBeVisible();
        await expect(dialogo.getByRole('group', { name: 'Quién autoriza' })).toHaveCount(0);
        await expect(confirmar).toBeEnabled();
        await cancelarYVerQueSeCancelo(duena, confirmar);
        await exigirEstadoDeLaMesa(duena, 4, 'libre', 'La mesa 4 cancelada no volvió al servicio.');
      });
    } finally {
      control.modo = 'sana';
    }
    dia.exigirSinFallos();
  });
});
