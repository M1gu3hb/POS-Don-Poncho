/**
 * DOS CAJAS COBRANDO LA MISMA CUENTA: con el cupo de 2 cajas las dos ven y cobran las mismas cuentas;
 * si las dos tocan «Cobrar» a la vez, entra UN solo cobro y la otra debe enterarse (no cobrar dos
 * veces). Este bot detiene un instante a las dos cajeras, abre la MISMA cuenta en las dos pantallas y
 * toca «Cobrar» en las dos al mismo tiempo. Cualquier resultado distinto de «uno cobra, otro avisa»
 * es un incidente crítico de concurrencia.
 */
import type { Page, Response } from '@playwright/test';

import type { Bot, ContextoDelBot } from '../bot.ts';
import { abrirLaCuenta, irACaja } from '../pantallas/caja.ts';
import { dinero } from '../pantallas/comun.ts';
import { registrarFallo } from './comun.ts';
import { vecesCobrada, pausaDeCaos, paginasDeCaja } from './caos-cobro.ts';

const CAJAS = ['Caja 1', 'Caja 2'] as const;
const ESPERA_A_LAS_CAJAS_MS = 90_000;
const ESPERA_A_UNA_CUENTA_MS = 120_000;

export interface PlanDeDisputa {
  readonly enMinuto: number;
}

