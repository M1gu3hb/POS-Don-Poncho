/**
 * LO QUE RECIBE CADA BOT (`ContextoDelBot`): el reloj simulado, la espera en minutos simulados, un
 * contexto de navegador con su aparato y el reloj inyectado, y cómo registrar un incidente a su
 * nombre. Lo usan `correr-mini.ts` y, si sirve, el lanzador del día.
 */
import { readFileSync } from 'node:fs';

import type { Browser, BrowserContext, Page } from '@playwright/test';

import { prepararContexto } from '../../pruebas/e2e/qa-final/arnes/ligero.ts';

import { esDelArnes, opcionesDe, perfilDelArnes, type NombreDeAparato } from './aparatos.ts';
import type { Bot, ContextoDelBot } from './bot.ts';
import { ponerElDedo } from './dedo.ts';
import type { Entorno } from './entorno.ts';
import { vigilar, type Registro } from './incidentes.ts';
import type { Libro } from './libro.ts';
import type { Navegadores } from './navegadores.ts';
import {
  guionDelNavegador,
  horaSimulada,
  parametrosValidos,
  type ParametrosDelReloj,
} from './reloj/formula.ts';
import type { Mundo } from './mundo.ts';
import type { Azar } from './semilla.ts';
import type { Tiempos } from './tiempos.ts';

export interface BaseDelDia {
  readonly entorno: Entorno;
  readonly azar: Azar;
  readonly libro: Libro;
  readonly registro: Registro;
  readonly tiempos: Tiempos;
  readonly mundo: Mundo;
  readonly navegador: Browser;
  /** El día se acaba cuando esto devuelve `true` (19:00 simuladas o la orden de parar). */
  readonly terminado: () => boolean;
  /** DP-22: un navegador por motor (Chrome 156, Chromium 99…). Sin esto, todos van en `navegador`. */
  readonly navegadores?: Navegadores;
  /** DP-22: el aparato que de verdad se usa cuando un bot pide uno de la semana (todo táctil). */
  readonly sustitutos?: Readonly<Partial<Record<NombreDeAparato, NombreDeAparato>>>;
  /** DP-22: todo «clic» de las pantallas es un TOQUE (`tap`), con el dedo y sin ratón. */
  readonly conDedo?: boolean;
}

/** Lee los parámetros del reloj (el mismo archivo que lee el servidor), con un respiro de medio segundo. */
export function lectorDelReloj(archivo: string): () => ParametrosDelReloj {
  let ultimo: { leidoEn: number; p: ParametrosDelReloj } | null = null;
  return () => {
    const ahora = Date.now();
    if (ultimo !== null && ahora - ultimo.leidoEn < 500) return ultimo.p;
    const p = parametrosValidos(JSON.parse(readFileSync(archivo, 'utf8')));
    if (p === null) {
      if (ultimo !== null) return ultimo.p;
      throw new Error(`El archivo del reloj ${archivo} no trae parámetros válidos.`);
    }
    ultimo = { leidoEn: ahora, p };
    return p;
  };
}

const dormir = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Un contexto para un bot concreto: su nombre, su rol y su aparato salen en cada incidente. */
export function contextoPara(base: BaseDelDia, bot: Bot): ContextoDelBot {
  const leerReloj = lectorDelReloj(base.entorno.archivoReloj);
  const ahoraSim = (): Date => new Date(horaSimulada(leerReloj(), Date.now()));
  return {
    entorno: base.entorno,
    azar: base.azar.hijo(bot.nombre),
    libro: base.libro,
    registro: base.registro,
    tiempos: base.tiempos,
    mundo: base.mundo,
    navegador: base.navegador,
    ahoraSim,
    async esperarSim(minutos) {
      const real = (minutos * 60_000) / leerReloj().factor;
      const limite = Date.now() + real;
      while (!base.terminado() && Date.now() < limite)
        await dormir(Math.min(1_000, limite - Date.now()));
    },
    terminado: base.terminado,
    async nuevoContexto(
      pedido: NombreDeAparato,
    ): Promise<{ contexto: BrowserContext; pagina: Page }> {
      const aparato = base.sustitutos?.[pedido] ?? pedido;
      const navegador =
        base.navegadores === undefined ? base.navegador : await base.navegadores.de(aparato);
      const contexto = await navegador.newContext({
        ...opcionesDe(aparato),
        baseURL: base.entorno.appUrl,
        acceptDownloads: true,
      });
      if (esDelArnes(aparato)) await prepararContexto(contexto, perfilDelArnes(aparato));
      await contexto.addInitScript(guionDelNavegador(leerReloj()));
      const pagina = await contexto.newPage();
      vigilar(pagina, `${bot.nombre} · ${aparato}`);
      if (base.conDedo === true) ponerElDedo(pagina);
      return { contexto, pagina };
    },
    async incidente(i, pagina) {
      await base.registro.registrar(
        {
          ...i,
          dia: base.entorno.dia,
          horaSim: ahoraSim().toISOString(),
          bot: bot.nombre,
          rol: bot.rol,
          aparato: bot.aparato,
        },
        pagina,
      );
    },
  };
}
