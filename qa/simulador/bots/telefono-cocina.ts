/**
 * LOS TELÉFONOS DE COCINA: un cocinero conecta el teléfono de su estación («Conectar teléfono» en la
 * pantalla de Cocina) y el teléfono, sin sesión, abre el enlace. Ahí desliza el carrusel de comandas,
 * toca una mesa de la tira, y toca «Preparar» y «Listo» con los tiempos de preparación de siempre.
 */
import type { Page } from '@playwright/test';

import type { Bot, ContextoDelBot } from '../bot.ts';
import { minutoDelDia } from '../horario.ts';
import { contar } from '../mundo.ts';
import { entrarOFallar, salir } from '../sesion.ts';
import { ESPERA_MS, intentar, vigilarServidor } from './ayudas.ts';
import { minutosDePreparacion } from './estacion.ts';

export interface ConfigDelTelefonoDeCocina {
  readonly persona: string;
  readonly estacion: string;
}

/** Con la sesión del cocinero genera el código de la estación y devuelve la ruta del teléfono. */
async function conectarElTelefono(
  ctx: ContextoDelBot,
  cfg: ConfigDelTelefonoDeCocina,
): Promise<string | null> {
  const { contexto, pagina } = await ctx.nuevoContexto('pc-1920');
  try {
    await entrarOFallar(pagina, ctx.entorno, cfg.persona);
    await pagina.goto(`${ctx.entorno.appUrl}/cocina`, {
      waitUntil: 'domcontentloaded',
      timeout: ESPERA_MS,
    });
    let ruta: string | null = null;
    const ok = await intentar(
      ctx,
      pagina,
      {
        bot: cfg.persona,
        pantalla: 'Cocina · Conectar teléfono',
        hizo: `Conectar el teléfono de ${cfg.estacion}`,
        esperaba: 'El diálogo enseña el código QR y la dirección del teléfono.',
        paso: 'conectar teléfono',
      },
      async () => {
        await pagina.getByRole('button', { name: 'Conectar teléfono' }).click();
        const dialogo = pagina.getByRole('dialog', { name: 'Conectar teléfono' });
        await dialogo.getByRole('button', { name: cfg.estacion, exact: true }).click();
        const enlace = await dialogo.getByRole('link').getAttribute('href', { timeout: ESPERA_MS });
        if (!enlace?.includes('/cocina-telefono/'))
          throw new Error('El diálogo no enseña la dirección del teléfono.');
        ruta = new URL(enlace, ctx.entorno.appUrl).pathname;
      },
    );
    if (ok) await salir(pagina).catch(() => undefined);
    return ruta;
  } finally {
    await contexto.close();
  }
}

/** La comanda que el carrusel tiene a la vista: su nombre accesible y su texto (sin el reloj). */
async function comandaALaVista(pagina: Page): Promise<string | null> {
  return pagina.locator('article[aria-label^="Comanda de"]').evaluateAll((articulos) => {
    const ancho = window.innerWidth;
    const vista = articulos.find((a) => {
      const r = a.getBoundingClientRect();
      return r.left >= -ancho / 3 && r.left < ancho / 2 && r.width > 0;
    });
    return vista === undefined
      ? null
      : `${vista.getAttribute('aria-label') ?? ''}|${(vista as HTMLElement).innerText.replace(/\s+/g, ' ').slice(0, 120)}`;
  });
}

async function deslizar(pagina: Page): Promise<void> {
  await pagina
    .getByRole('region', { name: /Comandas, desliza/ })
    .or(pagina.locator('[aria-label^="Comandas, desliza"]'))
    .first()
    .evaluate((el) => {
      el.scrollBy({ left: el.clientWidth, behavior: 'instant' });
    });
}

