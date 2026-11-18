import type { Page } from '@playwright/test';

import { Equipo, type RolDePrueba } from '../ayudantes/roles.ts';
import { exigirDemostracion } from '../ayudantes/sesion.ts';

import { irASeccion, tarjeta } from './arnes/configuracion.ts';
import { navegadorDe, prepararContexto } from './arnes/ligero.ts';
import { expect, exigirServidor, test } from './arnes/prueba.ts';
import { toque } from './arnes/toque.ts';

/**
 * Lo que dice «Así se oye una comanda». Va LITERAL: importar `comanda-de-ejemplo.ts` arrastra
 * módulos de la app con el alias `~/`, que el proyecto de TypeScript de `pruebas/` no conoce. La
 * frase la fija `apps/web/src/voz/comanda-de-ejemplo.test.ts`: si cambia, cambian las dos.
 */
const FRASE_DE_EJEMPLO =
  'Nuevo pedido mesa 4: tres Consomés de carnero; dos Mixiotes, Sin picante; medio kilo de Barbacoa de horno.';

/**
 * DP-22 · «ESTE APARATO»: lo que se guarda en el navegador de CADA aparato, cambiado con el dedo.
 *
 * Cada prueba va a Configuración → Este aparato (o a donde viva el control), toca el control y mira
 * DOS cosas: lo que quedó guardado en el aparato (la clave de `localStorage`) y lo que la pantalla
 * hace con ello. Corre en los tres perfiles de la auditoría (Windows 1366×768 al 125 %, iMin y
 * teléfono). El efecto de los demás ajustes del aparato —modo espera, sonidos, anuncio de
 * comandas— ya lo prueban `modo-espera.spec.ts`, `sonidos.spec.ts` y `tactil-barra.spec.ts`.
 */

// La frase de ejemplo de la comanda, literal: la fija apps/web/src/voz/comanda-de-ejemplo.test.ts.
const FRASE_DE_EJEMPLO =
  'Nuevo pedido mesa 4: tres Consomés de carnero; dos Mixiotes, Sin picante; medio kilo de Barbacoa de horno.';

const SLUG = 'prueba-restaurante';

/** Una voz de mentira: lo que dice cada `speak()` queda en `window.__voz`. */
function vozDeMentira(): void {
  const dichas: { text: string; rate: number; voz: string | null }[] = [];
  const voces = [
    { name: 'Paulina', lang: 'es-MX', localService: true, default: false, voiceURI: 'Paulina' },
    { name: 'Mónica', lang: 'es-ES', localService: true, default: false, voiceURI: 'Mónica' },
  ];
  const ventana = window as unknown as Record<string, unknown>;
  ventana['__voz'] = dichas;
  ventana['SpeechSynthesisUtterance'] = class {
    rate = 1;
    volume = 1;
    pitch = 1;
    lang = '';
    voice: { name: string } | null = null;
    onstart: (() => void) | null = null;
    onend: (() => void) | null = null;
    onerror: (() => void) | null = null;
    constructor(public text: string) {}
  };
  const sintesis = {
    speaking: false,
    pending: false,
    paused: false,
    onvoiceschanged: null,
    getVoices: () => voces,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    cancel: () => undefined,
    speak: (u: {
      text: string;
      rate: number;
      voice: { name: string } | null;
      onend: (() => void) | null;
    }) => {
      dichas.push({ text: u.text, rate: u.rate, voz: u.voice?.name ?? null });
      setTimeout(() => u.onend?.(), 5);
    },
  };
  Object.defineProperty(window, 'speechSynthesis', { value: sintesis, configurable: true });
}

const dichas = (page: Page): Promise<{ text: string; rate: number; voz: string | null }[]> =>
  page.evaluate(
    () =>
      (window as unknown as { __voz: { text: string; rate: number; voz: string | null }[] }).__voz,
  );

const guardado = (page: Page, clave: string): Promise<string | null> =>
  page.evaluate((c) => window.localStorage.getItem(c), clave);

