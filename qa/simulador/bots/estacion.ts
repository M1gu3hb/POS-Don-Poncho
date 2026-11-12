/**
 * LAS ESTACIONES EN PANTALLA GRANDE (1920): Cocina, Bebidas, Parrilla, Postres, Pulques. Un cocinero
 * por estación: toca «Preparar» a lo nuevo, deja pasar los minutos SIMULADOS que tarda cada platillo
 * (a veces tanto que la comanda cruza el ámbar a los 10 min y el rojo a los 20) y toca «Listo».
 * Desde Cocina, a veces, marca un platillo agotado y luego lo regresa.
 */
import type { Page } from '@playwright/test';

import type { Bot, ContextoDelBot } from '../bot.ts';
import { minutoDelDia } from '../horario.ts';
import { contar } from '../mundo.ts';
import { asegurarSesion, despertar, entrarOFallar } from '../sesion.ts';
import { ESPERA_MS, intentar, recuperar, vigilarServidor } from './ayudas.ts';

export interface ConfigDeEstacion {
  /** La persona de la copia que atiende la estación (su tarjeta de acceso). */
  readonly persona: string;
  /** Cómo se llama la estación en las bitácoras. */
  readonly estacion: string;
  /** Si esta estación marca agotados a media jornada (la Cocina). */
  readonly marcaAgotados: boolean;
}

/** Cuánto tarda un platillo, en minutos simulados: casi siempre poco, a veces cruza ámbar o rojo. */
export function minutosDePreparacion(
  dado: number,
  entero: (a: number, b: number) => number,
): number {
  if (dado < 0.7) return entero(3, 9);
  if (dado < 0.92) return entero(10, 19);
  return entero(20, 28);
}

interface EnPreparacion {
  readonly llevaDesde: number;
  readonly duracion: number;
}

