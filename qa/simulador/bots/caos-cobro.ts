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

const ES_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** La condición SQL (sobre `ordenes o`) que señala la orden de una cuenta, y su valor. */
interface OrdenEnLaBase {
  readonly donde: string;
  readonly valor: string;
}

const POR_FOLIO =
  'o.id = (select id from ordenes where folio::text = $1 order by created_at desc limit 1)';
const POR_MESA = `o.id = (select o2.id from ordenes o2 join mesas m on m.id = o2.mesa_id
   where m.numero::text = $1 and o2.estado <> 'borrador' and o2.orden_padre_id is null
   order by o2.created_at desc limit 1)`;

/**
 * Dónde está en la base la orden de una cuenta. El simulador conoce las de mesa por el id de su
 * LLEGADA («D1-025»), que la base no tiene: se busca por el folio de su cobro en el libro y, si aún
 * no hay cobro anotado (la disputa y los fallos preguntan ANTES de anotarlo, D1-091), por la última
 * orden de su mesa. Un id de orden (para llevar) o un folio numérico van directo.
 */
function ordenEnLaBase(
  ctx: ContextoDelBot,
  cuenta: string,
  mesa: number | null,
): OrdenEnLaBase | null {
  if (ES_UUID.test(cuenta)) return { donde: 'o.id = $1::uuid', valor: cuenta };
  if (/^\d+$/.test(cuenta)) return { donde: POR_FOLIO, valor: cuenta };
  const cobro = [...ctx.libro.leer()]
    .reverse()
    .find((f) => f.asiento.tipo === 'cobro' && f.asiento.cuenta === cuenta);
  if (cobro?.asiento.tipo === 'cobro' && cobro.asiento.folio !== '')
    return { donde: POR_FOLIO, valor: cobro.asiento.folio };
  return mesa === null ? null : { donde: POR_MESA, valor: String(mesa) };
}

/** Cuántos pagos confirmados tiene la cuenta (lectura de la base: la verdad del sistema). */
export async function pagosConfirmados(
  ctx: ContextoDelBot,
  cuenta: string,
  mesa: number | null = null,
): Promise<number> {
  const orden = ordenEnLaBase(ctx, cuenta, mesa);
  if (orden === null) return 0;
  const [fila] = await leerSql<{ n: string }>(
    ctx.entorno.baseUrl,
    `select count(*)::text as n from ordenes o join pagos p on p.orden_id = o.id
      where p.estado = 'confirmado' and ${orden.donde}`,
    [orden.valor],
  );
  return num(fila?.n);
}

/**
 * ¿La mesa todavía tiene una cuenta pedida sin cobrar? Tras un fallo a medio cobro es lo que decide
 * si la cajera la vuelve a tomar. Contar pagos no basta: en una cuenta dividida, las partes ya
 * cobradas tienen pago y la que falló no (la mesa 19 del día 1 se quedó con su parte 3 sin cobrar).
 */
export async function quedaPorCobrarEnLaMesa(ctx: ContextoDelBot, mesa: number): Promise<boolean> {
  const [fila] = await leerSql<{ n: string }>(
    ctx.entorno.baseUrl,
    `select count(*)::text as n from ordenes o join mesas m on m.id = o.mesa_id
      where m.numero::text = $1 and o.estado = 'cuenta_solicitada'`,
    [String(mesa)],
  );
  return num(fila?.n) > 0;
}

/**
 * Cuántas veces está cobrada una cuenta: lo pagado (venta) entre su total. Un mixto son dos filas de
 * pago y sigue siendo UN cobro; un cobro doble da 2. Acepta el id de la orden, su folio o, para las
 * de mesa, el id de la llegada con su mesa.
 */
export async function vecesCobrada(
  ctx: ContextoDelBot,
  cuenta: string,
  mesa: number | null = null,
): Promise<number> {
  const orden = ordenEnLaBase(ctx, cuenta, mesa);
  if (orden === null) return 0;
  const [fila] = await leerSql<{ veces: string }>(
    ctx.entorno.baseUrl,
    `select coalesce(round(sum(p.monto_centavos)::numeric / nullif(max(o.total_centavos), 0)), 0)::text as veces
       from ordenes o left join pagos p on p.orden_id = o.id and p.estado = 'confirmado'
      where ${orden.donde}`,
    [orden.valor],
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
  const pagos = await pagosConfirmados(ctx, cuenta.cuenta, cuenta.mesa);
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
