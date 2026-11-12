/**
 * DIVIDIR LA CUENTA EN LA CAJA Y COBRAR CADA PARTE. La mesa pide «cuentas separadas» con la cuenta
 * sobre la mesa: la cajera abre el cobro, toca «Dividir», reparte las unidades (en partes iguales o
 * por renglón) y luego cobra cada parte por su nombre («Mesa 4 · cuenta 1 de 2»), a veces con
 * métodos distintos. Cada parte queda en el libro como UN cobro (con su folio) a nombre de la cuenta
 * madre, para que el árbitro de cajas y el de inventario sigan cuadrando.
 *
 * Lo que la cajera espera: cada parte vale lo que suman sus platillos (precios del libro) y las
 * partes juntas valen la cuenta. Si la pantalla dice otra cosa, es un incidente de dinero.
 */
import type { Locator, Page } from '@playwright/test';

import type { Bot, ContextoDelBot } from '../bot.ts';
import { contar, type CuentaPorCobrar } from '../mundo.ts';
import { abrirLaCuenta, totalEnPantalla, type Propina } from '../pantallas/caja.ts';
import {
  abrirLaDivision,
  confirmarLaDivision,
  leerLosRenglones,
  repartirUnidades,
  rotuloDeLaParte,
} from '../pantallas/caja-division.ts';
import { dinero } from '../pantallas/comun.ts';
import { cobrarEnElDialogo } from './caja-cobro.ts';
import { medido } from './comun.ts';
import {
  planearDivision,
  preciosPorUnidad,
  totalesDelReparto,
  type PlanDeDivision,
} from './division-reparto.ts';

const LUGAR = 'Caja → Dividir la cuenta';

/** Una cuenta ya dividida cuyas partes siguen cobrándose (si algo falla a medias se retoma donde iba). */
interface DivisionEnCurso {
  readonly plan: PlanDeDivision;
  readonly esperadas: readonly number[] | null;
  /** La próxima parte por cobrar (1, 2, …). */
  siguiente: number;
  /** Cuánto suman, en pantalla, las partes ya abiertas. */
  sumaEnPantalla: number;
  /** El efectivo neto que ya dejaron las partes cobradas. */
  efectivo: number;
  /** Cuántas veces se ha retomado tras un fallo. */
  retomada: number;
  /** Ya se registró que las partes ocultaron sus diálogos al lector de pantalla. */
  avisoDeAccesibilidad: boolean;
}

const MAXIMO_DE_REINTENTOS = 3;
const enCurso = new Map<string, DivisionEnCurso>();

/** Si la cuenta se dividió y le quedan partes, las cobra (devuelve el efectivo neto); si no, `null`. */
export async function reanudarLaDivision(
  ctx: ContextoDelBot,
  bot: Bot,
  pagina: Page,
  caja: string,
  cuenta: CuentaPorCobrar,
  propina: Propina,
): Promise<number | null> {
  const estado = enCurso.get(cuenta.cuenta);
  if (estado === undefined) return null;
  estado.retomada += 1;
  if (estado.retomada > MAXIMO_DE_REINTENTOS) {
    // Lo que falló ya quedó como incidente; seguir buscando una parte que no sale sólo atora la caja.
    enCurso.delete(cuenta.cuenta);
    await ctx.incidente(
      {
        pantalla: LUGAR,
        hizo: `Retomé ${String(MAXIMO_DE_REINTENTOS)} veces el cobro de las partes de la mesa ${String(cuenta.mesa)}`,
        esperaba: 'Cobrar todas las partes',
        paso: `Me quedé en la parte ${String(estado.siguiente)} de ${String(estado.plan.reparto.length)} y la dejo`,
        gravedad: 'alto',
        clase: 'prueba',
        reproducido: 'no intentado',
      },
      pagina,
    );
    return estado.efectivo;
  }
  return cobrarLasPartes(ctx, bot, pagina, caja, cuenta, propina, estado);
}

/** ¿Se puede dividir? «Dividir» se apaga con menos de dos unidades por repartir. */
export async function sePuedeDividir(cobro: Locator): Promise<boolean> {
  return cobro.getByRole('button', { name: /^Dividir\b/ }).isEnabled();
}

/**
 * Con el cobro de la cuenta madre abierto: divide, cobra cada parte y devuelve el efectivo neto que
 * entró al cajón. `null` si la cuenta no tenía qué dividir (el cobro madre sigue abierto).
 */
