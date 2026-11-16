import { expect, type Locator, type Page, test } from '@playwright/test';

import { Equipo } from './ayudantes/roles.ts';
import { consultarPuente, exigirDemostracion, vigilarFallos } from './ayudantes/sesion.ts';
import { dedoDe, mantenerPresionada } from './ayudantes/tacto.ts';

/**
 * DP-21 · Bloque 9 · EL MAPA DE MESAS ESCALABLE (O4/M2). SIN CORRER: la corre el orquestador con el
 * build.
 *
 * LO QUE SUPONE DEL NEGOCIO DE PRUEBA (ajustar si falla al correrla):
 *   · `prueba-restaurante` con su salón de la demo: la zona «Interior» (la que abre `/mesero`) tiene
 *     las mesas 1 y 2 cuadradas medianas, y 3 y 6 REDONDAS CHICAS (60 × 60), con posiciones hasta
 *     ≈ (460, 280); es poco ancho para forzar la escala con una pantalla normal, así que las pruebas
 *     que la necesitan ACHICAN LA VENTANA EN ALTO (800 × 420): el alto que queda para el mapa es el que
 *     manda y la escala baja o el mapa se desplaza;
 *   · el mapa del mesero (≥ 768 px de ancho; abajo es la rejilla del teléfono, sin lienzo) lleva
 *     `data-mapa-de-mesas`, `data-escala` y `data-desplaza`; cada mesa, `data-mesa-id`;
 *   · la dueña ve la barra lateral ABIERTA al entrar (más de dos secciones) con «Ocultar menú»; en
 *     el teléfono (Pixel 7, 412 px) no hay mapa y estas pruebas se saltan;
 *   · la pulsación larga y el globo (`[data-menu-de-la-mesa]`) son los de `tacto.ts`.
 */

const SLUG = 'prueba-restaurante';
const MINIMO_PX = 56;

interface MesaDelServidor {
  readonly id: string;
  readonly numero: number;
  readonly posicion_x: number | null;
  readonly posicion_y: number | null;
}

const mapaDe = (pagina: Page): Locator => pagina.locator('[data-mapa-de-mesas]');

/** Cuántos puntos del plano miden de ancho: lo que mide el elemento SIN la escala. */
async function medidasDe(mesa: Locator) {
  return mesa.evaluate((nodo) => {
    const caja = nodo.getBoundingClientRect();
    const natural = nodo as HTMLElement;
    return {
      pantalla: { ancho: caja.width, alto: caja.height },
      plano: { ancho: natural.offsetWidth, alto: natural.offsetHeight },
    };
  });
}

/** ¿La mesa cae por completo dentro de la caja del mapa (con un píxel de tolerancia)? */
async function dentroDelMapa(pagina: Page, mesa: Locator): Promise<boolean> {
  const [caja, suya] = [await mapaDe(pagina).boundingBox(), await mesa.boundingBox()];
  if (caja === null || suya === null) return false;
  return (
    suya.x >= caja.x - 1 &&
    suya.y >= caja.y - 1 &&
    suya.x + suya.width <= caja.x + caja.width + 1 &&
    suya.y + suya.height <= caja.y + caja.height + 1
  );
}