async function esperarQue(condicion: () => boolean, ms: number): Promise<boolean> {
  const limite = Date.now() + ms;
  while (Date.now() < limite) {
    if (condicion()) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return condicion();
}

async function disputar(ctx: ContextoDelBot, bot: Bot): Promise<void> {
  const lugar = { bot, pantalla: 'Caja → Cobrar (dos cajas)' };
  const paginas = CAJAS.map((c) => paginasDeCaja.get(c));
  if (paginas.some((p) => p === undefined || p.isClosed())) return;
  const [uno, dos] = paginas as [Page, Page];
  pausaDeCaos.enCurso = true;
  let soltarSiFalla: (() => Promise<void>) | null = null;
  try {
    if (!(await esperarQue(() => pausaDeCaos.quietas >= CAJAS.length, ESPERA_A_LAS_CAJAS_MS)))
      return;
    // Con las cajeras quietas se espera a que el mesero pida una cuenta: la disputa necesita UNA sin dueño.
    await esperarQue(
      () => ctx.mundo.porCobrar.some((c) => c.cobrandola === null),
      ESPERA_A_UNA_CUENTA_MS,
    );
    const cuenta = ctx.mundo.porCobrar.find((c) => c.cobrandola === null);
    if (cuenta === undefined) return;
    cuenta.cobrandola = 'DISPUTA';
    // Si algo falla a medias la cuenta se SUELTA (o se da por cobrada si la base ya la tiene): sin esto
    // quedaría para siempre «pedida» y la mesa no dejaría cerrar el día.
    soltarSiFalla = async () => {
      if ((await vecesCobrada(ctx, cuenta.cuenta, cuenta.mesa)) > 0)
        ctx.mundo.porCobrar.splice(ctx.mundo.porCobrar.indexOf(cuenta), 1);
      else cuenta.cobrandola = null;
    };
    const titulo = `Mesa ${String(cuenta.mesa)}`;
    const rotulo = new RegExp(`Mesa ${String(cuenta.mesa)}\\b`);
    const respuestas: { caja: string; r: Response }[] = [];
    for (const [i, p] of [uno, dos].entries()) {
      p.on('response', (r) => {
        if (new URL(r.url()).pathname === '/api/venta/cobrar' && r.request().method() === 'POST')
          respuestas.push({ caja: CAJAS[i] ?? '', r });
      });
      await irACaja(p, ctx.entorno.appUrl);
    }
    const cobros = await Promise.all(
      [uno, dos].map((p) => abrirLaCuenta(p, rotulo, titulo, 'Sin propina')),
    );
    await Promise.all(
      cobros.map((c) => c.getByRole('button', { name: 'Tarjeta', exact: true }).click()),
    );
    await Promise.all(cobros.map((c) => c.getByRole('button', { name: /^Cobrar \$/ }).click()));
    await esperarQue(() => respuestas.length >= 2, 30_000);
    const cuerpos = await Promise.all(
      respuestas.map(async ({ caja, r }) => ({
        caja,
        estado: r.status(),
        json: (await r.json()) as {
          ok?: boolean;
          datos?: { folio: string; totalCentavos: string };
          error?: { mensaje?: string };
        },
      })),
    );
    const buenos = cuerpos.filter((c) => c.estado === 200 && c.json.ok !== false);
    // La cuenta se busca por el folio que devolvió el cobro que ganó (el libro aún no lo tiene: se
    // anota abajo); sin ganador, por la última orden de la mesa. Puede tardar un instante en verse
    // en la base: se le dan hasta 15 s antes de decir que no está.
    const folioGanador = buenos[0]?.json.datos?.folio;
    const contar = () =>
      folioGanador === undefined || folioGanador === ''
        ? vecesCobrada(ctx, cuenta.cuenta, cuenta.mesa)
        : vecesCobrada(ctx, folioGanador);
    let pagos = await contar();
    const limitePagos = Date.now() + 15_000;
    while (buenos.length > 0 && pagos === 0 && Date.now() < limitePagos) {
      await new Promise((r) => setTimeout(r, 500));
      pagos = await contar();
    }
    if (buenos.length !== 1 || pagos !== 1) {
      await ctx.incidente(
        {
          pantalla: lugar.pantalla,
          hizo: `Las dos cajas tocaron «Cobrar» a la vez en la cuenta de la ${titulo}`,
          esperaba: 'Entra un solo cobro y la otra caja se entera',
          paso: `Respuestas ${cuerpos.map((c) => String(c.estado)).join(' y ')}; pagos confirmados en la base: ${String(pagos)}`,
          gravedad: 'critico',
          clase: 'concurrencia',
          reproducido: 'no intentado',
        },
        uno,
      );
    } else {
      const ganador = buenos[0]?.json.datos;
      const avisoDelOtro =
        cuerpos.find((c) => c.estado !== 200)?.json.error?.mensaje ?? '(sin mensaje)';
      if (avisoDelOtro === '(sin mensaje)') {
        await ctx.incidente(
          {
            pantalla: lugar.pantalla,
            hizo: `Las dos cajas tocaron «Cobrar» a la vez en la cuenta de la ${titulo}`,
            esperaba: 'La caja que no cobró recibe un aviso claro (por qué no se cobró)',
            paso: 'El servidor la rechazó sin ningún mensaje',
            gravedad: 'medio',
            clase: 'ux',
            reproducido: 'no intentado',
          },
          uno,
        );
      }
      ctx.libro.anotar(bot.nombre, {
        tipo: 'cobro',
        caja: buenos[0]?.caja ?? 'Caja 1',
        cuenta: cuenta.cuenta,
        folio: ganador?.folio ?? '',
        canal: 'mesa',
        totalCentavos: cuenta.esperadoCentavos,
        propinaCentavos: cuenta.propinaCentavos ?? 0,
        descuentoCentavos: 0,
        pagos: { efectivo: 0, tarjeta: cuenta.esperadoCentavos, transferencia: 0 },
        cambioCentavos: 0,
      });
      ctx.libro.anotar(bot.nombre, {
        tipo: 'cambio_en_vivo',
        que: 'dos cajas sobre la misma cuenta',
        antes: `${dinero(cuenta.esperadoCentavos)} en las dos pantallas`,
        despues: `un cobro; la otra caja: ${avisoDelOtro.slice(0, 100)}`,
      });
    }
    ctx.mundo.porCobrar.splice(ctx.mundo.porCobrar.indexOf(cuenta), 1);
    for (const p of [uno, dos]) {
      await p.keyboard.press('Escape').catch((error: unknown) => {
        process.stderr.write(`(Escape tras la disputa: ${String(error).slice(0, 100)})\n`);
      });
    }
  } catch (error: unknown) {
    if (soltarSiFalla !== null) await soltarSiFalla();
    throw error;
  } finally {
    pausaDeCaos.enCurso = false;
  }
}

export function crearBotDisputa(plan: PlanDeDisputa): Bot {
  const bot: Bot = {
    nombre: 'Caos · dos cajas',
    rol: 'caos',
    aparato: 'pc-1920',
    async correr(ctx) {
      const inicio = ctx.ahoraSim().getTime();
      while (!ctx.terminado() && (ctx.ahoraSim().getTime() - inicio) / 60_000 < plan.enMinuto)
        await ctx.esperarSim(1);
      // Hasta tres intentos: hace falta que las dos cajas estén abiertas y haya una cuenta sin dueño.
      for (let intento = 0; intento < 3 && !ctx.terminado(); intento += 1) {
        const antes = ctx.mundo.porCobrar.length;
        try {
          await disputar(ctx, bot);
        } catch (error: unknown) {
          await registrarFallo(
            ctx,
            { bot, pantalla: 'Caja → Cobrar (dos cajas)' },
            undefined,
            'Disputar una cuenta entre las dos cajas',
            'Termina con un solo cobro',
            error,
          );
        }
        if (ctx.mundo.porCobrar.length < antes) return;
        await ctx.esperarSim(3);
      }
    },
  };
  return bot;
}