export async function dividirYCobrar(
  ctx: ContextoDelBot,
  bot: Bot,
  pagina: Page,
  caja: string,
  cobro: Locator,
  cuenta: CuentaPorCobrar,
  propina: Propina,
): Promise<number | null> {
  if (cuenta.mesa === null || !(await sePuedeDividir(cobro))) return null;
  const dialogo = await abrirLaDivision(pagina, cobro);
  const renglones = await leerLosRenglones(dialogo);
  const plan = planearDivision(
    renglones.map((r) => r.unidades),
    ctx.azar,
  );
  if (plan === null) {
    await pagina.keyboard.press('Escape');
    return null;
  }
  const partes = plan.reparto.length;
  const nombres = renglones.map((r) => r.nombre);
  const esperadas = totalesDelReparto(
    plan.reparto,
    nombres,
    preciosPorUnidad(ctx.libro.leer(), cuenta.cuenta),
  );
  // Si los precios del libro no suman la cuenta, la cajera no puede fiarse de ellos (cancelaciones, quitados).
  const confiable =
    esperadas !== null && esperadas.reduce((s, x) => s + x, 0) === cuenta.esperadoCentavos;
  await repartirUnidades(dialogo, renglones, plan.reparto);
  await medido(ctx, { bot, pantalla: LUGAR }, pagina, `dividir en ${String(partes)} cuentas`, () =>
    confirmarLaDivision(pagina, dialogo, partes),
  );
  contar(ctx.mundo, 'divisiones');
  const estado: DivisionEnCurso = {
    plan,
    esperadas: confiable ? esperadas : null,
    siguiente: 1,
    sumaEnPantalla: 0,
    efectivo: 0,
    retomada: 0,
    avisoDeAccesibilidad: false,
  };
  enCurso.set(cuenta.cuenta, estado);
  return cobrarLasPartes(ctx, bot, pagina, caja, cuenta, propina, estado);
}

/** La propina que sale de una venta con el porcentaje elegido (a la mitad, hacia arriba); 0 sin propina. */
function propinaDe(venta: number, propina: Propina): number {
  return propina === 'Sin propina' ? 0 : Math.round((venta * propina) / 100);
}

/** Cuánto es la venta cuando la pantalla dice `total` (venta + propina), si el reparto no dejó calcularla de antemano. */
function ventaSegunLaPantalla(total: number, propina: Propina): number {
  const aprox = propina === 'Sin propina' ? total : Math.round((total * 100) / (100 + propina));
  for (const v of [aprox, aprox - 1, aprox + 1]) if (v + propinaDe(v, propina) === total) return v;
  return aprox;
}

async function cobrarLasPartes(
  ctx: ContextoDelBot,
  bot: Bot,
  pagina: Page,
  caja: string,
  cuenta: CuentaPorCobrar,
  propina: Propina,
  estado: DivisionEnCurso,
): Promise<number> {
  const mesa = cuenta.mesa ?? 0;
  const { plan } = estado;
  const partes = plan.reparto.length;
  for (; estado.siguiente <= partes; estado.siguiente += 1) {
    const n = estado.siguiente;
    const titulo = `Mesa ${String(mesa)} · cuenta ${String(n)} de ${String(partes)}`;
    const alOcultarse = (): void => {
      if (estado.avisoDeAccesibilidad) return;
      estado.avisoDeAccesibilidad = true;
      void ctx.incidente(
        {
          pantalla: 'Caja → Pendientes → parte de una cuenta dividida',
          hizo: `Abrí «${titulo}» desde Pendientes`,
          esperaba:
            'La pregunta de la propina y el cobro se alcanzan por rol (dialog, button), como en una cuenta entera',
          paso: 'El cobro y la pregunta de la propina se abrieron a la vez y los dos quedaron con aria-hidden="true": «Sin propina» y «Aplicar» no existen en el árbol de accesibilidad',
          gravedad: 'medio',
          clase: 'ux',
          reproducido: '3/3',
        },
        pagina,
      );
    };
    const parte = await medido(
      ctx,
      { bot, pantalla: 'Caja → Pendientes' },
      pagina,
      'abrir una parte de la cuenta dividida',
      () =>
        abrirLaCuenta(
          pagina,
          rotuloDeLaParte(mesa, n, partes),
          titulo,
          propina,
          rotuloDeLaParte(mesa, n, partes),
          alOcultarse,
        ),
    );
    // La parte nace sin propina: la que la cajera eligió al abrirla se suma al «TOTAL A COBRAR».
    const enPantalla = await totalEnPantalla(parte);
    const venta = estado.esperadas?.[n - 1] ?? ventaSegunLaPantalla(enPantalla, propina);
    estado.efectivo += await cobrarEnElDialogo(ctx, bot, pagina, caja, parte, {
      cuenta: cuenta.cuenta,
      canal: 'mesa',
      esperadoCentavos: venta,
      rotulo: `la parte ${titulo}`,
      propinaAcordadaCentavos: propinaDe(venta, propina),
    });
    estado.sumaEnPantalla += venta;
  }
  enCurso.delete(cuenta.cuenta);
  if (estado.sumaEnPantalla !== cuenta.esperadoCentavos) {
    await ctx.incidente(
      {
        pantalla: LUGAR,
        hizo: `Dividí la cuenta de la mesa ${String(mesa)} en ${String(partes)} (${plan.modo}) y abrí cada parte`,
        esperaba: `Las partes suman ${dinero(cuenta.esperadoCentavos)}, lo que valía la cuenta`,
        paso: `Las partes suman ${dinero(estado.sumaEnPantalla)} en pantalla`,
        gravedad: 'critico',
        clase: 'dinero',
        reproducido: 'no intentado',
      },
      pagina,
    );
  }
  ctx.libro.anotar(bot.nombre, {
    tipo: 'cambio_en_vivo',
    que: `cuenta dividida · mesa ${String(mesa)}`,
    antes: `1 cuenta de ${dinero(cuenta.esperadoCentavos)}`,
    despues: `${String(partes)} partes (${plan.modo}) cobradas por separado`,
  });
  return estado.efectivo;
}
