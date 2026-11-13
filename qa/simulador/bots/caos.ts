/**
 * EL CAOS CONTROLADO de la entrada: PIN equivocado hasta el bloqueo (y esperar a que se levante),
 * sesión vencida a media acción y un aparato que cambia de usuario. Corre con una persona de
 * repuesto (la tercera cajera) para no pisar a las que están cobrando. Cada cosa que el sistema
 * hace mal es un incidente; lo que hace bien, se anota en el libro como un hecho comprobado.
 *
 * El caos de la caja (recargar a media acción, cerrar la pestaña a media venta, red caída, doble
 * toque y dos cajas sobre la misma cuenta) vive en `caos-cobro.ts` y lo dispara cada cajera.
 */
import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

import type { Bot, ContextoDelBot } from '../bot.ts';
import { pinVigente } from '../entorno.ts';
import { abrirSesion, registrarFallo } from './comun.ts';

const REPUESTO = 'Caja 3';
const MAXIMO_DE_INTENTOS = 10;

/** Un PIN de cuatro cifras que NO es el de la persona (cambia la última cifra). */
export function pinEquivocadoDe(pin: string): string {
  const ultima = (Number(pin.at(-1)) + 3) % 10;
  return `${pin.slice(0, 3)}${String(ultima)}`;
}

async function teclear(pagina: Page, pin: string): Promise<void> {
  for (const d of pin) await pagina.getByRole('button', { name: d, exact: true }).click();
}

async function elegirTarjeta(pagina: Page, ctx: ContextoDelBot, persona: string): Promise<void> {
  await pagina.goto(`${ctx.entorno.appUrl}/n/don-poncho/login-pos`, {
    waitUntil: 'domcontentloaded',
  });
  await pagina
    .getByRole('button')
    .filter({ has: pagina.locator('p:first-child', { hasText: new RegExp(`^${persona}$`) }) })
    .first()
    .click({ noWaitAfter: true });
}

/** PIN equivocado una y otra vez: tiene que haber un bloqueo, con aviso, y tiene que levantarse. */
async function pinEquivocado(ctx: ContextoDelBot, bot: Bot): Promise<void> {
  const lugar = { bot, pantalla: 'Entrar con PIN' };
  const { contexto, pagina } = await ctx.nuevoContexto('tableta-768');
  const malo = pinEquivocadoDe(pinVigente(ctx.entorno, REPUESTO));
  const estados: number[] = [];
  pagina.on('response', (r) => {
    if (new URL(r.url()).pathname === '/api/auth/entrar' && r.request().method() === 'POST')
      estados.push(r.status());
  });
  await elegirTarjeta(pagina, ctx, REPUESTO);
  let bloqueoEn = 0;
  for (let i = 1; i <= MAXIMO_DE_INTENTOS && bloqueoEn === 0; i += 1) {
    const antes = estados.length;
    await teclear(pagina, malo);
    await expect.poll(() => estados.length, { timeout: 15_000 }).toBeGreaterThan(antes);
    if ((estados.at(-1) ?? 0) === 423 || (estados.at(-1) ?? 0) === 429) bloqueoEn = i;
    else await pagina.waitForTimeout(400);
  }
  if (bloqueoEn === 0) {
    await ctx.incidente(
      {
        pantalla: lugar.pantalla,
        hizo: `Tecleé ${String(MAXIMO_DE_INTENTOS)} veces un PIN equivocado de la misma cajera`,
        esperaba: 'Un bloqueo con aviso de cuánto esperar',
        paso: `Respuestas: ${estados.join(', ')}; nunca se bloqueó`,
        gravedad: 'alto',
        clase: 'permisos',
        reproducido: 'no intentado',
      },
      pagina,
    );
  } else {
    ctx.libro.anotar(bot.nombre, {
      tipo: 'cambio_en_vivo',
      que: 'bloqueo por PIN equivocado',
      antes: 'libre',
      despues: `bloqueada tras ${String(bloqueoEn)} intentos`,
    });
    const aviso = await pagina
      .getByText(/espera|bloquead|intentos/i)
      .first()
      .isVisible()
      .catch(() => false);
    if (!aviso) {
      await ctx.incidente(
        {
          pantalla: lugar.pantalla,
          hizo: 'Me bloquearon por PIN equivocado',
          esperaba: 'La pantalla dice que está bloqueada y cuánto esperar',
          paso: 'No hay ningún aviso visible del bloqueo',
          gravedad: 'medio',
          clase: 'ux',
          reproducido: 'no intentado',
        },
        pagina,
      );
    }
    // Con la cuenta bloqueada, ni el PIN bueno entra.
    const antes = estados.length;
    await teclear(pagina, pinVigente(ctx.entorno, REPUESTO));
    await expect.poll(() => estados.length, { timeout: 15_000 }).toBeGreaterThan(antes);
    if (estados.at(-1) === 200) {
      await ctx.incidente(
        {
          pantalla: lugar.pantalla,
          hizo: 'Tecleé el PIN bueno con la cuenta bloqueada',
          esperaba: 'Sigue bloqueada hasta que pase la espera',
          paso: 'Entró (200)',
          gravedad: 'critico',
          clase: 'permisos',
          reproducido: 'no intentado',
        },
        pagina,
      );
    }
  }
  await contexto.close();
  if (bloqueoEn > 0) await ctx.esperarSim(20);
}

