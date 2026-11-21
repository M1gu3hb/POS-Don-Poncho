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
 * DP-24 · P5 · «AGREGAR MESAS» A UN GRUPO YA UNIDO, con el dedo, en la tableta y el teléfono.
 *
 * Interior de la demo: 3 y 6 (redondas chicas) y 1 (cuadrada mediana). La 3 y la 6 ya están
 * unidas (la 3 principal); desde la mesa activa de la 3 el mesero toca «Agregar mesas», toca la 1
 * y la agrega. Con dedo: los botones y la tesela miden 44 px o más, y todo se lee del SERVIDOR: la
 * 1 queda oculta en el grupo de la 3, y su alergia llega a la cuenta del grupo.
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

test.describe('agregar mesas al grupo (DP-24 · P5)', () => {
  test.use({ actionTimeout: 20_000, navigationTimeout: 30_000 });

  test.beforeAll(async ({ playwright }, info) => {
    await exigirDemostracion(playwright, info, SLUG);
  });

  test('desde la mesa del grupo se agrega otra con un toque, y su cuenta y sus alergias llegan al grupo', async ({
    browser,
  }, info) => {
    test.setTimeout(5 * 60_000);
    const equipo = new Equipo(browser, SLUG);
    try {
      const duena = await equipo.pagina(info, 'dueno');
      const sinFallos = vigilarFallos(duena);
      const reseteo = await duena.request.post('/api/pruebas/resetear', {
        headers: cabecerasDeEscrituraDePrueba(),
        data: { confirmacion: 'RESETEAR' },
      });
      expect(reseteo.status(), `resetear_demo: ${await reseteo.text()}`).toBe(200);

      const [tres, seis, una] = [await mesa(duena, 3), await mesa(duena, 6), await mesa(duena, 1)];
      await escribir(duena, '/api/restaurante/abrir-mesa', { mesaId: tres.id, personas: 2 });
      await escribir(duena, '/api/restaurante/abrir-mesa', {
        mesaId: una.id,
        personas: 3,
        notasAlergias: 'Nueces',
      });
      // La 6 se pega debajo de la 3 (chicas: 60 de lado; la 3 está en y = 120).
      await escribir(duena, '/api/restaurante/unir-mesas', {
        mesaPrincipalId: tres.id,
        mesaIds: [seis.id],
        posiciones: [{ mesaId: seis.id, x: 440, y: 180 }],
      });

      await duena.goto(`/restaurante/mesa-activa?mesa=${encodeURIComponent(tres.id)}`);
      const agregar = duena.getByRole('button', { name: 'Agregar mesas', exact: true });
      await expect(agregar).toBeVisible();
      await exigirBlancoDelDedo(agregar, info);
      await tocar(agregar, info);

      const dialogo = duena.getByRole('dialog', { name: 'Agregar mesas al grupo' });
      await expect(dialogo).toBeVisible();
      const laUna = dialogo.getByRole('button', { name: /^Mesa\s*1(?!\d)/ });
      await exigirBlancoDelDedo(laUna, info);
      await tocar(laUna, info);
      await expect(laUna).toHaveAttribute('aria-pressed', 'true');
      const confirmar = dialogo.getByRole('button', { name: 'Agregar 1 mesa', exact: true });
      await exigirBlancoDelDedo(confirmar, info);
      await tocar(confirmar, info);
      await expect(dialogo).toBeHidden();

      // La mesa activa del grupo ahora dice con quién está unida.
      await expect(duena.getByText(/Unida con.*1/)).toBeVisible();

      expect((await mesa(duena, 1)).unida_a_mesa_id, 'La 1 no quedó en el grupo de la 3.').toBe(
        tres.id,
      );
      expect((await mesa(duena, 6)).unida_a_mesa_id, 'La 6 salió del grupo.').toBe(tres.id);
      const cuenta = (await mesa(duena, 3)).venta_activa_id ?? '';
      const [venta] = await consultarPuente<{ notas_alergias?: string | null }>(duena, 'Venta', {
        filtro: { id: cuenta },
        limite: 1,
      });
      expect(venta?.notas_alergias, 'La alergia de la 1 no llegó a la cuenta del grupo.').toBe(
        'Nueces',
      );
      const uniones = await consultarPuente<{ cerrada_en?: string | null }>(duena, 'UnionMesa', {
        limite: 50,
      });
      expect(
        uniones.filter((u) => (u.cerrada_en ?? null) === null),
        'Debe haber un solo grupo vivo.',
      ).toHaveLength(1);

      sinFallos();
    } finally {
      await equipo.cerrar();
    }
  });
});
