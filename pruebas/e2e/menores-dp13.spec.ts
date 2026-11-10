import { expect, type Locator, type Page, test, type TestInfo } from '@playwright/test';

import {
  abrirElQrDeLaMesa,
  avisosDeLaMesa,
  CARTA,
  contarPeticiones,
  prepararElPortalDelComensal,
  type TelefonoDelComensal,
} from './ayudantes/mesas-heredadas.ts';
import { Equipo } from './ayudantes/roles.ts';
import {
  cabecerasDeEscrituraDePrueba,
  exigirDemostracion,
  vigilarFallos,
} from './ayudantes/sesion.ts';
import { centro, dedoDe, escalaDe, mantenerPresionada } from './ayudantes/tacto.ts';

/**
 * DP-13.4 · ARREGLOS MENORES DE PANTALLA, en escritorio, tableta (1280 × 800) y teléfono.
 *
 *   · Unir mesas: un SEGUNDO dedo (tacto real por CDP, dos puntos con su `id`) no mueve el origen
 *     del primero ni lo suelta al levantarse.
 *   · «Ver QR de la mesa» se cierra solo al minuto (reloj falso) y su título lleva el número.
 *   · Mantener presionado un globo de solicitud la atiende y NO abre el menú de la mesa.
 *   · «Atención» del comensal no tapa la barra del carrito a 320 y 375 px, y con un pedido guardado
 *     esperando al mesero no deja un segundo aviso ni dice otra cosa que el carrito (renueva el
 *     suyo, DP-13.2).
 */

const SLUG = 'prueba-restaurante';
const MESA = 5;
const ZONA = 'Interior';

const aLaMedida = async (pagina: Page, info: TestInfo): Promise<void> => {
  if (info.project.name === 'tablet') await pagina.setViewportSize({ width: 1280, height: 800 });
};

async function resetear(pagina: Page): Promise<void> {
  const reseteo = await pagina.request.post('/api/pruebas/resetear', {
    headers: cabecerasDeEscrituraDePrueba(),
    data: { confirmacion: 'RESETEAR' },
  });
  expect(reseteo.status(), `resetear_demo: ${await reseteo.text()}`).toBe(200);
}

const lejos = (a: { x: number; y: number }, b: { x: number; y: number }): number =>
  Math.hypot(a.x - b.x, a.y - b.y);

/** Varios dedos con tacto real (CDP); en la PC se enciende la emulación de tacto primero. */
async function dedosDe(pagina: Page, info: TestInfo) {
  const cdp = await pagina.context().newCDPSession(pagina);
  if (info.project.use.hasTouch !== true) {
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  }
  const tocar = (type: 'touchStart' | 'touchMove' | 'touchEnd', id: number, x: number, y: number) =>
    cdp.send('Input.dispatchTouchEvent', { type, touchPoints: [{ id, x, y }] });
  return {
    bajar: (id: number, x: number, y: number) => tocar('touchStart', id, x, y),
    mover: (id: number, x: number, y: number) => tocar('touchMove', id, x, y),
    subir: (id: number, x: number, y: number) => tocar('touchEnd', id, x, y),
    cerrar: () => cdp.detach(),
  };
}