async function vuelta(
  ctx: ContextoDelBot,
  cfg: ConfigDelTelefonoDeCocina,
  pagina: Page,
  llevan: Map<string, { desde: number; duracion: number }>,
): Promise<void> {
  const base = { bot: `${cfg.persona} (teléfono)`, pantalla: `Teléfono de ${cfg.estacion}` };
  if ((await pagina.getByText('Sin comandas pendientes').count()) > 0) return;
  const chips = pagina.getByRole('button', { name: /Ir a su comanda$/ });
  if ((await chips.count()) > 1 && ctx.azar.probabilidad(0.3))
    await chips
      .nth(ctx.azar.entero(0, (await chips.count()) - 1))
      .click({ timeout: 5_000 })
      .catch(() => undefined);
  else if (ctx.azar.probabilidad(0.25)) await deslizar(pagina).catch(() => undefined);
  const llave = await comandaALaVista(pagina);
  const preparar = pagina.getByRole('button', { name: 'Preparar', exact: true });
  const listo = pagina.getByRole('button', { name: 'Listo', exact: true });
  const ahora = minutoDelDia(ctx.ahoraSim());
  if (await preparar.isEnabled().catch(() => false)) {
    const ok = await intentar(
      ctx,
      pagina,
      {
        ...base,
        hizo: 'Tocar «Preparar»',
        esperaba: 'La comanda pasa a preparación.',
        paso: 'preparar (teléfono)',
      },
      async () => {
        const r = pagina.waitForResponse(
          (x) =>
            /transicion|comanda/i.test(new URL(x.url()).pathname) &&
            x.request().method() === 'POST',
          { timeout: ESPERA_MS },
        );
        await preparar.click();
        if (!(await r).ok()) throw new Error('el servidor rechazó «Preparar»');
      },
    );
    if (ok && llave !== null)
      llevan.set(llave, {
        desde: ahora,
        duracion: minutosDePreparacion(ctx.azar.real(), (min, max) => ctx.azar.entero(min, max)),
      });
    return;
  }
  if (await listo.isEnabled().catch(() => false)) {
    const dato = llave === null ? undefined : llevan.get(llave);
    if (dato !== undefined && ahora - dato.desde < dato.duracion) return;
    const ok = await intentar(
      ctx,
      pagina,
      {
        ...base,
        hizo: 'Tocar «Listo»',
        esperaba: 'La comanda queda lista y avisa al mesero.',
        paso: 'listo (teléfono)',
      },
      async () => {
        const r = pagina.waitForResponse(
          (x) =>
            /transicion|comanda/i.test(new URL(x.url()).pathname) &&
            x.request().method() === 'POST',
          { timeout: ESPERA_MS },
        );
        await listo.click();
        if (!(await r).ok()) throw new Error('el servidor rechazó «Listo»');
      },
    );
    if (ok) {
      if (llave !== null) llevan.delete(llave);
      contar(ctx.mundo, `comandas_listas_telefono:${cfg.estacion}`);
    }
  }
}

export function crearTelefonoDeCocina(cfg: ConfigDelTelefonoDeCocina): Bot {
  return {
    nombre: `${cfg.persona} (teléfono de ${cfg.estacion})`,
    rol: 'telefono_cocina',
    aparato: 'android-412',
    async correr(ctx) {
      const ruta = await conectarElTelefono(ctx, cfg);
      if (ruta === null) return;
      const { contexto, pagina } = await ctx.nuevoContexto('android-412');
      pagina.setDefaultTimeout(ESPERA_MS);
      vigilarServidor(ctx, pagina, () => `Teléfono de ${cfg.estacion}`);
      const llevan = new Map<string, { desde: number; duracion: number }>();
      try {
        await pagina.goto(`${ctx.entorno.appUrl}${ruta}`, {
          waitUntil: 'domcontentloaded',
          timeout: ESPERA_MS,
        });
        const sonido = pagina.getByRole('button', { name: 'Toca para activar el sonido' });
        if (await sonido.isVisible({ timeout: 10_000 }).catch(() => false)) await sonido.click();
        while (!ctx.terminado()) {
          await vuelta(ctx, cfg, pagina, llevan).catch(async (error: unknown) => {
            await ctx.incidente(
              {
                pantalla: `Teléfono de ${cfg.estacion}`,
                hizo: 'Una vuelta del teléfono',
                esperaba: 'Terminar sin fallos del guion.',
                paso: 'vuelta del teléfono',
                reproducido: 'no intentado',
                gravedad: 'bajo',
                clase: 'prueba',
                evidencia: { consola: [String(error).slice(0, 300)] },
              },
              pagina,
            );
          });
          await ctx.esperarSim(0.5);
        }
      } finally {
        await contexto.close();
      }
    },
  };
}