test.describe('el mapa de mesas escalable (DP-21 · O4/M2)', () => {
  test.use({ actionTimeout: 20_000, navigationTimeout: 30_000 });

  test.beforeAll(async ({ playwright }, info) => {
    await exigirDemostracion(playwright, info, SLUG);
  });

  test.beforeEach((_fixtures, info) => {
    test.skip(
      (info.project.use.viewport?.width ?? 0) < 768,
      'abajo de 768 px no hay mapa: hay rejilla',
    );
  });

  test('con la barra abierta o cerrada ninguna mesa queda cortada, y no se movió ninguna posición', async ({
    browser,
  }, info) => {
    test.setTimeout(4 * 60_000);
    const equipo = new Equipo(browser, SLUG);
    try {
      const duena = await equipo.pagina(info, 'dueno');
      const sinFallos = vigilarFallos(duena);
      await duena.setViewportSize({ width: 1100, height: 800 });
      await duena.goto('/mesero');
      await duena.evaluate(() => {
        localStorage.removeItem('mpos.barra-lateral');
      });
      await duena.reload();
      await expect(mapaDe(duena)).toBeVisible();
      const mesas = duena.locator('[data-mesa-id]');
      await expect(mesas.first()).toBeVisible();

      await test.step('con la barra abierta', async () => {
        await expect(duena.getByRole('button', { name: 'Ocultar menú' })).toBeVisible();
        const hay = await mesas.count();
        for (let i = 0; i < hay; i += 1) {
          expect(await dentroDelMapa(duena, mesas.nth(i)), `La mesa ${String(i)} se corta.`).toBe(
            true,
          );
        }
      });

      await test.step('con la barra cerrada', async () => {
        await duena.getByRole('button', { name: 'Ocultar menú' }).click();
        await expect(duena.getByRole('button', { name: 'Mostrar menú' })).toBeVisible();
        const hay = await mesas.count();
        for (let i = 0; i < hay; i += 1) {
          expect(await dentroDelMapa(duena, mesas.nth(i))).toBe(true);
        }
      });

      await test.step('las posiciones guardadas son las mismas que se pintan (sin escala)', async () => {
        const hay = await mesas.count();
        for (let i = 0; i < hay; i += 1) {
          const id = await mesas.nth(i).getAttribute('data-mesa-id');
          const [guardada] = await consultarPuente<MesaDelServidor>(duena, 'Mesa', {
            filtro: { id },
            limite: 1,
          });
          if (guardada?.posicion_x === undefined || guardada.posicion_x === null) continue;
          const estilo = await mesas.nth(i).evaluate((n) => ({
            izquierda: (n as HTMLElement).style.left,
            arriba: (n as HTMLElement).style.top,
          }));
          expect(estilo.izquierda).toBe(`${String(guardada.posicion_x)}px`);
          expect(estilo.arriba).toBe(`${String(guardada.posicion_y)}px`);
        }
      });
      await duena.evaluate(() => {
        localStorage.removeItem('mpos.barra-lateral');
      });
      sinFallos();
    } finally {
      await equipo.cerrar();
    }
  });

  test('con poco alto: ninguna mesa baja de 56 px, y todas se alcanzan (se desplaza el mapa)', async ({
    browser,
  }, info) => {
    test.setTimeout(4 * 60_000);
    const equipo = new Equipo(browser, SLUG);
    try {
      const duena = await equipo.pagina(info, 'dueno');
      await duena.setViewportSize({ width: 800, height: 420 });
      await duena.goto('/mesero');
      const mesas = duena.locator('[data-mesa-id]');
      await expect(mesas.first()).toBeVisible();
      const escala = Number(await mapaDe(duena).getAttribute('data-escala'));
      expect(escala).toBeGreaterThan(0);
      expect(escala).toBeLessThanOrEqual(1);

      const hay = await mesas.count();
      for (let i = 0; i < hay; i += 1) {
        const mesa = mesas.nth(i);
        const medidas = await medidasDe(mesa);
        // Las que ya medían menos de 56 a escala 1 (la rectangular chica) no se encogen más.
        const ladoCortoPlano = Math.min(medidas.plano.ancho, medidas.plano.alto);
        const ladoCortoPantalla = Math.min(medidas.pantalla.ancho, medidas.pantalla.alto);
        if (ladoCortoPlano >= MINIMO_PX) {
          expect(ladoCortoPantalla, `La mesa ${String(i)} bajó de 56 px.`).toBeGreaterThanOrEqual(
            MINIMO_PX - 0.5,
          );
        }
        // Alcanzable: llevarla a la vista la deja dentro de la caja del mapa.
        await mesa.scrollIntoViewIfNeeded();
        expect(
          await dentroDelMapa(duena, mesa),
          `La mesa ${String(i)} quedó fuera de alcance.`,
        ).toBe(true);
      }
    } finally {
      await equipo.cerrar();
    }
  });

  test('con el dedo se desplaza el mapa cuando no cabe (sólo donde hay tacto)', async ({
    browser,
  }, info) => {
    test.skip(info.project.use.hasTouch !== true, 'el deslizamiento con el dedo necesita tacto');
    test.setTimeout(3 * 60_000);
    const equipo = new Equipo(browser, SLUG);
    try {
      const duena = await equipo.pagina(info, 'dueno');
      await duena.setViewportSize({ width: 800, height: 360 });
      await duena.goto('/mesero');
      await expect(duena.locator('[data-mesa-id]').first()).toBeVisible();
      const mapa = mapaDe(duena);
      test.skip(
        (await mapa.getAttribute('data-desplaza')) !== 'true',
        'con este negocio de prueba el mapa cabe: no hay qué desplazar',
      );
      const antes = await mapa.evaluate((n) => ({ x: n.scrollLeft, y: n.scrollTop }));
      const caja = await mapa.boundingBox();
      if (caja === null) throw new Error('El mapa no tiene caja.');
      const dedo = await dedoDe(duena, info);
      const x = caja.x + caja.width / 2;
      await dedo.bajar(x, caja.y + caja.height - 20);
      for (let paso = 1; paso <= 8; paso += 1) {
        await dedo.mover(x, caja.y + caja.height - 20 - paso * 20);
      }
      await dedo.subir();
      await expect
        .poll(async () => mapa.evaluate((n) => n.scrollTop), { message: 'El mapa no se movió.' })
        .toBeGreaterThan(antes.y);
    } finally {
      await equipo.cerrar();
    }
  });

  test('mantener presionada una mesa con el mapa escalado abre el globo junto al dedo', async ({
    browser,
  }, info) => {
    test.setTimeout(3 * 60_000);
    const equipo = new Equipo(browser, SLUG);
    try {
      const duena = await equipo.pagina(info, 'dueno');
      await duena.setViewportSize({ width: 800, height: 420 });
      await duena.goto('/mesero');
      const mesa = duena.locator('[data-mesa-id]').first();
      await expect(mesa).toBeVisible();
      await mesa.scrollIntoViewIfNeeded();
      const caja = await mesa.boundingBox();
      if (caja === null) throw new Error('La mesa no tiene caja.');
      await mantenerPresionada(duena, info, mesa);
      const globo = duena.locator('[data-menu-de-la-mesa] [role="menu"]');
      await expect(globo).toBeVisible();
      const suyo = await globo.boundingBox();
      if (suyo === null) throw new Error('El globo no tiene caja.');
      // Junto al dedo (la pantalla), no corrido por la escala del lienzo.
      expect(Math.abs(suyo.x - (caja.x + caja.width / 2))).toBeLessThan(260);
      expect(Math.abs(suyo.y - (caja.y + caja.height / 2))).toBeLessThan(260);
    } finally {
      await equipo.cerrar();
    }
  });
});
