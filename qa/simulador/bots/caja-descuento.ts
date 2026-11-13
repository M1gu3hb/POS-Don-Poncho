/**
 * LOS DESCUENTOS EN EL COBRO. En esta versión de la app TODO descuento lo autoriza un gerente,
 * administrador o dueño con su PIN (DP-14.2): el tope de la cajera ($50 o 10 %) ya no deja descontar
 * solo. Por eso hay dos clases de descuento en el día:
 *  - CON PIN: la cajera llena cuánto y por qué, y la gerente teclea su PIN (en pesos o en porcentaje).
 *  - SIN PIN (un intento): la cajera lo prueba sin autorización; la pantalla no la debe dejar
 *    aplicarlo y el servidor tampoco. Lo que pase distinto es un incidente; lo que pase bien se
 *    anota en el libro como un hecho comprobado.
 */
import type { Locator, Page } from '@playwright/test';

import { llamar } from '../api-app.ts';
import type { Bot, ContextoDelBot } from '../bot.ts';
import { pinVigente } from '../entorno.ts';
import {
  aplicarDescuento,
  intentarDescuentoSinPin,
  soltarElDescuento,
  type Descuento,
} from '../pantallas/caja.ts';
import { dinero, esperarPost } from '../pantallas/comun.ts';
import { GERENTE, medido } from './comun.ts';

/** Con qué frecuencia (por cuenta de mesa o pedido para llevar) pasa cada cosa en una caja. */
export interface RitmoDeCaja {
  /** Probabilidad de que la mesa pida dividir la cuenta (sólo cuentas de mesa, sin caos). */
  readonly dividir: number;
  /** Probabilidad de un descuento autorizado con el PIN de la gerente. */
  readonly descuentoConPin: number;
  /** Probabilidad de que la cajera intente un descuento sin PIN (y la pantalla lo rechace). */
  readonly descuentoSinPin: number;
}

/** Con ~150 cobros al día: unas 20 divisiones, unos 24 descuentos con PIN y unos 12 intentos sin PIN. */
export const RITMO_POR_OMISION: RitmoDeCaja = {
  dividir: 0.14,
  descuentoConPin: 0.16,
  descuentoSinPin: 0.08,
};

const MOTIVOS = ['cliente frecuente', 'producto golpeado', 'cortesía de la casa', 'espera larga'];

/** Lo más que autoriza la gerente de prueba (su tope en la configuración): 30 % de la cuenta. */
const TOPE_DE_LA_GERENTE = 0.3;

/**
 * El descuento que se le ocurre a la cajera: porcentaje (10 o 20) o pesos redondos, siempre dentro
 * de lo que la gerente puede autorizar. Antes pedía $20 sobre $60 (33 %): la app lo frena, como debe,
 * y el guion se quedaba esperando «Aplicar» (D1-049).
 */
function elegirDescuento(
  ctx: ContextoDelBot,
  baseCentavos: number,
): { d: Omit<Descuento, 'autoriza'>; centavos: number } {
  const motivo = ctx.azar.elegir(MOTIVOS);
  const enPesos = [10, 15, 20].filter((p) => p * 100 <= baseCentavos * TOPE_DE_LA_GERENTE);
  if (enPesos.length > 0 && ctx.azar.probabilidad(0.4)) {
    const pesos = ctx.azar.elegir(enPesos);
    return { d: { tipo: 'pesos', valor: pesos, motivo }, centavos: pesos * 100 };
  }
  const porcentaje = ctx.azar.elegir([10, 10, 20]);
  return {
    d: { tipo: 'porcentaje', valor: porcentaje, motivo },
    centavos: Math.round((baseCentavos * porcentaje) / 100),
  };
}

/** Un descuento con el PIN de la gerente. Devuelve lo descontado (centavos) y lo anota en el libro. */
async function descuentoConPin(
  ctx: ContextoDelBot,
  bot: Bot,
  pagina: Page,
  cobro: Locator,
  cuenta: string,
  baseCentavos: number,
): Promise<number> {
  const { d, centavos } = elegirDescuento(ctx, baseCentavos);
  await medido(
    ctx,
    { bot, pantalla: 'Caja → Cobrar' },
    pagina,
    'aplicar un descuento con PIN',
    () =>
      aplicarDescuento(pagina, cobro, {
        ...d,
        autoriza: { nombre: GERENTE, pin: pinVigente(ctx.entorno, GERENTE) },
      }),
  );
  ctx.libro.anotar(bot.nombre, { tipo: 'descuento', cuenta, centavos, conPin: true });
  return centavos;
}

