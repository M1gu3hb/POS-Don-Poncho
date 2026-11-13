/**
 * LO QUE COMPARTEN LOS BOTS DE B: abrir sesión en un aparato, medir una acción (y registrar si tarda
 * de más) y convertir una excepción inesperada en un incidente de clase «prueba» (a triar: o falló el
 * guion o falló el sistema; nunca se esconde).
 */
import type { Page } from '@playwright/test';

import type { NombreDeAparato } from '../aparatos.ts';
import { entrarConDespertador } from '../sesion.ts';
import type { Bot, ContextoDelBot } from '../bot.ts';
import type { Gravedad } from '../incidentes.ts';
import { UMBRAL_ACCION_MS } from '../tiempos.ts';

export async function abrirSesion(ctx: ContextoDelBot, persona: string, aparato: NombreDeAparato) {
  const c = await ctx.nuevoContexto(aparato);
  c.pagina.setDefaultTimeout(30_000);
  await entrarConDespertador(c.pagina, ctx.entorno, persona);
  return c;
}

export interface Lugar {
  readonly bot: Bot;
  readonly pantalla: string;
}

/** Mide una acción; si pasa de 3 s la registra como incidente de rendimiento (medio). */
export async function medido<T>(
  ctx: ContextoDelBot,
  l: Lugar,
  pagina: Page,
  accion: string,
  fn: () => Promise<T>,
): Promise<T> {
  return ctx.tiempos.medir(`${l.bot.rol}:${accion}`, fn, async (ms) => {
    await ctx.incidente(
      {
        pantalla: l.pantalla,
        hizo: accion,
        esperaba: `Responder en menos de ${String(UMBRAL_ACCION_MS / 1000)} s`,
        paso: `Tardó ${String(ms)} ms`,
        gravedad: 'medio',
        clase: 'rendimiento',
        reproducido: 'no intentado',
      },
      pagina,
    );
  });
}

/** Una excepción inesperada de un paso: incidente «prueba» con el primer renglón del error. */
export async function registrarFallo(
  ctx: ContextoDelBot,
  l: Lugar,
  pagina: Page | undefined,
  hizo: string,
  esperaba: string,
  error: unknown,
  gravedad: Gravedad = 'medio',
): Promise<void> {
  await ctx.incidente(
    {
      pantalla: l.pantalla,
      hizo,
      esperaba,
      paso: String(error).split('\n').slice(0, 3).join(' ').slice(0, 400),
      gravedad,
      clase: 'prueba',
      reproducido: 'no intentado',
    },
    pagina,
  );
}

/** Quién autoriza descuentos y retiros grandes: la gerente (su PIN de prueba sale del archivo). */
export const GERENTE = 'Gerente';
