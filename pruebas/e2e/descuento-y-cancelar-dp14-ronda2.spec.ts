import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';

import { empezarElDia, SLUG, tocar, type Dia } from './ayudantes/cancelar-desde-la-mesa.ts';
import {
  abrirLaMesa,
  CARTA,
  comandar,
  dialogoDeLaMesa,
  exigirEstadoDeLaMesa,
} from './ayudantes/mesas-heredadas.ts';
import { Equipo, personaDe } from './ayudantes/roles.ts';
import {
  abrirPantalla,
  cabecerasDeEscrituraDePrueba,
  exigirDemostracion,
  vigilarFallos,
} from './ayudantes/sesion.ts';

/**
 * DP-14 ronda 2 · medios 5 y 6, en el navegador.
 *
 * 5 · EL DIÁLOGO DEL DESCUENTO. Al autorizar dice hasta cuánto llega ese PIN y no deja aplicar más;
 * si el servidor rechaza la autorización la borra y pide el PIN otra vez; un doble toque manda UN
 * solo descuento; y si la cuenta ya tenía descuento dice «Reemplaza el descuento de $X».
 *
 * 6 · CANCELAR CON LA COCINA SIN RESPUESTA. El gerente o el dueño con sesión teclea SU PIN y cancela,
 * sin necesitar a otro (el mesero sigue usando el PIN de la gerente: `cancelar-con-la-cocina-detenida`).
 *
 * Corre en serie (`--workers=1`): cancela y descuenta cuentas de la demo.
 */

const MESA_DEL_DESCUENTO = 5;
const MESAS_DE_CANCELAR = { gerente: 6, dueno: 3 } as const;

/** Mientras se espera un 422/403 que la pantalla ESPERA (y sólo entonces), el vigilante no lo cuenta. */
let esperandoUnRechazo = false;

async function pedirLaCuentaPorElServidor(pagina: Page, ordenId: string): Promise<void> {
  const respuesta = await pagina.request.post('/api/restaurante/solicitar-cuenta', {
    headers: cabecerasDeEscrituraDePrueba(),
    data: { ordenId },
  });
  expect(respuesta.status(), `solicitar-cuenta: ${await respuesta.text()}`).toBe(200);
}

async function autorizar(dialogo: Locator, quien: { nombre: string; pin: string }, info: TestInfo) {
  await tocar(
    dialogo.getByRole('group', { name: 'Quién autoriza' }).getByRole('button', {
      name: quien.nombre,
    }),
    info,
  );
  await dialogo.locator('#descuento-pin').fill(quien.pin);
  await tocar(dialogo.getByRole('button', { name: 'Autorizar' }), info);
  await expect(dialogo.getByText(`Autorizó ${quien.nombre}.`)).toBeVisible();
}

