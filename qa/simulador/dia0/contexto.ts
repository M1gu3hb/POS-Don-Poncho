/**
 * LO QUE RECIBE CADA PASO DEL DÍA 0: la página del dueño (PC 1920, ya con su PIN), el entorno y
 * dónde dejar notas, capturas e incidentes. Cada paso es idempotente: mira la pantalla antes de
 * crear y sólo crea lo que falta, así que correr el día 0 dos veces no duplica nada.
 */
import { appendFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Page } from '@playwright/test';

import type { Entorno } from '../entorno.ts';
import { abrirLibro, type Asiento } from '../libro.ts';
import { abrirRegistro, type NuevoIncidente } from '../incidentes.ts';
import { horaSimulada, parametrosValidos } from '../reloj/formula.ts';

export interface Dia0 {
  readonly entorno: Entorno;
  readonly pagina: Page;
  readonly salida: string;
  /** Una línea del diario del día 0 (qué se hizo o qué ya estaba). Nunca lleva PIN. */
  nota(paso: string, texto: string): void;
  /** Captura de la pantalla actual. */
  foto(nombre: string): Promise<void>;
  /** Un asiento del libro del día 0 (compras, mermas, cambios de configuración). */
  anotar(asiento: Asiento): void;
  /** Un incidente del día 0 (el sistema hizo algo mal mientras el dueño preparaba el negocio). */
  incidente(
    i: Omit<NuevoIncidente, 'dia' | 'horaSim' | 'bot' | 'rol' | 'aparato' | 'reproducido'>,
  ): Promise<void>;
}

export const SALIDA_DIA0 = 'D:/mpos-tmp/dp18/agente-b/dia0';

function horaSimDe(entorno: Entorno): string {
  const p = parametrosValidos(JSON.parse(readFileSync(entorno.archivoReloj, 'utf8')));
  return new Date(p === null ? Date.now() : horaSimulada(p, Date.now())).toISOString();
}

export function crearDia0(entorno: Entorno, pagina: Page, salida = SALIDA_DIA0): Dia0 {
  mkdirSync(salida, { recursive: true });
  const registro = abrirRegistro(entorno.salida);
  const libro = abrirLibro(
    join(entorno.salida, 'dia-0', 'libro.jsonl'),
    0,
    () => new Date(horaSimDe(entorno)),
  );
  return {
    entorno,
    pagina,
    salida,
    nota(paso, texto) {
      const linea = `${new Date().toISOString()} [${paso}] ${texto}`;
      appendFileSync(join(salida, 'diario.txt'), `${linea}\n`);
      process.stdout.write(`${linea}\n`);
    },
    async foto(nombre) {
      await pagina.screenshot({ path: join(salida, `${nombre}.png`) }).catch((error: unknown) => {
        process.stdout.write(`(sin captura ${nombre}: ${String(error)})\n`);
      });
    },
    anotar(asiento) {
      libro.anotar('dueno-dia0', asiento);
    },
    async incidente(i) {
      const hecho = await registro.registrar(
        {
          ...i,
          dia: 0,
          horaSim: horaSimDe(entorno),
          bot: 'dueno-dia0',
          rol: 'dueno',
          aparato: 'pc-1920',
          reproducido: 'no intentado',
        },
        pagina,
      );
      process.stdout.write(
        `INCIDENTE ${hecho.id} (${hecho.gravedad}/${hecho.clase}): ${hecho.hizo}\n`,
      );
    },
  };
}

export type PasoDelDia0 = (d: Dia0) => Promise<void>;

/** Va a una pestaña de Configuración (`/configuracion`) y espera a que cargue. */
export async function irAConfiguracion(d: Dia0, pestana: string): Promise<void> {
  await d.pagina.goto(`${d.entorno.appUrl}/configuracion`, { waitUntil: 'domcontentloaded' });
  await d.pagina.getByRole('tab', { name: pestana, exact: true }).click();
}

/** Va a una ruta de la app. */
export async function ir(d: Dia0, ruta: string): Promise<void> {
  await d.pagina.goto(`${d.entorno.appUrl}${ruta}`, { waitUntil: 'domcontentloaded' });
}
