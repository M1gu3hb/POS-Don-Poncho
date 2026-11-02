import { expect, type Locator, type Page, test } from '@playwright/test';

import { escribir } from './ayudantes/modo-espera.ts';
import { Equipo } from './ayudantes/roles.ts';
import { arrastrar, escalaDe, mantenerPresionada } from './ayudantes/tacto.ts';
import {
  cabecerasDeEscrituraDePrueba,
  consultarPuente,
  exigirDemostracion,
  vigilarFallos,
} from './ayudantes/sesion.ts';

/**
 * DP-12.3 · UNIR MESAS CON EL DEDO, en la tableta (1280 × 800), el teléfono y la PC.
 *
 * Con tacto real (CDP) donde hay tacto: la mesa sigue al dedo 1:1 en cada cuadro, la vecina se
 * inclina hacia ella cuando se acerca, y al soltar se funden en la forma que les toca —dos
 * cuadradas, un rectángulo; dos redondas una sobre otra, una cápsula vertical; lado a lado, una
 * horizontal—. Con gente se pregunta antes de unir, las alergias llegan a la que queda, y con el
 * globo de la mesa se separan: cada una vuelve a su lugar. Todo se lee del SERVIDOR.
 *
 * El salón de la demo: Interior 1 y 2 cuadradas medianas (120 y 280, y 120), 3 y 6 redondas
 * chicas (440,120 y 460,280); Terraza 7 y 8 redondas medianas (140 y 320, y 140).
 */

const SLUG = 'prueba-restaurante';

interface MesaDelServidor {
  readonly id: string;
  readonly numero: number;
  readonly posicion_x: number | null;
  readonly posicion_y: number | null;
  readonly unida_a_mesa_id: string | null;
  readonly venta_activa_id?: string | null;
}

async function mesa(lector: Page, numero: number): Promise<MesaDelServidor> {
  const [fila] = await consultarPuente<MesaDelServidor>(lector, 'Mesa', {
    filtro: { numero },
    limite: 1,
  });
  if (fila === undefined) throw new Error(`El servidor no tiene la mesa ${String(numero)}.`);
  return fila;
}

async function unionesVivas(lector: Page): Promise<number> {
  const filas = await consultarPuente<{ cerrada_en?: string | null }>(lector, 'UnionMesa', {
    limite: 50,
  });
  return filas.filter((f) => (f.cerrada_en ?? null) === null).length;
}

async function alModoUnir(sala: Page, zona: string): Promise<Locator> {
  await sala.goto('/mesero');
  if (zona !== 'Interior') await sala.getByRole('button', { name: new RegExp(`^${zona}`) }).click();
  await sala.getByRole('button', { name: 'Unir mesas' }).click();
  const plano = sala.getByRole('region', { name: 'Unir mesas' });
  await expect(plano).toBeVisible();
  return plano;
}

const enElPlano = (plano: Locator, numero: number): Locator =>
  plano.getByRole('button', { name: `Mesa ${String(numero)}`, exact: true });

const figuraDe = (plano: Locator): Locator => plano.locator('[data-forma-de-la-union]');

