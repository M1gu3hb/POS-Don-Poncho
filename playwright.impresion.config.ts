import { defineConfig, devices } from '@playwright/test';

/**
 * LA PRUEBA DEL TICKET IMPRESO (DP-20 · refuerzo §1.5): `pnpm test:impresion`.
 *
 * Aparte de `playwright.config.ts` a propósito: estas pruebas NO necesitan la aplicación
 * levantada ni la base. Cargan el componente del ticket en una página en blanco, lo imprimen
 * como en producción y leen los bytes ESC/POS con la impresora falsa. Sin `webServer`: no
 * construyen ni pisan el build de nadie.
 */

/** Un Chromium ya instalado, cuando la máquina no puede descargar el de Playwright. */
const CHROMIUM = process.env['MORPHIQPOS_CHROMIUM'];

export default defineConfig({
  testDir: './pruebas/impresion',
  globalSetup: './pruebas/impresion/preparar.ts',
  outputDir: './pruebas/impresion/.resultados',
  retries: 0,
  fullyParallel: true,
  reporter: [['list']],
  timeout: 60_000,
  use: {
    ...devices['Desktop Chrome'],
    // 1 px = 1 punto de la impresora: sin esto la captura mediría el doble en una pantalla densa.
    deviceScaleFactor: 1,
    ...(CHROMIUM === undefined || CHROMIUM === ''
      ? {}
      : { launchOptions: { executablePath: CHROMIUM } }),
  },
});
