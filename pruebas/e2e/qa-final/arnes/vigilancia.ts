import type { Page } from '@playwright/test';

import type { Explicacion } from './explicados.ts';
import type { Hallazgo, Informativo } from './tipos.ts';

/**
 * LA CONSOLA Y LA RED DE CADA PANTALLA: 0 errores de consola sin explicar y 0 respuestas 4xx/5xx
 * inesperadas. Se vigila desde que se pide (`vigilarPagina`; lo mejor es pedirlo nada más crear la
 * página: `revisarPantalla` lo pide si no se había pedido, y entonces sólo ve lo que pasó después) y
 * cada revisión toma y vacía lo acumulado.
 *
 * El «Failed to load resource: … status of 500» que el navegador escribe en la consola NO cuenta
 * aparte: es la misma respuesta, y ya sale como `respuesta`.
 */

interface Mensaje {
  readonly texto: string;
  readonly donde: string;
}
interface Respuesta {
  readonly metodo: string;
  readonly estado: number;
  readonly url: string;
}
interface Vigilante {
  consola: Mensaje[];
  respuestas: Respuesta[];
}

const vigilantes = new WeakMap<Page, Vigilante>();
const RUIDO_DE_RESPUESTA =
  /^Failed to load resource: the server responded with a status of [45]\d\d/;

export function vigilarPagina(page: Page): void {
  if (vigilantes.has(page)) return;
  const v: Vigilante = { consola: [], respuestas: [] };
  vigilantes.set(page, v);
  page.on('console', (m) => {
    if (m.type() !== 'error' || RUIDO_DE_RESPUESTA.test(m.text())) return;
    const u = m.location().url;
    v.consola.push({
      texto: m.text(),
      donde: u === '' ? '' : `${u}:${String(m.location().lineNumber)}`,
    });
  });
  page.on('pageerror', (error) => {
    v.consola.push({ texto: `Excepción sin atrapar: ${error.message}`, donde: '' });
  });
  page.on('response', (r) => {
    if (r.status() < 400) return;
    const respuesta: Respuesta = { metodo: r.request().method(), estado: r.status(), url: r.url() };
    // DP-25 · «A esta mesa le faltan platillos» es un 422 que la pantalla espera y enseña, no un
    // botón roto. Se mira el cuerpo: cualquier OTRO 422 de esta ruta sigue contando.
    if (
      respuesta.estado === 422 &&
      new URL(respuesta.url).pathname === '/api/restaurante/solicitar-cuenta'
    ) {
      void r
        .json()
        .then((cuerpo: unknown) => {
          const sobre = cuerpo as { error?: { datos?: { regla?: unknown } } } | null;
          if (sobre?.error?.datos?.regla !== 'CUENTA_CON_PENDIENTES') v.respuestas.push(respuesta);
        })
        .catch(() => {
          v.respuestas.push(respuesta);
        });
      return;
    }
    v.respuestas.push(respuesta);
  });
}

export interface Explicadas {
  readonly consola: readonly Explicacion[];
  readonly respuestas: readonly Explicacion[];
}

/** Toma lo visto desde la última vez, lo separa en hallazgos y explicados, y vacía. */
export function tomarLoVisto(
  page: Page,
  explicadas: Explicadas,
): { hallazgos: Hallazgo[]; informativos: Informativo[] } {
  const v = vigilantes.get(page);
  const hallazgos: Hallazgo[] = [];
  const informativos: Informativo[] = [];
  if (v === undefined) return { hallazgos, informativos };
  for (const m of v.consola.splice(0)) {
    const explicado = explicadas.consola.find((e) => e.patron.test(`error ${m.texto}`));
    if (explicado !== undefined) {
      informativos.push({
        tipo: 'explicado',
        selector: 'consola',
        texto: m.texto.slice(0, 120),
        detalle: explicado.razon,
      });
    } else {
      hallazgos.push({
        tipo: 'consola',
        selector: m.donde === '' ? 'consola' : m.donde,
        texto: m.texto.slice(0, 200),
        medidas: {},
        detalle: 'error de consola sin explicación',
      });
    }
  }
  for (const r of v.respuestas.splice(0)) {
    const clave = `${r.metodo} ${String(r.estado)} ${r.url}`;
    const explicado = explicadas.respuestas.find((e) => e.patron.test(clave));
    if (explicado !== undefined) {
      informativos.push({
        tipo: 'explicado',
        selector: `${r.metodo} ${r.url}`,
        texto: String(r.estado),
        detalle: explicado.razon,
      });
    } else {
      hallazgos.push({
        tipo: 'respuesta',
        selector: `${r.metodo} ${r.url}`,
        texto: String(r.estado),
        medidas: { estado: r.estado },
        detalle: 'respuesta 4xx/5xx inesperada',
      });
    }
  }
  return { hallazgos, informativos };
}