test.describe('Este aparato, con el dedo', () => {
  test.use({ actionTimeout: 30_000, navigationTimeout: 60_000 });

  test.beforeAll(async ({ playwright }, info) => {
    await exigirServidor(info.project.use.baseURL);
    await exigirDemostracion(playwright, info, SLUG);
  });

  async function abrirComoLaDuena(
    browser: Parameters<typeof navegadorDe>[0],
    aparato: Parameters<typeof navegadorDe>[1],
    info: Parameters<Equipo['pagina']>[0],
  ) {
    const equipo = new Equipo(navegadorDe(browser, aparato), SLUG);
    const page = await equipo.pagina(info, 'dueno');
    await prepararContexto(page.context(), aparato);
    return { equipo, page };
  }

  test('mh_theme: el botón de modo oscuro cambia el tema de ESTE aparato, lo guarda y lo conserva al recargar', async ({
    browser,
    aparato,
  }, info) => {
    const { equipo, page } = await abrirComoLaDuena(browser, aparato, info);
    try {
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await page.evaluate(() => {
        window.localStorage.removeItem('mh_theme');
      });
      await page.reload();
      await expect(page.locator('html')).not.toHaveClass(/\bdark\b/);

      /** En el teléfono el botón del tema vive dentro del menú (cajón): se abre si hace falta. */
      const conElMenuAbierto = async (): Promise<void> => {
        const abrir = page.getByRole('button', { name: 'Abrir menú' });
        const tema = page.getByRole('button', { name: /modo (oscuro|claro)/i }).first();
        for (let vez = 0; vez < 3 && !(await tema.isVisible()); vez += 1) {
          if (await abrir.isVisible()) await toque(page, abrir);
          await page.waitForTimeout(700);
        }
      };
      await conElMenuAbierto();
      const aOscuro = page.getByRole('button', { name: /modo oscuro/i }).first();
      await expect(aOscuro).toBeVisible();
      await toque(page, aOscuro);
      await expect(page.locator('html')).toHaveClass(/\bdark\b/);
      expect(await guardado(page, 'mh_theme')).toBe('dark');

      await page.reload();
      await expect(page.locator('html')).toHaveClass(/\bdark\b/);

      await conElMenuAbierto();
      const aClaro = page.getByRole('button', { name: /modo claro/i }).first();
      await expect(aClaro).toBeVisible();
      await toque(page, aClaro);
      await expect(page.locator('html')).not.toHaveClass(/\bdark\b/);
      expect(await guardado(page, 'mh_theme')).toBe('light');
    } finally {
      await page.evaluate(() => {
        window.localStorage.removeItem('mh_theme');
      });
      await equipo.cerrar();
    }
  });

  test('mpos.barra-lateral y la tarjeta «Barra lateral»: Plegada y Abierta se guardan en el aparato y la barra nace así', async ({
    browser,
    aparato,
  }, info) => {
    test.skip(
      (info.project.use.viewport?.width ?? 0) < 1024,
      'la barra fija sólo existe de 1024 px (el teléfono trae el cajón «Menú»)',
    );
    const { equipo, page } = await abrirComoLaDuena(browser, aparato, info);
    try {
      await irASeccion(page, 'este-aparato');
      const region = tarjeta(page, 'Barra lateral');

      await toque(page, region.getByRole('radio', { name: 'Plegada' }));
      await expect(region.getByRole('radio', { name: 'Plegada' })).toHaveAttribute(
        'aria-checked',
        'true',
      );
      expect(await guardado(page, 'mpos.barra-lateral')).toBe('plegada');
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('button', { name: 'Mostrar menú' })).toBeVisible();

      await irASeccion(page, 'este-aparato');
      await toque(page, tarjeta(page, 'Barra lateral').getByRole('radio', { name: 'Abierta' }));
      expect(await guardado(page, 'mpos.barra-lateral')).toBe('abierta');
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('button', { name: 'Ocultar menú' })).toBeVisible();
    } finally {
      await page.evaluate(() => {
        window.localStorage.removeItem('mpos.barra-lateral');
      });
      await equipo.cerrar();
    }
  });

  test('mh_voice_rate, mh_voice_manual y «Probar voz»: la velocidad y la voz que se eligen en este aparato son las que suenan', async ({
    browser,
    aparato,
  }, info) => {
    const { equipo, page } = await abrirComoLaDuena(browser, aparato, info);
    try {
      await page.context().addInitScript(vozDeMentira);
      await irASeccion(page, 'este-aparato');
      // «Voz de los avisos» es una tarjeta heredada: no es una región con nombre.
      const region = page.locator('main');
      const velocidad = region.locator('#velocidad-de-la-voz');
      await expect(velocidad).toBeVisible();
      await velocidad.fill('1.3');
      await expect.poll(() => guardado(page, 'mh_voice_rate')).toBe('1.3');
      await toque(page, region.getByRole('button', { name: /Probar voz/ }));
      await expect.poll(async () => (await dichas(page)).at(-1)?.rate).toBe(1.3);

      await toque(page, region.getByRole('radio', { name: /Paulina/ }).first());
      await expect.poll(() => guardado(page, 'mh_voice_manual')).toBe('Paulina');
      await toque(page, region.getByRole('button', { name: /Probar voz/ }));
      await expect.poll(async () => (await dichas(page)).at(-1)?.voz).toBe('Paulina');

      // Volver a «Automática» borra la voz elegida a mano.
      await toque(page, region.getByRole('radio', { name: /Automática/ }).first());
      await expect.poll(() => guardado(page, 'mh_voice_manual')).toBeNull();

      // Y la velocidad de vuelta a la normal: se borra la clave y la voz suena a 1.
      await velocidad.fill('1');
      await expect.poll(() => guardado(page, 'mh_voice_rate')).toBeNull();
      await toque(page, region.getByRole('button', { name: /Probar voz/ }));
      await expect.poll(async () => (await dichas(page)).at(-1)?.rate).toBe(1);
    } finally {
      await page.evaluate(() => {
        window.localStorage.removeItem('mh_voice_rate');
        window.localStorage.removeItem('mh_voice_manual');
      });
      await equipo.cerrar();
    }
  });

  test('«Así se oye una comanda»: el botón lee la comanda de ejemplo y no guarda nada', async ({
    browser,
    aparato,
  }, info) => {
    const { equipo, page } = await abrirComoLaDuena(browser, aparato, info);
    try {
      await page.context().addInitScript(vozDeMentira);
      await irASeccion(page, 'cocina');
      const antes = await page.evaluate(() => JSON.stringify(window.localStorage));
      await toque(page, page.getByRole('button', { name: 'Así se oye una comanda' }));
      await expect.poll(async () => (await dichas(page)).at(-1)?.text).toBe(FRASE_DE_EJEMPLO);
      expect(await page.evaluate(() => JSON.stringify(window.localStorage))).toBe(antes);
    } finally {
      await equipo.cerrar();
    }
  });

  test('morphiqpos.cocina-anuncia y la tarjeta «Esta pantalla anuncia las comandas»: el interruptor se guarda en el aparato', async ({
    browser,
    aparato,
  }, info) => {
    const { equipo, page } = await abrirComoLaDuena(browser, aparato, info);
    try {
      await irASeccion(page, 'este-aparato');
      await page.evaluate(() => {
        window.localStorage.removeItem('morphiqpos.cocina-anuncia');
      });
      await page.reload();
      const interruptor = tarjeta(page, 'Esta pantalla anuncia las comandas').getByRole('switch');
      await expect(interruptor).toBeVisible();
      // La dueña no anuncia por omisión (DP-D151): encenderlo lo guarda; apagarlo, también.
      await expect(interruptor).toHaveAttribute('aria-checked', 'false');
      await toque(page, interruptor);
      await expect(interruptor).toHaveAttribute('aria-checked', 'true');
      expect(await guardado(page, 'morphiqpos.cocina-anuncia')).toContain('true');
      await toque(page, interruptor);
      await expect(interruptor).toHaveAttribute('aria-checked', 'false');
      expect(await guardado(page, 'morphiqpos.cocina-anuncia')).toContain('false');
    } finally {
      await page.evaluate(() => {
        window.localStorage.removeItem('morphiqpos.cocina-anuncia');
      });
      await equipo.cerrar();
    }
  });

  async function comoEstePuesto(
    browser: Parameters<typeof navegadorDe>[0],
    aparato: Parameters<typeof navegadorDe>[1],
    info: Parameters<Equipo['pagina']>[0],
    rol: RolDePrueba,
  ) {
    const equipo = new Equipo(navegadorDe(browser, aparato), SLUG);
    const page = await equipo.pagina(info, rol);
    await prepararContexto(page.context(), aparato);
    return { equipo, page };
  }

  const modoGuardado = async (page: Page): Promise<unknown> =>
    (JSON.parse((await guardado(page, 'mh_mesero_alert_config')) ?? '{}') as { modo?: unknown })
      .modo;
  const vozDeCocinaGuardada = async (page: Page): Promise<unknown> =>
    (JSON.parse((await guardado(page, 'mh_cocina_voz_config')) ?? '{}') as { voz_activa?: unknown })
      .voz_activa;

  test('mh_mesero_alert_config: el mesero elige cómo se le avisa en su aparato y se queda guardado', async ({
    browser,
    aparato,
  }, info) => {
    const { equipo, page } = await comoEstePuesto(browser, aparato, info, 'mesero');
    try {
      await page.goto('/mesero', { waitUntil: 'domcontentloaded' });
      await toque(page, page.getByRole('button', { name: 'Alertas', exact: true }));
      const dialogo = page.getByRole('dialog', { name: /Alertas del mesero/ });
      await expect(dialogo).toBeVisible();
      await toque(page, dialogo.getByRole('button', { name: 'Silencio' }));
      await expect.poll(() => modoGuardado(page)).toBe('silencio');
      await toque(page, dialogo.getByRole('button', { name: 'Sonido + voz' }));
      await expect.poll(() => modoGuardado(page)).toBe('sonido_voz');
    } finally {
      await page.evaluate(() => {
        window.localStorage.removeItem('mh_mesero_alert_config');
      });
      await equipo.cerrar();
    }
  });

  test('mh_cocina_voz_config: el botón «Voz» de Cocina enciende y apaga la voz de ESE aparato', async ({
    browser,
    aparato,
  }, info) => {
    const { equipo, page } = await comoEstePuesto(browser, aparato, info, 'cocina');
    try {
      await page.goto('/cocina', { waitUntil: 'domcontentloaded' });
      await page.evaluate(() => {
        window.localStorage.removeItem('mh_cocina_voz_config');
      });
      await page.reload();
      await toque(page, page.getByTitle('Voz cocina activa'));
      await expect.poll(() => vozDeCocinaGuardada(page)).toBe(false);
      // El aviso de «Voz cocina desactivada» tapa el botón un momento: se espera a que se vaya.
      await expect(page.locator('[data-sonner-toast]')).toHaveCount(0, { timeout: 20_000 });
      await toque(page, page.getByTitle('Voz cocina desactivada'));
      await expect.poll(() => vozDeCocinaGuardada(page)).toBe(true);
    } finally {
      await page.evaluate(() => {
        window.localStorage.removeItem('mh_cocina_voz_config');
      });
      await equipo.cerrar();
    }
  });
});