test.describe('unir mesas con el dedo (DP-12.3)', () => {
  test.use({ actionTimeout: 20_000, navigationTimeout: 30_000 });

  test.beforeAll(async ({ playwright }, info) => {
    await exigirDemostracion(playwright, info, SLUG);
  });

  test('siguen al dedo, la vecina llama, se funden por su forma, se pregunta con gente y se separan con el globo', async ({
    browser,
  }, info) => {
    test.setTimeout(6 * 60_000);
    const equipo = new Equipo(browser, SLUG);
    try {
      const duena = await equipo.pagina(info, 'dueno');
      if (info.project.name === 'tablet') await duena.setViewportSize({ width: 1280, height: 800 });
      const sinFallos = vigilarFallos(duena);
      const reseteo = await duena.request.post('/api/pruebas/resetear', {
        headers: cabecerasDeEscrituraDePrueba(),
        data: { confirmacion: 'RESETEAR' },
      });
      expect(reseteo.status(), `resetear_demo: ${await reseteo.text()}`).toBe(200);
      const [siete, ochoAntes] = [await mesa(duena, 7), await mesa(duena, 8)];
      await escribir(duena, '/api/restaurante/abrir-mesa', {
        mesaId: siete.id,
        personas: 2,
        notasAlergias: 'Mariscos',
      });
      await escribir(duena, '/api/restaurante/abrir-mesa', {
        mesaId: ochoAntes.id,
        personas: 3,
        notasAlergias: 'Nueces',
      });

      await test.step('dos cuadradas lado a lado se funden en un rectángulo', async () => {
        const plano = await alModoUnir(duena, 'Interior');
        const laDos = enElPlano(plano, 2);
        await arrastrar(duena, info, laDos, { dx: -60, dy: 0, escala: await escalaDe(laDos, 80) });
        await expect(enElPlano(plano, 1)).toHaveAttribute('aria-pressed', 'true');
        await expect(laDos).toHaveAttribute('aria-pressed', 'true');
        await expect(figuraDe(plano)).toHaveAttribute('data-forma-de-la-union', 'rectangulo');
        await plano.getByRole('button', { name: 'Cancelar' }).click();
        await expect(plano).toBeHidden();
      });

      await test.step('dos redondas, una sobre otra, se funden en una cápsula vertical', async () => {
        const plano = await alModoUnir(duena, 'Interior');
        const laTres = enElPlano(plano, 3);
        await arrastrar(duena, info, laTres, {
          dx: 20,
          dy: 80,
          escala: await escalaDe(laTres, 60),
        });
        await expect(enElPlano(plano, 6)).toHaveAttribute('aria-pressed', 'true');
        await expect(figuraDe(plano)).toHaveAttribute('data-forma-de-la-union', 'capsula-vertical');
        await plano.getByRole('button', { name: 'Cancelar' }).click();
        await expect(plano).toBeHidden();
        expect(await unionesVivas(duena), 'Cancelar unió las mesas.').toBe(0);
      });

      await test.step('la 8 sigue al dedo 1:1, la 7 se inclina hacia ella y lado a lado son una cápsula', async () => {
        const plano = await alModoUnir(duena, 'Terraza');
        const [laSiete, laOcho] = [enElPlano(plano, 7), enElPlano(plano, 8)];
        let inclinacion = 0;
        const peor = await arrastrar(
          duena,
          info,
          laOcho,
          { dx: -80, dy: 0, escala: await escalaDe(laOcho, 80) },
          async () => {
            const corrimiento = await laSiete.evaluate((n) => getComputedStyle(n).translate);
            inclinacion = Math.max(inclinacion, Math.abs(Number.parseFloat(corrimiento) || 0));
          },
        );
        expect(peor, 'La mesa no sigue al dedo: se despega en algún cuadro.').toBeLessThan(2);
        expect(
          inclinacion,
          'La vecina no se inclinó hacia la mesa que se acercaba.',
        ).toBeGreaterThan(0);
        await expect(laSiete).toHaveAttribute('aria-pressed', 'true');
        await expect(laOcho).toHaveAttribute('aria-pressed', 'true');
        await expect(figuraDe(plano)).toHaveAttribute(
          'data-forma-de-la-union',
          'capsula-horizontal',
        );
      });

      await test.step('con gente se pregunta antes: «Cancelar» no une', async () => {
        const plano = duena.getByRole('region', { name: 'Unir mesas' });
        await plano.getByRole('button', { name: /^Unir 2 mesas/ }).click();
        const aviso = duena.getByRole('alertdialog', { name: '¿Unir de todos modos?' });
        await expect(aviso).toContainText('La Mesa 7 tiene gente');
        await expect(aviso).toContainText('La Mesa 8 tiene gente');
        await aviso.getByRole('button', { name: 'Cancelar' }).click();
        await expect(aviso).toBeHidden();
        expect(await unionesVivas(duena), 'Se unieron sin decir «Unir».').toBe(0);
      });

      await test.step('«Unir» de todos modos: queda la 7 y las alergias de la 8 llegan a su cuenta', async () => {
        const plano = duena.getByRole('region', { name: 'Unir mesas' });
        await plano.getByRole('button', { name: /^Unir 2 mesas/ }).click();
        const aviso = duena.getByRole('alertdialog', { name: '¿Unir de todos modos?' });
        await aviso.getByRole('button', { name: 'Unir', exact: true }).click();
        const numero = duena.getByRole('alertdialog', { name: '¿Qué número queda?' });
        await numero.getByRole('radio', { name: 'Mesa 7' }).click();
        await numero.getByRole('button', { name: 'Unir', exact: true }).click();
        // El diálogo es modal y esconde el plano: primero se cierra él (el servidor contestó).
        await expect(numero).toBeHidden();
        await expect(plano).toBeHidden();
        expect((await mesa(duena, 8)).unida_a_mesa_id, 'La 8 no quedó unida a la 7.').toBe(
          siete.id,
        );
        const cuenta = (await mesa(duena, 7)).venta_activa_id ?? '';
        const [venta] = await consultarPuente<{ notas_alergias?: string | null }>(duena, 'Venta', {
          filtro: { id: cuenta },
          limite: 1,
        });
        expect(venta?.notas_alergias, 'Las alergias de la 8 se perdieron al unir.').toBe(
          'Mariscos · Nueces',
        );
      });

      await test.step('con el globo de la mesa se separan: la 8 vuelve a su lugar', async () => {
        const laSiete = duena.locator(`[data-mesa-id="${siete.id}"]`).first();
        await expect(laSiete).toBeVisible();
        await mantenerPresionada(duena, info, laSiete);
        await duena.getByRole('menuitem', { name: 'Separar mesas' }).click();
        const pregunta = duena.getByRole('alertdialog', { name: '¿Separar las mesas?' });
        await pregunta.getByRole('button', { name: 'Separar mesas' }).click();
        await expect(pregunta).toBeHidden();
        await expect(duena.getByRole('region', { name: 'Unir mesas' })).toBeHidden();
        expect(await unionesVivas(duena)).toBe(0);
        const ocho = await mesa(duena, 8);
        expect(
          [ocho.unida_a_mesa_id, ocho.posicion_x, ocho.posicion_y],
          'La 8 no volvió a su lugar.',
        ).toEqual([null, ochoAntes.posicion_x, ochoAntes.posicion_y]);
      });

      sinFallos();
    } finally {
      await equipo.cerrar();
    }
  });
});
