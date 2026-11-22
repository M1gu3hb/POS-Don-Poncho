import { expect, type Page, test } from '@playwright/test';

import { Equipo } from './ayudantes/roles.ts';
import {
  cabecerasDeEscrituraDePrueba,
  consultarPuente,
  exigirDemostracion,
} from './ayudantes/sesion.ts';

/**
 * DP-25 · Parte 9 · EL EDITOR DEL MAPA DE MESAS (Configuración → Mesas).
 *
 * 1. Una arrastrada es UNA escritura: mientras la mesa sigue al dedo no se guarda nada, y al soltar
 *    se guarda una sola vez (en producción hubo miles de escrituras de posición en dos horas).
 * 2. Un número que ya tiene otra mesa activa no sale como «Algo falló»: la pantalla dice cuál choca.
 */

const SLUG = 'prueba-restaurante';
const PASOS = 25;

interface Mesa {
  readonly id: string;
  readonly numero: number;
  readonly activo?: boolean | null;
  readonly posicion_x?: number | null;
}

interface Escritura {
  readonly entidad?: string;
  readonly operacion?: string;
  readonly id?: string;
  readonly datos?: Record<string, unknown>;
}

interface Peticion {
  url(): string;
  method(): string;
  postData(): string | null;
}

/** Las escrituras de Mesa que han salido de la página desde que se llamó. */
function vigilarEscriturasDeMesa(pagina: Page): { readonly vistas: Escritura[]; parar(): void } {
  const vistas: Escritura[] = [];
  const alPedir = (peticion: Peticion): void => {
    if (!peticion.url().endsWith('/api/datos/escribir') || peticion.method() !== 'POST') return;
    try {
      const cuerpo = JSON.parse(peticion.postData() ?? '{}') as { entrada?: Escritura } & Escritura;
      const escritura = cuerpo.entrada ?? cuerpo;
      if (escritura.entidad === 'Mesa') vistas.push(escritura);
    } catch {
      // Un cuerpo que no es JSON no es una escritura del puente.
    }
  };
  pagina.on('request', alPedir);
  return {
    vistas,
    parar: () => {
      pagina.off('request', alPedir);
    },
  };
}

/** Arrastra la primera mesa del editor: la agarra, la mueve en `PASOS` pasos y la deja agarrada. */
async function agarrarYMover(pagina: Page): Promise<string> {
  const mesa = pagina.locator('[data-mesa-id]').first();
  await expect(mesa).toBeVisible();
  const caja = await mesa.boundingBox();
  if (caja === null) throw new Error('La mesa no está a la vista.');
  const centro = { x: caja.x + caja.width / 2, y: caja.y + caja.height / 2 };
  await pagina.mouse.move(centro.x, centro.y);
  await pagina.mouse.down();
  for (let paso = 1; paso <= PASOS; paso += 1) {
    await pagina.mouse.move(centro.x + paso * 6, centro.y + paso * 3);
  }
  return (await mesa.getAttribute('data-mesa-id')) ?? '';
}

test.describe('el editor del mapa de mesas (DP-25 · P9)', () => {
  test.use({ actionTimeout: 20_000, navigationTimeout: 30_000 });

  test.beforeAll(async ({ playwright }, info) => {
    await exigirDemostracion(playwright, info, SLUG);
  });

  test('una arrastrada es UNA escritura, y sólo al soltar', async ({ browser }, info) => {
    test.setTimeout(3 * 60_000);
    const equipo = new Equipo(browser, SLUG);
    try {
      const duena = await equipo.pagina(info, 'dueno');
      const reseteo = await duena.request.post('/api/pruebas/resetear', {
        headers: cabecerasDeEscrituraDePrueba(),
        data: { confirmacion: 'RESETEAR' },
      });
      expect(reseteo.status(), `resetear_demo: ${await reseteo.text()}`).toBe(200);
      await duena.goto('/configuracion?tab=mesas');
      const primera = (await consultarPuente<Mesa>(duena, 'Mesa', { limite: 200 })).find(
        (m) => m.activo !== false,
      );
      const vigilancia = vigilarEscriturasDeMesa(duena);
      try {
        const id = await agarrarYMover(duena);
        await duena.waitForTimeout(800);
        expect(vigilancia.vistas, 'Se guardó con la mesa todavía en el aire.').toHaveLength(0);

        await duena.mouse.up();
        await expect.poll(() => vigilancia.vistas.length).toBeGreaterThanOrEqual(1);
        // Lo que sale tarde también se cuenta.
        await duena.waitForTimeout(1_500);
        expect(vigilancia.vistas, 'Una arrastrada debía ser UNA escritura.').toHaveLength(1);
        expect(vigilancia.vistas[0]).toMatchObject({ operacion: 'update', id });
        expect(Object.keys(vigilancia.vistas[0]?.datos ?? {}).sort()).toEqual([
          'posicion_x',
          'posicion_y',
        ]);
        const despues = (await consultarPuente<Mesa>(duena, 'Mesa', { limite: 200 })).find(
          (m) => m.id === id,
        );
        expect(despues?.posicion_x, 'La posición no se guardó.').not.toBe(primera?.posicion_x);
      } finally {
        vigilancia.parar();
      }
    } finally {
      await equipo.cerrar();
    }
  });

  test('un número repetido lo dice la pantalla, con el número', async ({ browser }, info) => {
    test.setTimeout(3 * 60_000);
    const equipo = new Equipo(browser, SLUG);
    try {
      const duena = await equipo.pagina(info, 'dueno');
      await duena.goto('/configuracion?tab=mesas');
      const dialogo = duena.getByRole('dialog').filter({ hasText: 'Nombre visible' });
      await duena.getByRole('button', { name: 'Nueva mesa' }).click();
      await dialogo.locator('input[type="number"]').first().fill('1');
      await dialogo.getByRole('button', { name: 'Crear mesa' }).click();

      await expect(
        duena.getByText(/Ya hay una mesa activa con el número 1\./).first(),
      ).toBeVisible();
      await expect(duena.getByText(/Algo falló/)).toHaveCount(0);
      const activas = (await consultarPuente<Mesa>(duena, 'Mesa', { limite: 200 })).filter(
        (m) => m.activo !== false && m.numero === 1,
      );
      expect(activas, 'Quedó una segunda mesa 1.').toHaveLength(1);
    } finally {
      await equipo.cerrar();
    }
  });
});
