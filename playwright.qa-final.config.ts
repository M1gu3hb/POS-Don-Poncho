import { defineConfig, type PlaywrightTestConfig } from '@playwright/test';

import { APARATOS, motorDe, opcionesDeContexto } from './pruebas/e2e/qa-final/arnes/aparatos.ts';

/**
 * EL QA FINAL (DP-22): `pnpm exec playwright test -c playwright.qa-final.config.ts --project=<aparato>`.
 *
 * Aparte de `playwright.config.ts` a propósito (y `**\/qa-final/**` está en su `testIgnore`): la CI
 * de hoy no recoge estas specs, que necesitan motores que sólo existen en la laptop de QA.
 *
 * UN PROYECTO POR APARATO (`pruebas/e2e/qa-final/arnes/aparatos.ts`), todos con tacto de verdad.
 * Sin `webServer`, y es a propósito: si Playwright no encuentra el servidor, arranca su propio
 * build y borra el `.next` de quien lo está sirviendo. El servidor se levanta aparte
 * (`pnpm --filter @morphiqpos/web exec next start -p <puerto>`) y las specs que lo necesitan
 * comprueban que contesta antes de empezar (`exigirServidor`).
 *
 * Variables: `MORPHIQPOS_PUERTO_E2E` (3200), `MORPHIQPOS_URL_DESPLIEGUE` (sólo para apuntar a otro
 * origen), `MORPHIQPOS_CHROMIUM_ELECTRON` (el `chrome.exe` del Chrome 156), `MORPHIQPOS_CHROMIUM_VIEJO`
 * (la carpeta con `99/` y `103/`), `MORPHIQPOS_QA_CORRIDA` (el nombre de la corrida en los informes) y
 * `MORPHIQPOS_QA_WORKERS` (1 por omisión).
 */
const PUERTO = process.env['MORPHIQPOS_PUERTO_E2E'] ?? '3200';
const BASE = process.env['MORPHIQPOS_URL_DESPLIEGUE'] ?? `http://localhost:${PUERTO}`;
const WORKERS = Number(process.env['MORPHIQPOS_QA_WORKERS'] ?? '1');
const CORRIDA =
  process.env['MORPHIQPOS_QA_CORRIDA'] ?? new Date().toISOString().replaceAll(/[:.]/g, '-');
process.env['MORPHIQPOS_QA_CORRIDA'] = CORRIDA;

type Proyecto = NonNullable<PlaywrightTestConfig['projects']>[number];

const AVISOS_DADOS = 'MORPHIQPOS_QA_AVISOS_DADOS';

function proyectos(): Proyecto[] {
  const avisos: string[] = [];
  const lista = APARATOS.map((aparato): Proyecto => {
    const motor = motorDe(aparato);
    if (motor.aviso !== null) avisos.push(`  ${aparato.id}: ${motor.aviso}`);
    return {
      name: aparato.id,
      metadata: { aparatoId: aparato.id },
      use: {
        ...opcionesDeContexto(aparato, motor),
        ...(motor.ejecutable === undefined
          ? {}
          : { launchOptions: { executablePath: motor.ejecutable } }),
      },
    };
  });
  // Los workers vuelven a cargar este archivo: el aviso sale una sola vez, en el proceso principal.
  if (avisos.length > 0 && process.env[AVISOS_DADOS] === undefined) {
    process.env[AVISOS_DADOS] = '1';
    process.stderr.write(
      `[qa-final] motores no disponibles o sustituidos:\n${avisos.join('\n')}\n`,
    );
  }
  return lista;
}

export default defineConfig({
  testDir: './pruebas/e2e/qa-final',
  outputDir: './qa/qa-final/resultados',
  workers: WORKERS,
  fullyParallel: false,
  // Sin reintentos: un reintento esconde una prueba inestable (y aquí la inestabilidad es el hallazgo).
  retries: 0,
  forbidOnly: process.env['CI'] !== undefined,
  timeout: 180_000,
  expect: { timeout: 10_000 },
  reporter: [
    ['list'],
    ['json', { outputFile: `./qa/qa-final/informes/playwright-${CORRIDA}.json` }],
  ],
  use: {
    baseURL: BASE,
    trace: 'retain-on-failure',
    screenshot: 'off',
    locale: 'es-MX',
    timezoneId: 'America/Mexico_City',
  },
  projects: proyectos(),
});
