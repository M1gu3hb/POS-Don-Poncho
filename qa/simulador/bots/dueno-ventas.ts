/**
 * EL DUEÑO REVISA EL HISTORIAL DE VENTAS Y SUS NOTAS (Registros → Ventas): para una muestra de lo
 * que se cobró en el día —con descuento, de cuentas divididas, para llevar y de mesa— comprueba que
 * la tarjeta de la venta exista con su total, que el filtro por canal la ponga donde va, y que el
 * ticket («Ver ticket») traiga el folio, el total, lo que se pidió y la nota del descuento.
 *
 * Lo que espera ver sale del libro (lo que los bots SABEN que cobraron), nunca de lo que diga el
 * sistema. Cada expectativa que se cumple queda anotada en el libro; la que no, es un incidente.
 */
import type { Page } from '@playwright/test';

import type { Bot, ContextoDelBot } from '../bot.ts';
import type { Asiento } from '../libro.ts';
import { dinero } from '../pantallas/comun.ts';
import {
  abrirPestana,
  filtrarVentas,
  irARegistros,
  textoDeLaVenta,
  textoDelTicket,
} from '../pantallas/registros.ts';
import { registrarFallo } from './comun.ts';

type Cobro = Extract<Asiento, { tipo: 'cobro' }>;

const MUESTRA = 12;
const TICKETS = 8;
const LUGAR = 'Registros → Ventas';

const delFolio = (c: Cobro): string => c.folio.trim().split('-').at(-1) ?? c.folio;

/** Una muestra con de todo: descuentos, partes de cuentas divididas, para llevar y de mesa. */
export function muestraDeCobros(cobros: readonly Cobro[]): readonly Cobro[] {
  const porCuenta = new Map<string, number>();
  for (const c of cobros) porCuenta.set(c.cuenta, (porCuenta.get(c.cuenta) ?? 0) + 1);
  const grupos: readonly (readonly Cobro[])[] = [
    cobros.filter((c) => c.descuentoCentavos > 0).slice(0, 4),
    cobros.filter((c) => (porCuenta.get(c.cuenta) ?? 0) > 1).slice(0, 4),
    cobros.filter((c) => c.canal === 'llevar').slice(0, 3),
    cobros.slice(0, MUESTRA),
  ];
  const elegidos = new Map<string, Cobro>();
  for (const c of grupos.flat()) if (elegidos.size < MUESTRA) elegidos.set(c.folio, c);
  return [...elegidos.values()];
}

async function revisarElCanal(ctx: ContextoDelBot, pagina: Page, c: Cobro): Promise<void> {
  const folio = delFolio(c);
  const suyo = c.canal === 'llevar' ? 'Para llevar' : 'Mesas';
  const ajeno = c.canal === 'llevar' ? 'Mesas' : 'Para llevar';
  await filtrarVentas(pagina, suyo);
  const enSuCanal = await textoDeLaVenta(pagina, folio);
  await filtrarVentas(pagina, ajeno);
  const enElOtro = await textoDeLaVenta(pagina, folio);
  await filtrarVentas(pagina, 'Todas');
  if (enSuCanal !== null && enElOtro === null) return;
  await ctx.incidente(
    {
      pantalla: LUGAR,
      hizo: `Filtré Registros → Ventas por «${suyo}» y por «${ajeno}» buscando el folio ${folio}`,
      esperaba: `El folio sólo sale en «${suyo}» (cobro ${c.canal === 'llevar' ? 'para llevar' : 'de mesa'})`,
      paso: `En «${suyo}» ${enSuCanal === null ? 'NO sale' : 'sale'}; en «${ajeno}» ${enElOtro === null ? 'no sale' : 'SALE'}`,
      gravedad: 'medio',
      clase: 'ui',
      reproducido: 'no intentado',
    },
    pagina,
  );
}