/** La llave de una comanda en pantalla: «Mesa N» y sus renglones, sin la hora que cambia cada minuto. */
function llaveDeLaTarjeta(texto: string): string {
  return texto
    .split('\n')
    .map((l) => l.trim())
    .filter(
      (l) =>
        l !== '' &&
        !/^(Ahora|Hace|\d+ min|Listo hace)/.test(l) &&
        !/\((a tiempo|tarda|retrasad)/i.test(l),
    )
    .join('|')
    .slice(0, 160);
}

async function tarjetaDe(boton: ReturnType<Page['getByRole']>): Promise<string> {
  const tarjeta = boton
    .first()
    .locator('xpath=ancestor::*[contains(normalize-space(.), "Mesa")][1]');
  return llaveDeLaTarjeta(await tarjeta.innerText({ timeout: 10_000 }));
}

async function marcarAgotado(
  ctx: ContextoDelBot,
  pagina: Page,
  persona: string,
  producto: string,
  agotado: boolean,
): Promise<boolean> {
  return intentar(
    ctx,
    pagina,
    {
      bot: persona,
      pantalla: 'Cocina · Agotados',
      hizo: `${agotado ? 'Marcar' : 'Quitar'} «${producto}» como agotado`,
      esperaba: 'El cambio queda guardado en el día.',
      paso: agotado ? 'marcar agotado' : 'quitar agotado',
    },
    async () => {
      await pagina.getByRole('button', { name: 'Agotados', exact: true }).click();
      const dialogo = pagina.getByRole('dialog').last();
      const interruptor = dialogo.getByRole('switch', { name: `${producto}: agotado hoy` });
      await interruptor.waitFor({ timeout: ESPERA_MS });
      if ((await interruptor.getAttribute('aria-checked')) !== String(agotado)) {
        const guardado = pagina.waitForResponse(
          (r) => r.request().method() === 'POST' && r.url().includes('/api/') && r.ok(),
          { timeout: ESPERA_MS },
        );
        await interruptor.click();
        await guardado;
      }
      await pagina.keyboard.press('Escape');
    },
  );
}

class Estacion {
  readonly llevan = new Map<string, EnPreparacion>();
  agotadoHasta: { producto: string; hasta: number } | null = null;
  agotadoHecho = false;
  readonly ctx: ContextoDelBot;
  readonly cfg: ConfigDeEstacion;
  readonly pagina: Page;
  constructor(ctx: ContextoDelBot, cfg: ConfigDeEstacion, pagina: Page) {
    this.ctx = ctx;
    this.cfg = cfg;
    this.pagina = pagina;
  }

  private base(hizo: string, esperaba: string, paso: string) {
    return {
      bot: this.cfg.persona,
      pantalla: `Estación ${this.cfg.estacion}`,
      hizo,
      esperaba,
      paso,
    };
  }

  async preparar(): Promise<void> {
    const { ctx, pagina } = this;
    const nuevas = pagina.getByRole('button', { name: 'Preparar', exact: true });
    for (let i = 0; i < 3 && (await nuevas.count()) > 0 && !ctx.terminado(); i += 1) {
      const llave = await tarjetaDe(nuevas);
      const ok = await intentar(
        ctx,
        pagina,
        this.base('Tocar «Preparar»', 'La comanda pasa a «En preparación».', 'preparar'),
        async () => {
          const r = pagina.waitForResponse(
            (x) => new URL(x.url()).pathname === '/api/restaurante/transicionar-pedido',
            { timeout: ESPERA_MS },
          );
          await nuevas.first().click();
          if ((await r).status() !== 200) throw new Error('transicionar-pedido rechazó «Preparar»');
        },
      );
      if (!ok) return;
      this.llevan.set(llave, {
        llevaDesde: minutoDelDia(ctx.ahoraSim()),
        duracion: minutosDePreparacion(ctx.azar.real(), (min, max) => ctx.azar.entero(min, max)),
      });
      contar(ctx.mundo, `comandas_en_preparacion:${this.cfg.estacion}`);
      await pagina.waitForTimeout(500);
    }
  }

  async dejarListas(): Promise<void> {
    const { ctx, pagina } = this;
    const listas = pagina.getByRole('button', { name: 'Listo', exact: true });
    const n = await listas.count();
    for (let i = 0; i < n && !ctx.terminado(); i += 1) {
      const boton = listas.nth(i);
      const llave = await tarjetaDe(boton);
      const dato = this.llevan.get(llave) ?? {
        llevaDesde: minutoDelDia(ctx.ahoraSim()),
        duracion: 1,
      };
      this.llevan.set(llave, dato);
      if (minutoDelDia(ctx.ahoraSim()) - dato.llevaDesde < dato.duracion) continue;
      const ok = await intentar(
        ctx,
        pagina,
        this.base('Tocar «Listo»', 'La comanda pasa a «Listos» y avisa al mesero.', 'listo'),
        async () => {
          const r = pagina.waitForResponse(
            (x) => new URL(x.url()).pathname === '/api/restaurante/transicionar-pedido',
            { timeout: ESPERA_MS },
          );
          await boton.click();
          if ((await r).status() !== 200) throw new Error('transicionar-pedido rechazó «Listo»');
        },
      );
      if (ok) {
        this.llevan.delete(llave);
        contar(ctx.mundo, `comandas_listas:${this.cfg.estacion}`);
      }
      return;
    }
  }

  async agotados(): Promise<void> {
    const { ctx, pagina, cfg } = this;
    const ahora = minutoDelDia(ctx.ahoraSim());
    if (this.agotadoHasta !== null && ahora >= this.agotadoHasta.hasta) {
      if (await marcarAgotado(ctx, pagina, cfg.persona, this.agotadoHasta.producto, false))
        ctx.mundo.agotados.delete(this.agotadoHasta.producto);
      this.agotadoHasta = null;
    } else if (
      this.agotadoHasta === null &&
      !this.agotadoHecho &&
      cfg.marcaAgotados &&
      ahora > 8 * 60 + 20 &&
      ctx.azar.probabilidad(0.08)
    ) {
      const candidatos = ctx.mundo.catalogo.filter(
        (p) =>
          p.estacion === cfg.estacion && p.grupos.length === 0 && p.tipoVenta === 'precio_fijo',
      );
      const elegido = candidatos.length === 0 ? undefined : ctx.azar.elegir(candidatos);
      if (elegido === undefined) return;
      this.agotadoHecho = true;
      if (await marcarAgotado(ctx, pagina, cfg.persona, elegido.nombre, true)) {
        ctx.mundo.agotados.add(elegido.nombre);
        this.agotadoHasta = { producto: elegido.nombre, hasta: ahora + 40 };
        contar(ctx.mundo, 'agotados');
      }
    }
  }
}

export function crearEstacion(cfg: ConfigDeEstacion): Bot {
  return {
    nombre: `${cfg.persona} (${cfg.estacion})`,
    rol: 'estacion',
    aparato: 'pc-1920',
    async correr(ctx) {
      const { contexto, pagina } = await ctx.nuevoContexto('pc-1920');
      pagina.setDefaultTimeout(ESPERA_MS);
      vigilarServidor(ctx, pagina, () => `Estación ${cfg.estacion}`);
      const estacion = new Estacion(ctx, cfg, pagina);
      try {
        await entrarOFallar(pagina, ctx.entorno, cfg.persona);
        while (!ctx.terminado()) {
          try {
            if ((await asegurarSesion(pagina, ctx.entorno, cfg.persona)) === 'reentro') {
              await ctx.incidente(
                {
                  pantalla: `Estación ${cfg.estacion}`,
                  hizo: 'Seguir en la estación',
                  esperaba: 'La sesión de la estación sigue vigente en la jornada.',
                  paso: 'sesión vencida',
                  reproducido: 'no intentado',
                  gravedad: 'medio',
                  clase: 'ux',
                },
                pagina,
              );
            }
            await despertar(pagina, ctx.entorno, cfg.persona);
            if (!new URL(pagina.url()).pathname.endsWith('/cocina'))
              await recuperar(pagina, ctx.entorno.appUrl, '/cocina');
            await estacion.preparar();
            await estacion.dejarListas();
            await estacion.agotados();
          } catch (error: unknown) {
            await ctx.incidente(
              {
                pantalla: `Estación ${cfg.estacion}`,
                hizo: 'Una vuelta de la estación',
                esperaba: 'Terminar la vuelta sin fallos del guion.',
                paso: 'vuelta de la estación',
                reproducido: 'no intentado',
                gravedad: 'bajo',
                clase: 'prueba',
                evidencia: { consola: [String(error).slice(0, 300)] },
              },
              pagina,
            );
            await recuperar(pagina, ctx.entorno.appUrl, '/cocina');
          }
          await ctx.esperarSim(0.5);
        }
      } finally {
        await contexto.close();
      }
    },
  };
}
