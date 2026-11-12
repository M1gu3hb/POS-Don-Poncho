/**
 * LO QUE TODO BOT RECIBE Y LO QUE TODO BOT ES.
 *
 * Un bot es un bucle con su propia suerte: mira su pantalla, decide, actúa como lo haría la
 * persona y espera en minutos SIMULADOS. Anota en el libro lo que sabe que hizo y registra un
 * incidente cuando algo no pasa como debía. Termina cuando el día termina (`terminado()`).
 */
import type { Browser, BrowserContext, Page } from '@playwright/test';

import type { NombreDeAparato } from './aparatos.ts';
import type { Entorno } from './entorno.ts';
import type { Registro, NuevoIncidente } from './incidentes.ts';
import type { Libro } from './libro.ts';
import type { Mundo } from './mundo.ts';
import type { Azar } from './semilla.ts';
import type { Tiempos } from './tiempos.ts';

export interface ContextoDelBot {
  readonly entorno: Entorno;
  readonly azar: Azar;
  readonly libro: Libro;
  readonly registro: Registro;
  readonly tiempos: Tiempos;
  readonly mundo: Mundo;
  readonly navegador: Browser;
  /** La hora simulada (la misma del servidor, la base y el navegador). */
  ahoraSim(): Date;
  /** Espera minutos SIMULADOS (a ×6, un minuto simulado son 10 s reales). */
  esperarSim(minutos: number): Promise<void>;
  /** El día terminó (19:00 simuladas o la orden de parar): el bot sale de su bucle. */
  terminado(): boolean;
  /** Un contexto nuevo con el aparato, el reloj de QA inyectado y la vigilancia de consola y red. */
  nuevoContexto(aparato: NombreDeAparato): Promise<{ contexto: BrowserContext; pagina: Page }>;
  /** Registrar un incidente de ESTE bot (llena día, hora, bot, rol y aparato). */
  incidente(
    i: Omit<NuevoIncidente, 'dia' | 'horaSim' | 'bot' | 'rol' | 'aparato'>,
    pagina?: Page,
  ): Promise<void>;
}

export interface Bot {
  readonly nombre: string;
  readonly rol:
    | 'mesero'
    | 'comensal'
    | 'estacion'
    | 'telefono_cocina'
    | 'caja'
    | 'gerente'
    | 'almacen'
    | 'dueno'
    | 'caos';
  readonly aparato: NombreDeAparato;
  correr(ctx: ContextoDelBot): Promise<void>;
}
