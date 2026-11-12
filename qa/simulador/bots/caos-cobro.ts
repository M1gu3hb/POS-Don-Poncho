/**
 * EL CAOS DEL COBRO, que dispara la cajera sobre una cuenta de mesa real: recargar la pantalla a media
 * acción, cerrar la pestaña a media venta, tocar dos veces «Cobrar» y cobrar con la red caída 30–60 s
 * (`context.setOffline`). En todos los casos la cuenta tiene que quedar cobrada UNA sola vez, y a
 * medias nunca: se comprueba en la base (sólo lectura). Lo que no cumpla es un incidente.
 */
import type { BrowserContext, Page } from '@playwright/test';

import { leerSql, num } from '../arbitro/base.ts';
import type { ContextoDelBot } from '../bot.ts';
import type { VariacionDelCobro } from '../pantallas/caja.ts';
import { irACaja } from '../pantallas/caja.ts';

export type TipoDeCaos = 'recargar' | 'cerrar-pestana' | 'red' | 'doble-toque';

export interface CaosEnCobro {
  readonly tipo: TipoDeCaos;
  readonly contexto: BrowserContext;
}

/** Cuántos pagos confirmados tiene una cuenta (lectura de la base: la verdad del sistema). */
export async function pagosConfirmados(ctx: ContextoDelBot, ordenId: string): Promise<number> {
  const [fila] = await leerSql<{ n: string }>(
    ctx.entorno.baseUrl,
    `select count(*)::text as n from pagos where orden_id = $1 and estado = 'confirmado'`,
    [ordenId],
  );
  return num(fila?.n);
}

/**
 * Cuántas veces está cobrada una cuenta: lo pagado (venta) entre su total. Un mixto son dos filas de
 * pago y sigue siendo UN cobro; un cobro doble da 2.
 */
export async function vecesCobrada(ctx: ContextoDelBot, ordenId: string): Promise<number> {
  const [fila] = await leerSql<{ veces: string }>(
    ctx.entorno.baseUrl,
    `select coalesce(round(sum(p.monto_centavos)::numeric / nullif(max(o.total_centavos), 0)), 0)::text as veces
       from ordenes o left join pagos p on p.orden_id = o.id and p.estado = 'confirmado' where o.id = $1`,
    [ordenId],
  );
  return num(fila?.veces);
}

/** Recargar o cerrar la pestaña con el cobro abierto: devuelve la página con la que se sigue. */
export async function interrumpirElCobro(
  ctx: ContextoDelBot,
  pagina: Page,
  caos: CaosEnCobro,
  cuenta: { cuenta: string; mesa: number | null },
): Promise<Page> {
  let siguiente = pagina;
  if (caos.tipo === 'recargar') {
    await pagina.reload({ waitUntil: 'domcontentloaded' });
  } else {
    await pagina.close();
    siguiente = await caos.contexto.newPage();
    siguiente.setDefaultTimeout(30_000);
  }
  await irACaja(siguiente, ctx.entorno.appUrl);
  const pagos = await pagosConfirmados(ctx, cuenta.cuenta);
  if (pagos > 0) {
    await ctx.incidente(
      {
        pantalla: 'Caja → Cobrar',
        hizo: `${caos.tipo === 'recargar' ? 'Recargué la pantalla' : 'Cerré la pestaña'} con el cobro de la mesa ${String(cuenta.mesa)} abierto, sin tocar «Cobrar»`,
        esperaba: 'La cuenta sigue pendiente, sin ningún pago',
        paso: `Hay ${String(pagos)} pago(s) confirmados`,
        gravedad: 'critico',
        clase: 'dinero',
        reproducido: 'no intentado',
      },
      siguiente,
    );
  }
  return siguiente;
}

/** Lo que hay que cambiarle al toque de «Cobrar» según el caos. */
export function variacionDelCobro(
  ctx: ContextoDelBot,
  caos: CaosEnCobro | undefined,
): VariacionDelCobro {
  if (caos?.tipo === 'doble-toque') return { doble: true };
  if (caos?.tipo === 'red') {
    const segundos = ctx.azar.entero(30, 60);
    return {
      sinRed: {
        contexto: caos.contexto,
        esperar: () => new Promise((r) => setTimeout(r, segundos * 1_000)),
      },
    };
  }
  return {};
}

/** Después del caos: UN solo pago confirmado por cuenta, ni más ni menos. */
export async function exigirUnSoloPago(
  ctx: ContextoDelBot,
  pagina: Page,
  caos: CaosEnCobro,
  ordenId: string,
): Promise<void> {
  const pagos = await vecesCobrada(ctx, ordenId);
  if (pagos === 1) return;
  await ctx.incidente(
    {
      pantalla: 'Caja → Cobrar',
      hizo: `Cobré una cuenta con el caos «${caos.tipo}»`,
      esperaba: 'Cobrada exactamente una vez',
      paso: `La cuenta está cobrada ${String(pagos)} vez/veces en la base (pagado ÷ total)`,
      gravedad: 'critico',
      clase: caos.tipo === 'doble-toque' ? 'concurrencia' : 'dinero',
      reproducido: 'no intentado',
    },
    pagina,
  );
}

/** Calendario del caos de la caja: a la cuenta número N de esta cajera le toca esta travesura. */
export function caosParaLaCuenta(
  plan: readonly { readonly cuentaNumero: number; readonly tipo: TipoDeCaos }[],
  numero: number,
): TipoDeCaos | undefined {
  return plan.find((p) => p.cuentaNumero === numero)?.tipo;
}

/** Las pantallas de cada caja, para el caos que necesita las dos a la vez (`caos-disputa.ts`). */
export const paginasDeCaja = new Map<string, Page>();

/** El bot de la disputa detiene a las cajeras un instante: `quietas` cuenta las que ya pararon. */
export const pausaDeCaos = { enCurso: false, quietas: 0 };
