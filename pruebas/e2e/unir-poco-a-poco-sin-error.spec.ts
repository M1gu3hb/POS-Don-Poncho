import { expect, type Locator, type Page, test, type TestInfo } from '@playwright/test';

import { escribir } from './ayudantes/modo-espera.ts';
import { Equipo } from './ayudantes/roles.ts';
import {
  cabecerasDeEscrituraDePrueba,
  consultarPuente,
  exigirDemostracion,
  vigilarFallos,
} from './ayudantes/sesion.ts';

/**
 * DP-25 · P6 · UNIR MESAS POCO A POCO, SIN FORMA DE EQUIVOCARSE, con el dedo (tableta y teléfono).
 *
 * Interior de la demo: 3 y 6 (redondas chicas), 1 y 2 (cuadradas medianas). Todas con su cuenta.
 *
 *   1. La 3 y la 6 ya son un grupo (la 3, principal). Desde la mesa activa de la 3 el mesero toca
 *      «Unir mesas», toca la 1 y «Agregar al grupo»: la 1 entra al grupo de la 3 (antes: «ya
 *      pertenece a un grupo») y se avisa «La cuenta de la mesa 1 pasó a la mesa 3».
 *   2. Desde la mesa 6 —UNA DEL GRUPO, no la principal— se ve a cuál está unida, hay un botón para
 *      ir a ella y «Agregar mesas» (≥ 44 px) agrega la 2 al mismo grupo.
 *   3. En la cuenta de la 3, cada platillo dice de qué mesa vino: «(Mesa 1)» y «(Mesa 2)».
 *
 * Todo se comprueba en el SERVIDOR: un solo grupo vivo, con la 3 como principal.
 */

const SLUG = 'prueba-restaurante';
const BLANCO_DEL_DEDO = 44;

