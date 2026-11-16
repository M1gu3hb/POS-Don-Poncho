import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Browser, Locator, Page } from '@playwright/test';

import { AGOTADO, conPlazo } from './con-plazo.ts';
import type { Recuadro } from './dos-motores.ts';
import { medidasDeLoVisible, type Medida } from './medidas-de-dos-motores.ts';
import { PARADAS, recorrer, type AlFallar, type AlLlegar } from './recorrido-compatible.ts';

/**
 * DP-20.1 · EL RECORRIDO, EN UN MOTOR. Abre un contexto de 1920 × 1080 (la pantalla del iMin), anda
 * las paradas y en cada una guarda lo que hace falta para comparar después con el otro motor: la
 * captura, las zonas que cambian de corrida a corrida y la caja y los colores de cada elemento.
 */

export type Motor = 'moderno' | 'viejo';

export interface LoDeLaParada {
  readonly captura: Buffer;
  /** Las zonas de `tapar`, en pixeles de la pantalla. */
  readonly tapadas: readonly Recuadro[];
  readonly medidas: readonly Medida[];
  readonly nota: string | null;
}

export interface Resultado {
  /** Los errores de consola y de página, por parada (los de antes de llegar cuentan en ella). */
  readonly errores: Map<string, string[]>;
  readonly alcanzadas: string[];
  readonly pendientes: string[];
  readonly paradas: Map<string, LoDeLaParada>;
}

/** El nombre de archivo de una parada: `05-mesero-orden.png`. */
export function archivoDe(parada: string): string {
  const numero = PARADAS.findIndex((p) => p === parada) + 1;
  return `${String(numero).padStart(2, '0')}-${parada}.png`;
}

/** Guarda un PNG en `<capturas>/<carpeta>/`, si se pidieron capturas. */
export function guardar(capturas: string, carpeta: string, archivo: string, png: Buffer): void {
  if (capturas === '') return;
  mkdirSync(join(capturas, carpeta), { recursive: true });
  writeFileSync(join(capturas, carpeta, archivo), png);
}

/** Anota los errores de la pestaña en la parada a la que se va. */
function vigilar(page: Page, pendientesDeParada: string[]): void {
  page.on('console', (mensaje) => {
    if (mensaje.type() === 'error') {
      pendientesDeParada.push(`consola: ${mensaje.text()} (${mensaje.location().url})`);
    }
  });
  page.on('pageerror', (error) => {
    pendientesDeParada.push(`página: ${error.message}`);
  });
}

/** Las cajas, en pantalla, de lo que hay que tapar al comparar. */
async function zonasDe(tapar: readonly Locator[]): Promise<Recuadro[]> {
  const zonas: Recuadro[] = [];
  for (const localizador of tapar) {
    for (const uno of await localizador.all()) {
      const caja = await uno.boundingBox();
      if (caja !== null) zonas.push({ x: caja.x, y: caja.y, ancho: caja.width, alto: caja.height });
    }
  }
  return zonas;
}

/** Una captura, con plazo: una pestaña congelada no deja pintar y no hay que esperarla de por vida. */
async function capturar(page: Page): Promise<Buffer> {
  const captura = await conPlazo(
    page.screenshot({ animations: 'disabled', timeout: 8_000 }),
    10_000,
  );
  if (captura === AGOTADO) throw new Error('La pestaña no contestó: no se pudo capturar.');
  return captura;
}

export async function correrRecorrido(
  motor: Motor,
  navegador: Browser,
  base: string,
  capturas: string,
): Promise<Resultado> {
  const contexto = await navegador.newContext({
    baseURL: base,
    viewport: { width: 1920, height: 1080 },
    locale: 'es-MX',
    timezoneId: 'America/Mexico_City',
    reducedMotion: 'reduce',
  });
  if (motor === 'viejo') {
    // La caché HTTP del Chromium 99.0.4844.0 de desarrollo congela la pestaña al navegar a `/`
    // tras el PIN (ni `evaluate` ni las capturas contestan); con la hoja de antes pasa igual y en
    // el 103 no pasa. Playwright apaga la caché HTTP mientras hay una ruta: se instala una que no
    // cambia nada.
    await contexto.route('**/*', (ruta) => ruta.continue());
  }
  contexto.setDefaultTimeout(20_000);
  contexto.setDefaultNavigationTimeout(30_000);
  const resultado: Resultado = {
    errores: new Map(),
    alcanzadas: [],
    pendientes: [],
    paradas: new Map(),
  };
  const sinAsignar: string[] = [];
  // Cualquier pestaña del contexto cuenta: si la primera se congela, el recorrido sigue en otra.
  contexto.on('page', (nueva) => {
    vigilar(nueva, sinAsignar);
  });
  try {
    const page = await contexto.newPage();
    const alLlegar: AlLlegar = async ({ nombre, pagina, tapar, nota }) => {
      resultado.errores.set(nombre, sinAsignar.splice(0));
      resultado.alcanzadas.push(nombre);
      const tapadas = await zonasDe(tapar);
      const captura = await capturar(pagina);
      resultado.paradas.set(nombre, {
        captura,
        tapadas,
        medidas: await medidasDeLoVisible(pagina, tapadas),
        nota: nota ?? null,
      });
      guardar(capturas, motor, archivoDe(nombre), captura);
    };
    const alFallar: AlFallar = async (tramo, error) => {
      resultado.pendientes.push(
        `${tramo}: ${error instanceof Error ? error.message : String(error)}`,
      );
      const ultima = contexto.pages().at(-1);
      if (ultima === undefined) return;
      try {
        const captura = await capturar(ultima);
        guardar(capturas, motor, `fallo-${tramo.replaceAll(/[^\w]+/g, '-')}.png`, captura);
      } catch (sinCaptura: unknown) {
        // El tramo ya quedó anotado; que además no se pueda fotografiar se dice, no se esconde.
        resultado.pendientes.push(
          `${tramo}: sin captura (${sinCaptura instanceof Error ? sinCaptura.message : String(sinCaptura)})`,
        );
      }
    };
    await recorrer(page, alLlegar, alFallar);
    resultado.errores.set('(después de la última parada)', sinAsignar.splice(0));
  } finally {
    await contexto.close();
  }
  return resultado;
}