/**
 * Un intento de descuento sin PIN. La pantalla debe dejar «Aplicar el descuento» apagado y el
 * servidor debe rechazarlo si se le pide igual. Devuelve lo que SÍ se aplicó (cero si todo salió
 * como debía; si el sistema lo aceptó, hay un incidente crítico y el descuento cuenta).
 */
async function intentoSinPin(
  ctx: ContextoDelBot,
  bot: Bot,
  pagina: Page,
  cobro: Locator,
  cuenta: string,
  baseCentavos: number,
): Promise<number> {
  const { d, centavos } = elegirDescuento(ctx, baseCentavos);
  const lugar = 'Caja → Cobrar (descuento sin PIN)';
  const hizo = `Quise dar un descuento de ${dinero(centavos)} sin PIN de quien autoriza`;
  const { aplicarApagado, dialogo } = await intentarDescuentoSinPin(pagina, cobro, d);
  let aplicado = 0;
  if (!aplicarApagado) {
    await ctx.incidente(
      {
        pantalla: lugar,
        hizo,
        esperaba: '«Aplicar el descuento» apagado hasta que alguien autorice con su PIN',
        paso: 'El botón estaba encendido sin ninguna autorización',
        gravedad: 'alto',
        clase: 'permisos',
        reproducido: 'no intentado',
      },
      pagina,
    );
    const envio = esperarPost(pagina, '/api/restaurante/descontar-cuenta');
    await dialogo.getByRole('button', { name: 'Aplicar el descuento' }).click();
    if ((await envio).status() === 200) aplicado = centavos;
  } else {
    // La pantalla no deja; se comprueba que el servidor tampoco aceptaría el mismo pedido sin autorización.
    const sondeo = await llamar(pagina, '/api/restaurante/descontar-cuenta', {
      ordenId: cuenta,
      descuentoCentavos: centavos,
      motivo: d.motivo,
    });
    if (sondeo.ok) aplicado = centavos;
  }
  if (aplicado > 0) {
    await ctx.incidente(
      {
        pantalla: lugar,
        hizo,
        esperaba: 'El servidor rechaza un descuento sin PIN',
        paso: `El servidor lo aplicó (${dinero(aplicado)}) sin autorización`,
        gravedad: 'critico',
        clase: 'permisos',
        reproducido: 'no intentado',
      },
      pagina,
    );
    ctx.libro.anotar(bot.nombre, { tipo: 'descuento', cuenta, centavos: aplicado, conPin: false });
  } else {
    ctx.libro.anotar(bot.nombre, {
      tipo: 'cambio_en_vivo',
      que: `descuento sin PIN de ${dinero(centavos)} en ${cuenta}`,
      antes: 'cuenta sin descuento',
      despues: 'la pantalla no lo deja aplicar y el servidor lo rechaza',
    });
  }
  await soltarElDescuento(pagina, dialogo);
  return aplicado;
}

/**
 * Lo que la cajera hace con los descuentos antes de cobrar esta cuenta: a veces un intento sin PIN
 * y a veces uno con PIN. Devuelve el total descontado (centavos).
 */
export async function descuentosDelCobro(
  ctx: ContextoDelBot,
  bot: Bot,
  pagina: Page,
  cobro: Locator,
  cuenta: string,
  baseCentavos: number,
  ritmo: RitmoDeCaja,
): Promise<number> {
  let descontado = 0;
  if (ctx.azar.probabilidad(ritmo.descuentoSinPin))
    descontado += await intentoSinPin(ctx, bot, pagina, cobro, cuenta, baseCentavos);
  if (descontado === 0 && ctx.azar.probabilidad(ritmo.descuentoConPin))
    descontado += await descuentoConPin(ctx, bot, pagina, cobro, cuenta, baseCentavos);
  return descontado;
}
