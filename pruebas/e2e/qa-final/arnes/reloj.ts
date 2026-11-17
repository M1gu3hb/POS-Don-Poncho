import type { Page } from '@playwright/test';

/**
 * EL TIEMPO (DP-22): el reloj falso del NAVEGADOR (`page.clock`) para lo que depende de la hora que
 * ve la página: las alertas de cocina que se ponen rojas con los minutos, el candado por inactividad
 * (10 minutos sin tocar la pantalla), el aviso de que la sesión va a vencer y el cambio de día.
 *
 * ── Lo que `page.clock` NO mueve ────────────────────────────────────────────────────────────────
 *  · La hora del SERVIDOR (`Date.now()` del proceso de `next start`), la de la BASE (`now()` y los
 *    `default now()`) ni el vencimiento de las cookies, que el navegador cuenta con su reloj real.
 *    Una sesión que el servidor da por vencida a las 8 h no vence porque la página crea que pasaron 8 h.
 *  · Los temporizadores del navegador que no son de la página (la red, el caché, los Service Worker).
 *
 * ── Cómo se combina con `qa/simulador/reloj/` ───────────────────────────────────────────────────
 * Para que el servidor, la base y la página cuenten la MISMA hora (el cambio de día de verdad, el
 * vencimiento de una sesión, el corte que cierra a medianoche):
 *   1. `qa/simulador/reloj/en-la-base.ts <url qa_…>` (una vez por base) y `reloj/fijar.ts --sim <hora>`
 *      mueven la base y el archivo que lee `servir.ts` (el `next start` con `reloj/precarga.ts`).
 *      Sólo sirve en una COPIA local `qa_…`: pasa por el candado, no se usa en la base desechable
 *      de este arnés ni en producción.
 *   2. En la página, o `guionDelNavegador(parametros)` (`reloj/formula.ts`, para correr a otro factor
 *      de velocidad) o, aquí, `alInstanteDelServidor(page, hora)`: el mismo instante, sin factor.
 *   NO se usan los dos a la vez en la misma página: los dos reemplazan `Date`.
 */

export type Instante = Date | number | string;

/** Instala el reloj falso. Tiene que ser ANTES de abrir la pantalla: el reloj no llega a lo ya cargado. */
export async function instalarRelojFalso(page: Page, ahora?: Instante): Promise<void> {
  await page.clock.install(ahora === undefined ? {} : { time: ahora });
}

/** La página cree que es `hora`, la misma que el servidor simulado (`reloj/fijar.ts`). */
export async function alInstanteDelServidor(page: Page, hora: Instante): Promise<void> {
  await page.clock.install({ time: hora });
}

/** Salta `ms` y dispara una sola vez lo que venció (un `setInterval` corre una vez): el salto largo. */
export async function adelantar(page: Page, ms: number): Promise<void> {
  await page.clock.fastForward(ms);
}

/** Deja correr `ms` disparando TODOS los temporizadores en orden, como si de verdad hubieran pasado. */
export async function dejarPasar(page: Page, ms: number): Promise<void> {
  await page.clock.runFor(ms);
}

export const MINUTO_MS = 60_000;

/** La persona no toca la pantalla `minutos`: el candado por inactividad cuenta. */
export async function pasarInactividad(page: Page, minutos: number): Promise<void> {
  await dejarPasar(page, minutos * MINUTO_MS);
}

/** El cambio de día: la página ve que son las 00:00:30 de la fecha dada y deja correr un segundo. */
export async function cambiarDeDia(page: Page, fecha: string): Promise<void> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) throw new Error(`Fecha «${fecha}»: usa AAAA-MM-DD.`);
  await page.clock.setSystemTime(new Date(`${fecha}T00:00:30-06:00`));
  await dejarPasar(page, 1_000);
}

/** Quita el reloj falso: el tiempo vuelve a correr solo. */
export async function reanudarElTiempo(page: Page): Promise<void> {
  await page.clock.resume();
}
