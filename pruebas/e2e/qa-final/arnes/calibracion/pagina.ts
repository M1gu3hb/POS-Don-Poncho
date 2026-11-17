import type { Page } from '@playwright/test';

/**
 * LAS PÁGINAS DE CALIBRACIÓN: HTML estático con UN defecto sembrado cada una (y su variante limpia).
 * Se sirven con `page.route` sobre un origen que no existe (`calibracion.arnes.test`): no necesitan la
 * app ni su servidor, y el origen es un `http://` de verdad (a diferencia de `setContent`), así que
 * `fetch`, la consola y las respuestas se comportan como en la app.
 */

export const ORIGEN_DE_CALIBRACION = 'http://calibracion.arnes.test';

export type Variante = 'sucia' | 'limpia';

export const urlDe = (id: string, variante: Variante): string =>
  `${ORIGEN_DE_CALIBRACION}/caso/${id}/${variante}`;

export interface PartesDeLaPagina {
  readonly cuerpo: string;
  readonly estilo?: string;
  readonly guion?: string;
}

/** La cáscara limpia: idioma, título, ventana de diseño y un `main` (axe no tiene nada que decir de ella). */
export function pagina({ cuerpo, estilo = '', guion = '' }: PartesDeLaPagina): string {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Calibración del arnés</title>
<style>
  *, *::before, *::after { box-sizing: border-box; }
  body { margin: 0; padding: 16px; font: 16px/1.4 system-ui, sans-serif; color: #111; background: #fff; }
  button, input, select { font: inherit; }
  button { min-height: 48px; min-width: 96px; padding: 0 16px; }
  input { min-height: 48px; width: 100%; padding: 0 8px; }
  label { display: block; margin-bottom: 4px; }
  ${estilo}
</style>
</head>
<body>
<main>
<h1>Calibración</h1>
${cuerpo}
</main>
${guion === '' ? '' : `<script>${guion}</script>`}
</body>
</html>`;
}

/** Sirve las páginas de los casos y las dos respuestas de la calibración (una 500 y una 200). */
export async function servirCalibracion(
  page: Page,
  paginas: ReadonlyMap<string, string>,
): Promise<void> {
  await page.route(`${ORIGEN_DE_CALIBRACION}/**`, async (ruta) => {
    const { pathname } = new URL(ruta.request().url());
    if (pathname === '/api/calibracion/falla') {
      await ruta.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"x"}' });
      return;
    }
    if (pathname === '/api/calibracion/ok') {
      await ruta.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
      return;
    }
    if (pathname === '/favicon.ico') {
      await ruta.fulfill({ status: 204, body: '' });
      return;
    }
    const html = paginas.get(pathname);
    if (html === undefined) {
      await ruta.fulfill({ status: 404, contentType: 'text/plain', body: 'sin caso' });
      return;
    }
    await ruta.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html });
  });
}