interface MesaDelServidor {
  readonly id: string;
  readonly numero: number;
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

async function tocar(objetivo: Locator, info: TestInfo): Promise<void> {
  await (info.project.use.hasTouch === true ? objetivo.tap() : objetivo.click());
}

async function exigirBlancoDelDedo(objetivo: Locator, info: TestInfo): Promise<void> {
  if (info.project.use.hasTouch !== true) return;
  const caja = await objetivo.boundingBox();
  expect(caja, 'El botón no se pinta.').not.toBeNull();
  expect(caja?.height ?? 0, 'El blanco mide menos de 44 px de alto.').toBeGreaterThanOrEqual(
    BLANCO_DEL_DEDO,
  );
}

async function gruposVivos(lector: Page): Promise<readonly { mesa_principal_id?: string }[]> {
  const filas = await consultarPuente<{ cerrada_en?: string | null; mesa_principal_id?: string }>(
    lector,
    'UnionMesa',
    { limite: 50 },
  );
  return filas.filter((f) => (f.cerrada_en ?? null) === null);
}

test.describe('unir mesas poco a poco, sin error (DP-25 · P6)', () => {
  test.use({ actionTimeout: 20_000, navigationTimeout: 30_000 });

  test.beforeAll(async ({ playwright }, info) => {
    await exigirDemostracion(playwright, info, SLUG);
  });

  test('desde la principal y desde una mesa del grupo se agregan mesas, y la cuenta dice de dónde vino cada platillo', async ({
    browser,
  }, info) => {
    test.setTimeout(6 * 60_000);
    const equipo = new Equipo(browser, SLUG);
    try {
      const duena = await equipo.pagina(info, 'dueno');
      const sinFallos = vigilarFallos(duena);
      const reseteo = await duena.request.post('/api/pruebas/resetear', {
        headers: cabecerasDeEscrituraDePrueba(),
        data: { confirmacion: 'RESETEAR' },
      });
      expect(reseteo.status(), `resetear_demo: ${await reseteo.text()}`).toBe(200);

      const [tres, seis, una, dos] = [
        await mesa(duena, 3),
        await mesa(duena, 6),
        await mesa(duena, 1),
        await mesa(duena, 2),
      ];
      const productos = await consultarPuente<{ id: string; nombre: string }>(
        duena,
        'ProductoTerminado',
        { limite: 80 },
      );
      const platillo = productos[0]?.id ?? '';
      expect(platillo, 'La demo no trae platillos.').not.toBe('');
      for (const m of [tres, una, dos]) {
        const apertura = await escribir(duena, '/api/restaurante/abrir-mesa', {
          mesaId: m.id,
          personas: 2,
        });
        await escribir(duena, '/api/restaurante/enviar-pedido', {
          ordenId: String(apertura.datos?.['ordenId']),
          lineas: [{ productoId: platillo, cantidad: '1' }],
        });
      }
      await escribir(duena, '/api/restaurante/unir-mesas', {
        mesaPrincipalId: tres.id,
        mesaIds: [seis.id],
        posiciones: [{ mesaId: seis.id, x: 440, y: 180 }],
      });

      await test.step('desde la principal: «Unir mesas», la 1 se pega al grupo y entra a él', async () => {
        await duena.goto(`/restaurante/mesa-activa?mesa=${encodeURIComponent(tres.id)}`);
        await tocar(duena.getByRole('button', { name: 'Unir mesas', exact: true }), info);
        const plano = duena.getByRole('region', { name: 'Unir mesas' });
        await expect(plano).toBeVisible();
        // Las mesas tiemblan para decir «me puedes mover»: sin ese temblor un toque acierta.
        await duena.emulateMedia({ reducedMotion: 'reduce' });
        await tocar(plano.getByRole('button', { name: 'Mesa 1', exact: true }), info);
        const agregar = plano.getByRole('button', { name: 'Agregar al grupo', exact: true });
        await expect(agregar).toBeEnabled();
        await exigirBlancoDelDedo(agregar, info);
        await tocar(agregar, info);
        // La 1 tiene gente y un pedido: se pregunta antes de unir, como siempre.
        const pregunta = duena.getByRole('alertdialog', { name: '¿Unir de todos modos?' });
        await tocar(pregunta.getByRole('button', { name: 'Unir', exact: true }), info);
        await expect(duena.getByText('La cuenta de la mesa 1 pasó a la mesa 3.')).toBeVisible();
        await expect(plano).toBeHidden();
        expect((await mesa(duena, 1)).unida_a_mesa_id, 'La 1 no entró al grupo de la 3.').toBe(
          tres.id,
        );
        expect(await gruposVivos(duena), 'Debe seguir habiendo un solo grupo.').toHaveLength(1);
      });

      await test.step('desde una mesa del grupo (la 6): dice a cuál está unida y agrega la 2', async () => {
        await duena.goto(`/restaurante/mesa-activa?mesa=${encodeURIComponent(seis.id)}`);
        await expect(duena.getByText(/Mesa 6 está unida a la 3/)).toBeVisible();
        const irA = duena.getByRole('button', { name: 'Ir a la 3', exact: true });
        await expect(irA).toBeVisible();
        await exigirBlancoDelDedo(irA, info);
        const agregar = duena.getByRole('button', { name: 'Agregar mesas', exact: true });
        await expect(agregar).toBeVisible();
        await exigirBlancoDelDedo(agregar, info);
        await tocar(agregar, info);
        const dialogo = duena.getByRole('dialog', { name: 'Agregar mesas al grupo' });
        await expect(dialogo).toBeVisible();
        const laDos = dialogo.getByRole('button', { name: /^Mesa\s*2(?!\d)/ });
        await exigirBlancoDelDedo(laDos, info);
        await tocar(laDos, info);
        await tocar(dialogo.getByRole('button', { name: 'Agregar 1 mesa', exact: true }), info);
        await expect(dialogo).toBeHidden();
        await expect(duena.getByText('La cuenta de la mesa 2 pasó a la mesa 3.')).toBeVisible();
        expect((await mesa(duena, 2)).unida_a_mesa_id, 'La 2 no entró al grupo de la 3.').toBe(
          tres.id,
        );
        expect(await gruposVivos(duena)).toHaveLength(1);
      });

      await test.step('la cuenta de la 3 dice de qué mesa vino cada platillo', async () => {
        await duena.goto(`/restaurante/mesa-activa?mesa=${encodeURIComponent(tres.id)}`);
        const origenes = duena.locator('[data-origen-del-renglon]');
        await expect(origenes).toHaveCount(2);
        await expect(origenes.filter({ hasText: 'Mesa 1' })).toHaveCount(1);
        await expect(origenes.filter({ hasText: 'Mesa 2' })).toHaveCount(1);
      });

      sinFallos();
    } finally {
      await equipo.cerrar();
    }
  });
});