/** Sesión vencida a media acción: se pierde la cookie, la pantalla pide entrar de nuevo y se puede. */
async function sesionVencida(ctx: ContextoDelBot, bot: Bot): Promise<void> {
  const lugar = { bot, pantalla: 'Sesión vencida' };
  const { contexto, pagina } = await abrirSesion(ctx, REPUESTO, 'pc-1920');
  await pagina.goto(`${ctx.entorno.appUrl}/caja`, { waitUntil: 'domcontentloaded' });
  await contexto.clearCookies();
  await pagina.reload({ waitUntil: 'domcontentloaded' });
  const alLogin = await pagina
    .waitForURL((u) => u.pathname.includes('login'), { timeout: 20_000, waitUntil: 'commit' })
    .then(
      () => true,
      () => false,
    );
  if (!alLogin) {
    await ctx.incidente(
      {
        pantalla: lugar.pantalla,
        hizo: 'Perdí la sesión (cookie vencida) y recargué la Caja',
        esperaba: 'La pantalla de entrar con PIN',
        paso: `Se quedó en ${new URL(pagina.url()).pathname}`,
        gravedad: 'alto',
        clase: 'permisos',
        reproducido: 'no intentado',
      },
      pagina,
    );
  } else {
    ctx.libro.anotar(bot.nombre, {
      tipo: 'cambio_en_vivo',
      que: 'sesión vencida',
      antes: 'entrada',
      despues: 'pide entrar de nuevo',
    });
  }
  await contexto.close();
}

/** Un aparato que cambia de usuario: no debe quedar nada de la persona anterior. */
async function cambioDeUsuario(ctx: ContextoDelBot, bot: Bot): Promise<void> {
  const lugar = { bot, pantalla: 'Cambiar de persona' };
  const { contexto, pagina } = await abrirSesion(ctx, 'Mesero 6', 'pc-1920');
  await pagina.getByRole('button', { name: 'Salir' }).first().click();
  await pagina.waitForURL((u) => u.pathname.includes('login'), {
    timeout: 20_000,
    waitUntil: 'commit',
  });
  await elegirTarjeta(pagina, ctx, REPUESTO);
  await teclear(pagina, pinVigente(ctx.entorno, REPUESTO));
  await pagina.waitForURL((u) => !u.pathname.includes('login'), {
    timeout: 30_000,
    waitUntil: 'commit',
  });
  const cuerpo = await pagina.locator('body').innerText();
  if (cuerpo.includes('Mesero 6')) {
    await ctx.incidente(
      {
        pantalla: lugar.pantalla,
        hizo: 'Salí como Mesero 6 y entré como la cajera en el mismo aparato',
        esperaba: 'Ninguna huella de la persona anterior',
        paso: 'La pantalla todavía nombra a «Mesero 6»',
        gravedad: 'alto',
        clase: 'permisos',
        reproducido: 'no intentado',
      },
      pagina,
    );
  } else {
    ctx.libro.anotar(bot.nombre, {
      tipo: 'cambio_en_vivo',
      que: 'cambio de usuario en el aparato',
      antes: 'Mesero 6',
      despues: REPUESTO,
    });
  }
  await contexto.close();
}

export interface PlanDeCaos {
  /** Minuto del día en que empieza el caos de la entrada. */
  readonly enMinuto: number;
}

export function crearBotCaos(plan: PlanDeCaos): Bot {
  const bot: Bot = {
    nombre: 'Caos',
    rol: 'caos',
    aparato: 'pc-1920',
    async correr(ctx) {
      const inicio = ctx.ahoraSim().getTime();
      while (!ctx.terminado() && (ctx.ahoraSim().getTime() - inicio) / 60_000 < plan.enMinuto)
        await ctx.esperarSim(1);
      for (const [nombre, escena] of [
        ['sesión vencida', sesionVencida],
        ['cambio de usuario', cambioDeUsuario],
        ['PIN equivocado', pinEquivocado],
      ] as const) {
        if (ctx.terminado()) return;
        try {
          await escena(ctx, bot);
        } catch (error: unknown) {
          await registrarFallo(
            ctx,
            { bot, pantalla: `Caos · ${nombre}` },
            undefined,
            `Escena de caos «${nombre}»`,
            'Termina y el sistema responde como debe',
            error,
          );
        }
      }
    },
  };
  return bot;
}