async function revisarElTicket(
  ctx: ContextoDelBot,
  pagina: Page,
  c: Cobro,
  productos: readonly string[],
): Promise<void> {
  const folio = delFolio(c);
  const ticket = await textoDelTicket(pagina, folio);
  const faltan: string[] = [];
  if (!ticket.includes(folio)) faltan.push(`el folio ${folio}`);
  const totales = [dinero(c.totalCentavos), dinero(c.totalCentavos + c.propinaCentavos)];
  if (!totales.some((t) => ticket.includes(t))) faltan.push(`el total ${totales[0] ?? ''}`);
  if (c.descuentoCentavos > 0 && !/descuento/i.test(ticket)) faltan.push('la línea del descuento');
  for (const p of productos) if (!ticket.includes(p)) faltan.push(`«${p}»`);
  if (faltan.length === 0) return;
  await ctx.incidente(
    {
      pantalla: `${LUGAR} → Ver ticket`,
      hizo: `Abrí el ticket del folio ${folio} (cobro de ${c.caja})`,
      esperaba: `El ticket trae ${[`el folio`, `el total`, ...(c.descuentoCentavos > 0 ? ['el descuento'] : []), ...(productos.length > 0 ? ['lo que se pidió'] : [])].join(', ')}`,
      paso: `Al ticket le falta: ${faltan.join(', ')}. Dice: «${ticket.slice(0, 160)}»`,
      gravedad: 'medio',
      clase: 'ui',
      reproducido: 'no intentado',
    },
    pagina,
  );
}

/** La revisión completa del historial de ventas. Cada paso que falla por la pantalla es un incidente, no un silencio. */
export async function revisarLasVentas(ctx: ContextoDelBot, bot: Bot, pagina: Page): Promise<void> {
  const libro = ctx.libro.leer();
  const cobros = libro.flatMap((f) => (f.asiento.tipo === 'cobro' ? [f.asiento] : []));
  const muestra = muestraDeCobros(cobros);
  if (muestra.length === 0) return;
  const cuentasConVarios = new Set(
    cobros
      .filter((c) => cobros.filter((x) => x.cuenta === c.cuenta).length > 1)
      .map((c) => c.cuenta),
  );
  try {
    await irARegistros(pagina, ctx.entorno.appUrl);
    await abrirPestana(pagina, 'Ventas');
  } catch (error: unknown) {
    await registrarFallo(
      ctx,
      { bot, pantalla: LUGAR },
      pagina,
      'Abrir Registros → Ventas',
      'Se ve el historial de ventas',
      error,
    );
    return;
  }
  let conTicket = 0;
  for (const c of muestra) {
    const folio = delFolio(c);
    try {
      await filtrarVentas(pagina, 'Todas');
      const tarjeta = await textoDeLaVenta(pagina, folio);
      const total = [dinero(c.totalCentavos), dinero(c.totalCentavos + c.propinaCentavos)];
      if (tarjeta === null || !total.some((t) => tarjeta.includes(t))) {
        await ctx.incidente(
          {
            pantalla: LUGAR,
            hizo: `Busqué en el historial de ventas el folio ${folio} que cobró ${c.caja}`,
            esperaba: `Aparece con total ${total[0] ?? ''}${c.descuentoCentavos > 0 ? ` (ya con su descuento de ${dinero(c.descuentoCentavos)})` : ''}`,
            paso:
              tarjeta === null
                ? 'No aparece en el historial'
                : `La tarjeta dice: «${tarjeta.slice(0, 160)}»`,
            gravedad: 'alto',
            clase: 'dinero',
            reproducido: 'no intentado',
          },
          pagina,
        );
        continue;
      }
      await revisarElCanal(ctx, pagina, c);
      if (conTicket < TICKETS) {
        conTicket += 1;
        const productos = cuentasConVarios.has(c.cuenta)
          ? []
          : [
              ...new Set(
                libro.flatMap((f) =>
                  f.asiento.tipo === 'linea' && f.asiento.cuenta === c.cuenta
                    ? [f.asiento.producto]
                    : [],
                ),
              ),
            ];
        await revisarElTicket(ctx, pagina, c, productos);
      }
      ctx.libro.anotar(bot.nombre, {
        tipo: 'cambio_en_vivo',
        que: `registros → ventas: folio ${folio}`,
        antes: `esperaba ${total[0] ?? ''}${c.descuentoCentavos > 0 ? ' con nota de descuento' : ''} en «${c.canal === 'llevar' ? 'Para llevar' : 'Mesas'}»`,
        despues: 'la tarjeta y, si se abrió, el ticket lo dicen',
      });
    } catch (error: unknown) {
      await registrarFallo(
        ctx,
        { bot, pantalla: LUGAR },
        pagina,
        `Revisar el folio ${folio} en Registros → Ventas`,
        'La tarjeta y el ticket se leen',
        error,
      );
    }
  }
}
