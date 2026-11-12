/**
 * LO QUE COMPARTEN TODOS LOS BOTS DE LA SALA: tocar con paciencia, medir cada acción, convertir un
 * fallo de pantalla en incidente (sin tumbar al bot) y vigilar los 5xx del servidor.
 *
 * Un incidente sólo cuando el SISTEMA hace algo mal. Un `Timeout` esperando un botón que debía estar
 * es, hasta que se pruebe lo contrario, «la pantalla no mostró lo que debía» (clase `ui`); si el que
 * se equivocó fue el guion se arregla el guion o se baja a clase `prueba`.
 */
import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

import type { Page } from '@playwright/test';

import type { ContextoDelBot } from '../bot.ts';
import type { Clase, Gravedad } from '../incidentes.ts';

/** Cuánto se espera una pantalla antes de darla por perdida (la máquina de QA es lenta). */
export const ESPERA_MS = 45_000;

export const escapar = (texto: string): string => texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Pesos en la forma de las pantallas: `$1,234.50`. */
export const enPantalla = (centavos: number): string =>
  `$${(centavos / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const pesos = (centavos: number): string => (centavos / 100).toFixed(2);

/** Los kilos como los dice la pantalla: ¼, ½, 1, o el número a secas. */
export function kilosDichos(kg: number): string {
  if (kg === 0.25) return '¼ kg';
  if (kg === 0.5) return '½ kg';
  return `${String(kg)} kg`;
}

/** Una línea en `<salida>/trazas.log`: qué hacía cada bot y a qué hora simulada (para ver dónde se atora uno). */
export function traza(ctx: ContextoDelBot, quien: string, texto: string): void {
  mkdirSync(ctx.entorno.salida, { recursive: true });
  appendFileSync(
    join(ctx.entorno.salida, 'trazas.log'),
    `${ctx.ahoraSim().toISOString().slice(11, 19)} ${quien} ${texto}
`,
  );
}

export interface Accion {
  readonly bot?: string;
  readonly pantalla: string;
  readonly hizo: string;
  readonly esperaba: string;
  readonly paso: string;
  readonly gravedad?: Gravedad;
  readonly clase?: Clase;
}

function mensajeCorto(error: unknown): string {
  const texto = error instanceof Error ? error.message : String(error);
  return texto.split('\n').slice(0, 3).join(' ').slice(0, 300);
}

/**
 * Corre una acción de pantalla, la mide y, si falla, registra el incidente con su captura y devuelve
 * `false` (el bot decide cómo recuperarse). Devuelve `true` si salió bien.
 */
export async function intentar(
  ctx: ContextoDelBot,
  pagina: Page,
  a: Accion,
  fn: () => Promise<void>,
): Promise<boolean> {
  const quien = a.bot ?? a.pantalla;
  traza(ctx, quien, `> ${a.paso}`);
  try {
    await ctx.tiempos.medir(a.paso, fn, async (ms) => {
      await ctx.incidente(
        {
          pantalla: a.pantalla,
          hizo: a.hizo,
          esperaba: 'Responder en menos de 3 s.',
          paso: `${a.paso} (lento)`,
          reproducido: 'no intentado',
          gravedad: 'bajo',
          clase: 'rendimiento',
          evidencia: { consola: [`tardó ${String(ms)} ms`] },
        },
        pagina,
      );
    });
    traza(ctx, quien, `< ${a.paso}`);
    return true;
  } catch (error: unknown) {
    traza(ctx, quien, `! ${a.paso}: ${mensajeCorto(error)}`);
    if (ctx.terminado() && pagina.isClosed()) return false;
    await ctx.incidente(
      {
        pantalla: a.pantalla,
        hizo: a.hizo,
        esperaba: a.esperaba,
        // «Qué pasó»: el paso y el error, no sólo el nombre del paso.
        paso: `${a.paso}: ${mensajeCorto(error)}`,
        reproducido: 'no intentado',
        gravedad: a.gravedad ?? 'medio',
        clase: a.clase ?? 'ui',
        evidencia: { consola: [mensajeCorto(error)] },
      },
      pagina,
    );
    return false;
  }
}

/** Cierra lo que haya abierto y vuelve a la pantalla de inicio de la persona (la salida de un mal paso). */
export async function recuperar(pagina: Page, appUrl: string, ruta: string): Promise<void> {
  if (pagina.isClosed()) return;
  await pagina
    .goto(`${appUrl}${ruta}`, { waitUntil: 'domcontentloaded', timeout: ESPERA_MS })
    .catch(() => undefined);
}

/**
 * Anota un incidente de servidor por cada respuesta 5xx de esta página (una por ruta cada 2 minutos
 * simulados, para no inundar el registro con el mismo fallo).
 */
export function vigilarServidor(ctx: ContextoDelBot, pagina: Page, pantalla: () => string): void {
  const vistos = new Map<string, number>();
  pagina.on('response', (r) => {
    if (r.status() < 500) return;
    const ruta = new URL(r.url()).pathname;
    const ahora = ctx.ahoraSim().getTime();
    if (ahora - (vistos.get(ruta) ?? -Infinity) < 120_000) return;
    vistos.set(ruta, ahora);
    void ctx.incidente(
      {
        pantalla: pantalla(),
        hizo: `${r.request().method()} ${ruta}`,
        esperaba: 'Una respuesta 2xx o un rechazo de negocio (4xx), nunca un 5xx.',
        paso: `5xx en ${ruta}`,
        reproducido: 'no intentado',
        gravedad: 'alto',
        clase: 'servidor',
        evidencia: {
          correlationId: r.headers()['x-correlation-id'] ?? '',
          red: [`${String(r.status())} ${ruta}`],
        },
      },
      pagina,
    );
  });
}

/** Espera (en tiempo real, con tope) a que `condicion` se cumpla, mirándola cada `cadaMs`. */
export async function esperarHasta(
  condicion: () => Promise<boolean>,
  topeMs: number,
  cadaMs = 1_000,
): Promise<boolean> {
  const limite = Date.now() + topeMs;
  while (Date.now() < limite) {
    if (await condicion().catch(() => false)) return true;
    await new Promise((r) => setTimeout(r, cadaMs));
  }
  return false;
}