test.describe('el descuento y cancelar con su propio PIN (DP-14 ronda 2)', () => {
  test.use({ actionTimeout: 20_000, navigationTimeout: 30_000 });

  test.beforeAll(async ({ playwright }, info) => {
    await exigirDemostracion(playwright, info, SLUG);
  });

  test('5 · el diálogo del descuento dice hasta dónde llega el PIN, borra la que no sirvió, no se dobla y avisa del reemplazo', async ({
    browser,
  }, info) => {
    test.setTimeout(8 * 60_000);
    const dia: Dia = await empezarElDia(browser, info);
    const { duena, rosa, lupita } = dia;
    // El vigilante del día (`empezarElDia`) no perdona el 422 que este diálogo espera: se vigila
    // aparte a la cajera, perdonándolo sólo mientras se espera.
    const sinFallosDeRosa = vigilarFallos(rosa, { sondeando: () => esperandoUnRechazo });
    const gerente = personaDe(SLUG, 'gerente');
    const dueno = personaDe(SLUG, 'dueno');

    const { ordenId } = await abrirLaMesa(lupita, duena, MESA_DEL_DESCUENTO, 2);
    await comandar(lupita, MESA_DEL_DESCUENTO, [{ nombre: CARTA.arrachera.nombre, veces: 2 }]);
    await pedirLaCuentaPorElServidor(lupita, ordenId);

    await abrirPantalla(rosa, '/restaurante/caja', /Pendientes/);
    await rosa
      .getByRole('button', { name: new RegExp(`^(Cobrar )?Mesa ${String(MESA_DEL_DESCUENTO)}\\b`) })
      .first()
      .click();
    // La caja heredada abre «Cobrar — Mesa N»: ahí viven «Descuento» y «Cancelar la cuenta».
    await expect(
      rosa.getByRole('dialog', {
        name: new RegExp(`^Cobrar — Mesa ${String(MESA_DEL_DESCUENTO)}`),
      }),
    ).toBeVisible();

    let descuentosEnviados = 0;
    rosa.on('request', (r) => {
      if (
        new URL(r.url()).pathname === '/api/restaurante/descontar-cuenta' &&
        r.method() === 'POST'
      ) {
        descuentosEnviados += 1;
      }
    });
    const abrirElDialogo = async () => {
      await tocar(rosa.getByRole('button', { name: 'Descuento', exact: true }), info);
      const dialogo = rosa.getByRole('dialog', { name: 'Descuento' });
      await expect(dialogo).toBeVisible();
      return dialogo;
    };
    const llenar = async (dialogo: Locator, porcentaje: string) => {
      await tocar(dialogo.getByRole('button', { name: 'En porcentaje' }), info);
      await dialogo.locator('#descuento-porcentaje').fill(porcentaje);
      await dialogo.locator('#descuento-motivo').fill('mesa de la casa');
    };
    const aplicar = (dialogo: Locator) =>
      dialogo.getByRole('button', { name: 'Aplicar el descuento' });

    let dialogo = await abrirElDialogo();
    await expect(dialogo.getByText(/Reemplaza el descuento de/)).toHaveCount(0);

    await test.step('el 40 % con el PIN de la gerente: dice «hasta 30 %» y no deja aplicar', async () => {
      await llenar(dialogo, '40');
      await autorizar(dialogo, gerente, info);
      await expect(dialogo.getByText(/Autoriza hasta 30 %/)).toBeVisible();
      await expect(dialogo.getByText(/pasa de ahí/)).toBeVisible();
      await expect(aplicar(dialogo)).toBeDisabled();
      expect(descuentosEnviados, 'Se mandó un descuento que el PIN no cubre.').toBe(0);
    });

    await test.step('«Que autorice otra persona»: el dueño sí cubre el 40 %', async () => {
      await tocar(dialogo.getByRole('button', { name: 'Que autorice otra persona' }), info);
      await autorizar(dialogo, dueno, info);
      await expect(dialogo.getByText(/Autoriza hasta 100 %/)).toBeVisible();
      await expect(aplicar(dialogo)).toBeEnabled();
    });

    await test.step('si el servidor rechaza la autorización, se borra y se pide el PIN otra vez', async () => {
      // Se le quita el tope a la respuesta (como un servidor viejo): la pantalla deja pasar el 40 %
      // y es el SERVIDOR quien lo rechaza por el tope de la gerente.
      await rosa.route('**/api/identidad/supervisor', async (ruta) => {
        const respuesta = await ruta.fetch();
        const cuerpo = (await respuesta.json()) as {
          datos?: Record<string, unknown>;
        };
        if (cuerpo.datos !== undefined) {
          delete cuerpo.datos['topeCentavos'];
          delete cuerpo.datos['topeBp'];
        }
        await ruta.fulfill({ response: respuesta, json: cuerpo });
      });
      await llenar(dialogo, '41');
      await expect(dialogo.getByText(/Autorizó/)).toHaveCount(0);
      await autorizar(dialogo, gerente, info);
      await expect(aplicar(dialogo)).toBeEnabled();
      esperandoUnRechazo = true;
      try {
        const rechazo = rosa.waitForResponse(
          (r) => new URL(r.url()).pathname === '/api/restaurante/descontar-cuenta',
        );
        await tocar(aplicar(dialogo), info);
        expect((await rechazo).status()).toBe(422);
      } finally {
        esperandoUnRechazo = false;
      }
      await expect(
        dialogo.getByText(/Autorizó/),
        'Se quedó la autorización rechazada.',
      ).toHaveCount(0);
      await expect(dialogo.getByText(/Pide el PIN otra vez/)).toBeVisible();
      await expect(dialogo.getByRole('group', { name: 'Quién autoriza' })).toBeVisible();
      await expect(aplicar(dialogo)).toBeDisabled();
      await rosa.unroute('**/api/identidad/supervisor');
    });

    await test.step('un doble toque en «Aplicar» manda UN solo descuento', async () => {
      await llenar(dialogo, '40');
      await autorizar(dialogo, dueno, info);
      const antes = descuentosEnviados;
      const respuesta = rosa.waitForResponse(
        (r) =>
          new URL(r.url()).pathname === '/api/restaurante/descontar-cuenta' &&
          r.request().method() === 'POST',
      );
      await aplicar(dialogo).dblclick();
      expect((await respuesta).status()).toBe(200);
      await expect(dialogo).toBeHidden();
      expect(descuentosEnviados - antes, 'El doble toque mandó dos descuentos.').toBe(1);
    });

    await test.step('con la cuenta ya descontada, el diálogo dice «Reemplaza el descuento de $X»', async () => {
      dialogo = await abrirElDialogo();
      // 40 % de 2 arracheras de $329.00 = $263.20.
      await expect(dialogo.getByText(/Reemplaza el descuento de\s*\$263\.20/)).toBeVisible();
      await rosa.keyboard.press('Escape');
    });

    sinFallosDeRosa();
  });

  for (const quien of ['gerente', 'dueno'] as const) {
    test(`6 · ${quien === 'gerente' ? 'la gerente' : 'el dueño'} cancela con la cocina sin respuesta tecleando SU PIN`, async ({
      browser,
    }, info) => {
      test.setTimeout(6 * 60_000);
      const equipo = new Equipo(browser, SLUG);
      const mesa = MESAS_DE_CANCELAR[quien];
      try {
        const duena = await equipo.pagina(info, 'dueno');
        const supervisor = personaDe(SLUG, quien);
        const pagina = quien === 'dueno' ? duena : await equipo.pagina(info, quien);
        const sinFallos = [
          vigilarFallos(duena),
          ...(pagina === duena ? [] : [vigilarFallos(pagina)]),
        ];
        await pagina.goto('/mesero');
        await abrirLaMesa(pagina, duena, mesa, 2);
        await comandar(pagina, mesa, [{ nombre: CARTA.pastor.nombre, veces: 1 }]);

        // La lectura de la cocina se rompe: el diálogo no puede comprobarla.
        await pagina.route('**/api/datos/consultar', async (ruta) => {
          const cuerpo = ruta.request().postDataJSON() as { entidad?: string } | null;
          if (cuerpo?.entidad === 'PedidoPreparacion') await ruta.abort('failed');
          else await ruta.fallback();
        });
        await tocar(
          dialogoDeLaMesa(pagina, mesa).getByRole('button', {
            name: 'Cancelar la cuenta',
            exact: true,
          }),
          info,
        );
        const dialogo = pagina.getByRole('dialog', { name: 'Cancelar la cuenta' });
        await dialogo.locator('#cancelar-cuenta-motivo').fill('Capturé la mesa equivocada');
        const confirmar = dialogo.getByRole('button', { name: 'Cancelar la cuenta sin cobrar' });
        await expect(dialogo.getByText('No pude comprobar la cocina')).toBeVisible();
        await expect(confirmar, 'Sin cocina se canceló sin PIN.').toBeDisabled();

        // Quien tiene la sesión va primero y teclea el suyo: no necesita a otro.
        const quienes = dialogo.getByRole('group', { name: 'Quién autoriza' });
        await expect(quienes.getByRole('button').first()).toHaveText(supervisor.nombre);
        await tocar(quienes.getByRole('button', { name: supervisor.nombre }), info);
        await dialogo.locator('#cancelar-cuenta-pin').fill(supervisor.pin);
        await tocar(dialogo.getByRole('button', { name: 'Autorizar' }), info);
        await expect(dialogo.getByText(`Autorizó ${supervisor.nombre}.`)).toBeVisible();
        await expect(confirmar).toBeEnabled();
        const respuesta = pagina.waitForResponse(
          (r) =>
            new URL(r.url()).pathname === '/api/restaurante/cancelar-orden' &&
            r.request().method() === 'POST',
        );
        await tocar(confirmar, info);
        expect((await respuesta).status(), 'El servidor rechazó la cancelación.').toBe(200);
        await expect(pagina.getByText('Cuenta cancelada').first()).toBeVisible();
        await exigirEstadoDeLaMesa(
          duena,
          mesa,
          'libre',
          `La mesa ${String(mesa)} cancelada no volvió al servicio.`,
        );
        for (const exigir of sinFallos) exigir();
      } finally {
        await equipo.cerrar();
      }
    });
  }
});