test.describe('arreglos menores de pantalla (DP-13.4)', () => {
  test.use({ actionTimeout: 20_000, navigationTimeout: 30_000 });

  test.beforeAll(async ({ playwright }, info) => {
    await exigirDemostracion(playwright, info, SLUG);
  });

  test('unir mesas: un segundo dedo no mueve el origen del primero ni lo suelta', async ({
    browser,
  }, info) => {
    test.setTimeout(4 * 60_000);
    const equipo = new Equipo(browser, SLUG);
    try {
      const sala = await equipo.pagina(info, 'dueno');
      await aLaMedida(sala, info);
      const sinFallos = vigilarFallos(sala);
      await resetear(sala);
      const dedos = await dedosDe(sala, info);

      await sala.goto('/mesero');
      await sala.getByRole('button', { name: 'Unir mesas' }).click();
      const plano = sala.getByRole('region', { name: 'Unir mesas' });
      await expect(plano).toBeVisible();
      const mesa = (n: number): Locator =>
        plano.getByRole('button', { name: `Mesa ${String(n)}`, exact: true });
      const [tres, uno] = [mesa(3), mesa(1)];
      const [c3, c1] = [await centro(tres), await centro(uno)];
      const paso = 20 * (await escalaDe(tres, 60));
      // Hacia ARRIBA: ahí no hay vecinas ni, en el teléfono, borde del plano que lo detenga.
      const dedo1 = (k: number) => ({ x: c3.x, y: c3.y - k * paso });

      await dedos.bajar(1, c3.x, c3.y);
      await dedos.mover(1, dedo1(1).x, dedo1(1).y);
      // El segundo dedo baja sobre OTRA mesa y se pasea: la mesa 1 ni se inmuta.
      await dedos.bajar(2, c1.x, c1.y);
      await dedos.mover(2, c1.x + 50, c1.y + 30);
      await dedos.mover(1, dedo1(2).x, dedo1(2).y);
      await expect
        .poll(async () => lejos(await centro(tres), dedo1(2)), {
          message: 'La mesa del primer dedo dejó de seguirlo cuando bajó el segundo.',
        })
        .toBeLessThan(2);
      expect(lejos(await centro(uno), c1), 'El segundo dedo movió otra mesa.').toBeLessThan(1);

      // Que el segundo dedo se levante no suelta ni "toca" nada: el primero sigue llevando la 3.
      await dedos.subir(2, c1.x + 50, c1.y + 30);
      await dedos.mover(1, dedo1(3).x, dedo1(3).y);
      await expect
        .poll(async () => lejos(await centro(tres), dedo1(3)), {
          message: 'Al levantarse el segundo dedo se terminó el arrastre del primero.',
        })
        .toBeLessThan(2);
      await expect(uno).not.toHaveAttribute('aria-pressed', 'true');

      await dedos.subir(1, dedo1(3).x, dedo1(3).y);
      await expect(tres).toHaveAttribute('aria-pressed', 'true');
      await expect(uno).not.toHaveAttribute('aria-pressed', 'true');
      await dedos.cerrar();
      sinFallos();
    } finally {
      await equipo.cerrar();
    }
  });

  test('«Ver QR de la mesa» lleva el número de la mesa y se cierra solo a los 60 s', async ({
    browser,
  }, info) => {
    test.setTimeout(4 * 60_000);
    const equipo = new Equipo(browser, SLUG);
    try {
      const duena = await equipo.pagina(info, 'dueno');
      await resetear(duena);
      await prepararElPortalDelComensal(duena, { mesa: MESA, zona: ZONA, mesero: null });
      const mesero = await equipo.pagina(info, 'mesero');
      await aLaMedida(mesero, info);
      const sinFallos = vigilarFallos(mesero);
      await mesero.clock.install();
      await mesero.goto('/mesero');
      const mesa = mesero
        .locator('[data-mesa-id]')
        .filter({ hasText: String(MESA) })
        .first();
      await expect(mesa).toBeVisible();

      await mantenerPresionada(mesero, info, mesa);
      await mesero
        .getByRole('menu', { name: `Mesa ${String(MESA)}` })
        .getByRole('menuitem', { name: 'Ver QR de la mesa' })
        .click();
      const qr = mesero.getByRole('dialog', { name: `QR de la mesa ${String(MESA)}` });
      await expect(
        qr.getByRole('heading', { name: `QR de la mesa ${String(MESA)}` }),
      ).toBeVisible();
      await expect(qr.locator('img[data-qr-de-la-mesa]')).toBeVisible();

      // Medio minuto después sigue ahí, aunque el sondeo del mapa repinta la pantalla cada 5 s.
      await mesero.clock.runFor(30_000);
      await expect(qr).toBeVisible();
      await mesero.clock.runFor(31_000);
      await expect(qr).toBeHidden();
      sinFallos();
    } finally {
      await equipo.cerrar();
    }
  });

  test('«Atención» no tapa el carrito ni contradice a «Llamar a mi mesero»; el globo mantenido atiende', async ({
    browser,
  }, info) => {
    test.setTimeout(6 * 60_000);
    const equipo = new Equipo(browser, SLUG);
    const telefonos: TelefonoDelComensal[] = [];
    try {
      const duena = await equipo.pagina(info, 'dueno');
      const fallos = [vigilarFallos(duena)];
      await resetear(duena);
      const token = await prepararElPortalDelComensal(duena, {
        mesa: MESA,
        zona: ZONA,
        mesero: null,
        pedidosDelComensal: true,
        envian: 'mesero',
      });
      const comensal = await abrirElQrDeLaMesa(browser, info, SLUG, token);
      telefonos.push(comensal);
      const tel = comensal.page;
      fallos.push(vigilarFallos(tel));
      const avisosDe = async (tipo: string) =>
        (await avisosDeLaMesa(duena, MESA)).filter(
          (a) => a.tipo === tipo && a.estado === 'pendiente',
        );

      await test.step('con un platillo en el carrito, «Atención» no tapa la barra a 320 y 375 px', async () => {
        await tel
          .locator('button.menu-tarjeta')
          .filter({ has: tel.getByText(CARTA.cerveza.nombre, { exact: true }) })
          .click();
        await tel.getByRole('button', { name: /^Agregar/ }).click();
        const barra = tel.getByRole('button', { name: /^Pedido de la mesa/ });
        await expect(barra).toBeVisible();
        const flotante = tel
          .getByRole('button', { name: 'Atención', exact: true })
          .locator('xpath=..');
        for (const ancho of [320, 375]) {
          await tel.setViewportSize({ width: ancho, height: 700 });
          const [b, f] = [await barra.boundingBox(), await flotante.boundingBox()];
          if (b === null || f === null)
            throw new Error(`A ${String(ancho)} px falta la barra o «Atención».`);
          const seTocan =
            f.x < b.x + b.width &&
            b.x < f.x + f.width &&
            f.y < b.y + b.height &&
            b.y < f.y + f.height;
          expect(
            seTocan,
            `A ${String(ancho)} px «Atención» ${JSON.stringify(f)} tapa la barra ${JSON.stringify(b)}.`,
          ).toBe(false);
          expect(f.y).toBeGreaterThanOrEqual(0);
        }
      });

      await test.step('con el pedido guardado, «Atención» no crea otro aviso ni dice otra cosa', async () => {
        await tel.getByRole('button', { name: /^Pedido de la mesa/ }).click();
        await tel.getByRole('button', { name: 'Llamar a mi mesero para confirmar' }).click();
        await expect(tel.getByText('Tu pedido está guardado.').first()).toBeVisible();
        const [antes] = await avisosDe('ordenar');
        expect(antes, 'El carrito no dejó su aviso.').toBeDefined();
        await expect(tel.getByRole('dialog', { name: 'El pedido de la mesa' })).toBeHidden();
        const llamadas = contarPeticiones(tel, `/api/publico/qr/${token}/carrito/llamar`);
        const avisosNuevos = contarPeticiones(tel, `/api/publico/qr/${token}/solicitud`);
        await tel.getByRole('button', { name: 'Atención', exact: true }).click();
        // La opción dice lo mismo que el carrito, no «Quiero ordenar».
        const volver = tel.getByRole('button', { name: 'Volver a llamar a mi mesero' });
        await expect(volver).toBeVisible();
        await expect(tel.getByRole('button', { name: 'Quiero ordenar' })).toHaveCount(0);
        await volver.click();
        await expect.poll(() => llamadas.respondidas()).toBe(1);
        expect(
          avisosNuevos.enviadas(),
          'Creó un aviso nuevo en vez de llamar por el carrito.',
        ).toBe(0);
        await expect(tel.getByText('Ya avisamos al mesero')).toHaveCount(0);
        await expect(tel.getByText('Solicitud enviada')).toHaveCount(0);
        // DP-13.2 (punto 21): «Volver a llamar» RENUEVA el aviso —el viejo se resuelve y llega uno
        // nuevo, que vuelve a sonar y a decirse—: sigue habiendo UNO pendiente, y no es el viejo.
        const despues = await avisosDe('ordenar');
        expect(despues, 'Quedó más de un aviso pendiente (o ninguno).').toHaveLength(1);
        expect(despues[0]?.id, 'Volver a llamar no renovó el aviso.').not.toBe(antes?.id);
        llamadas.dejarDeContar();
        avisosNuevos.dejarDeContar();
      });

      await test.step('mantener presionado el globo de ayuda la atiende y no abre el menú de la mesa', async () => {
        await tel.getByRole('button', { name: 'Atención', exact: true }).click();
        await tel.getByRole('button', { name: 'Necesito ayuda' }).click();
        await expect(tel.getByText('Solicitud enviada')).toBeVisible();
        const mesero = await equipo.pagina(info, 'mesero');
        await aLaMedida(mesero, info);
        fallos.push(vigilarFallos(mesero));
        await mesero.goto('/mesero');
        const globo = mesero.getByRole('button', {
          name: `Mesa ${String(MESA)}: Necesita ayuda. Tocar para atender.`,
        });
        await expect(globo).toBeVisible({ timeout: 20_000 });
        const atenciones = contarPeticiones(mesero, '/api/restaurante/atender-solicitud');
        const { x, y } = await centro(globo);
        const dedo = await dedoDe(mesero, info);
        await dedo.bajar(x, y);
        // Es el gesto mismo: el dedo (o el ratón) se queda sobre el globo.
        await mesero.waitForTimeout(700);
        await dedo.subir();
        await expect
          .poll(
            async () => (await avisosDeLaMesa(duena, MESA)).find((a) => a.tipo === 'ayuda')?.estado,
          )
          .toBe('atendida');
        await expect(mesero.getByRole('menu', { name: `Mesa ${String(MESA)}` })).toHaveCount(0);
        expect(atenciones.enviadas(), 'Atendió más de una vez.').toBe(1);
        atenciones.dejarDeContar();
      });

      for (const sinFallos of fallos) sinFallos();
    } finally {
      for (const telefono of telefonos) await telefono.cerrar();
      await equipo.cerrar();
    }
  });
});
