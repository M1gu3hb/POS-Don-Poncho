/**
 * LA CAJERA (2 cajas: PC 1920 y tableta 1024): abre con fondo, cobra lo que los meseros piden (todos
 * los métodos y mixto, propinas, descuentos con PIN), arma y cobra pedidos para llevar, registra
 * retiros (algunos de más de $500 con el PIN de la gerente) y entradas de cambio, se traslada de
 * aparato a media jornada y al final cierra la caja contando con faltante, sobrante o justo.
 * Todo lo que hace lo anota en el libro; el árbitro lo compara contra el sistema.
 */
import type { Page } from '@playwright/test';

import type { NombreDeAparato } from '../aparatos.ts';
import type { Bot, ContextoDelBot } from '../bot.ts';
import { pinVigente } from '../entorno.ts';
import { contar } from '../mundo.ts';
import { abrirCaja, estadoDeLaCaja, irACaja, traerLaCaja } from '../pantallas/caja.ts';
import { cierreDeLaCaja } from '../pantallas/corte.ts';
import { entradaDeCambio, irAMovimientos, retirar } from '../pantallas/movimientos.ts';
import { entregarLoListo, pendientesParaLlevar } from '../pantallas/para-llevar.ts';
import { esperarAlguno } from '../pantallas/comun.ts';
import { abrirSesion, GERENTE, medido, registrarFallo } from './comun.ts';
import {
  caosParaLaCuenta,
  pagosConfirmados,
  paginasDeCaja,
  pausaDeCaos,
  type TipoDeCaos,
} from './caos-cobro.ts';
import { RITMO_POR_OMISION, type RitmoDeCaja } from './caja-descuento.ts';
import { dividirYCobrar, reanudarLaDivision } from './caja-division.ts';
import {
  cajonVacio,
  cobrarLaCuenta,
  cobrarParaLlevar,
  esperadoDelCajon,
  type CajonDelLibro,
} from './caja-cobro.ts';

export interface PlanDeCaja {
  /** El nombre en el libro: «Caja 1», «Caja 2». */
  readonly caja: string;
  /** La persona que cobra (su PIN de prueba). */
  readonly persona: string;
  readonly aparato: NombreDeAparato;
  /** A media jornada la caja pasa a este otro aparato («Trasladar aquí»). */
  readonly traslado?: { readonly aparato: NombreDeAparato; readonly enMinuto: number };
  readonly fondoCentavos: number;
  /** Minutos simulados desde la apertura → monto. Los de más de $500 piden el PIN de la gerente. */
  readonly retiros: readonly {
    readonly enMinuto: number;
    readonly centavos: number;
    readonly aDondeVa: string;
  }[];
  readonly entradas: readonly { readonly enMinuto: number; readonly centavos: number }[];
  /** Lo que cuenta al cerrar frente a lo esperado: justo, faltante (−$30) o sobrante (+$45). */
  readonly alCerrar: 'justo' | 'faltante' | 'sobrante';
  /** Cuántas cajas tienen que haber cerrado antes de cerrar ésta (0 = la primera). */
  readonly cierraDespuesDe?: number;
  /** Probabilidad (por vuelta sin cuentas) de armar un pedido para llevar. */
  readonly paraLlevar: number;
  /** Con qué frecuencia divide cuentas y da descuentos (con PIN y el intento sin PIN). Lo que falte vale lo de `RITMO_POR_OMISION`. */
  readonly ritmo?: Partial<RitmoDeCaja>;
  /** El caos de esta cajera: a la cuenta número N le toca recargar, cerrar la pestaña, red caída o doble toque. */
  readonly caos?: readonly { readonly cuentaNumero: number; readonly tipo: TipoDeCaos }[];
}

/** Cuánto tiempo real puede tardar una caja en cobrar lo pendiente antes de cerrar. */
const VACIAR_MS = 4 * 60_000;
const DIFERENCIA = { justo: 0, faltante: -3000, sobrante: 4500 } as const;
const CATALOGO_LLEVAR = [
  { producto: 'Taco de prueba', precioCentavos: 3500, estacion: 'cocina' },
  { producto: 'Agua fresca de prueba', precioCentavos: 3000, estacion: 'barra' },
] as const;

export function crearBotCaja(plan: PlanDeCaja): Bot {
  const bot: Bot = {
    nombre: plan.caja,
    rol: 'caja',
    aparato: plan.aparato,
    async correr(ctx) {
      await jornada(ctx, bot, plan);
    },
  };
  return bot;
}

async function jornada(ctx: ContextoDelBot, bot: Bot, plan: PlanDeCaja): Promise<void> {
  const lugar = { bot, pantalla: 'Caja' };
  let sesion = await abrirSesion(ctx, plan.persona, plan.aparato);
  let pagina = sesion.pagina;
  await irACaja(pagina, ctx.entorno.appUrl);
  if ((await estadoDeLaCaja(pagina)) !== 'abierta') {
    await medido(ctx, lugar, pagina, 'abrir la caja', () =>
      abrirCaja(pagina, plan.fondoCentavos, 'Fondo de la mañana'),
    );
  }
  ctx.libro.anotar(bot.nombre, {
    tipo: 'apertura',
    caja: plan.caja,
    contadoCentavos: plan.fondoCentavos,
  });
  const cajon: CajonDelLibro = cajonVacio(plan.fondoCentavos);
  const apertura = ctx.ahoraSim().getTime();
  const hechos = { retiros: 0, entradas: 0, trasladada: false, cuentas: 0 };
  const ritmo: RitmoDeCaja = { ...RITMO_POR_OMISION, ...plan.ritmo };

  /** Toma la siguiente cuenta pedida y la cobra. Si falla, la suelta (o la da por cobrada si la base ya la tiene). */
  const cobrarLaSiguiente = async (): Promise<boolean> => {
    const cuenta = ctx.mundo.porCobrar.find((c) => c.cobrandola === null);
    if (cuenta === undefined) return false;
    cuenta.cobrandola = plan.caja;
    try {
      await irACaja(pagina, ctx.entorno.appUrl);
      hechos.cuentas += 1;
      const tipo = caosParaLaCuenta(plan.caos ?? [], hechos.cuentas);
      const hecho = await cobrarLaCuenta(
        ctx,
        bot,
        pagina,
        plan.caja,
        cuenta,
        tipo === undefined ? undefined : { tipo, contexto: sesion.contexto },
        ritmo,
        {
          alAbrir: (cobro, propina) =>
            dividirYCobrar(ctx, bot, pagina, plan.caja, cobro, cuenta, propina),
          reanudar: (propina) => reanudarLaDivision(ctx, bot, pagina, plan.caja, cuenta, propina),
        },
      );
      pagina = hecho.pagina;
      cajon.efectivoNetoCentavos += hecho.efectivo;
      ctx.mundo.porCobrar.splice(ctx.mundo.porCobrar.indexOf(cuenta), 1);
    } catch (error: unknown) {
      await registrarFallo(
        ctx,
        lugar,
        pagina,
        `Cobrar la cuenta de la mesa ${String(cuenta.mesa)}`,
        'La cuenta queda cobrada una vez',
        error,
      );
      // Si la consulta misma falla, la cuenta vuelve a la fila: nunca se queda «cobrándose» para siempre.
      const pagos = await pagosConfirmados(ctx, cuenta.cuenta).catch(() => 0);
      if (pagos > 0) ctx.mundo.porCobrar.splice(ctx.mundo.porCobrar.indexOf(cuenta), 1);
      else cuenta.cobrandola = null;
    }
    return true;
  };

  /** «Entregado» a lo que la cocina dejó listo para llevar; si falla, queda como incidente. */
  const entregarLoQueEstaListo = async (): Promise<void> => {
    try {
      if (new URL(pagina.url()).pathname !== '/caja') await irACaja(pagina, ctx.entorno.appUrl);
      await entregarLoListo(pagina);
    } catch (error: unknown) {
      await registrarFallo(
        ctx,
        { bot, pantalla: 'Caja → Para llevar' },
        pagina,
        'Marcar «Entregado» un pedido para llevar listo',
        'El pedido pasa a entregado',
        error,
      );
    }
  };

  while (!ctx.terminado()) {
    // Si la página se cerró (un traslado o un caos a medias), la cajera vuelve a entrar en su aparato
    // y se trae la caja: sin esto, el bucle seguía usando una página muerta todo el día.
    if (pagina.isClosed()) {
      const aparato =
        hechos.trasladada && plan.traslado !== undefined ? plan.traslado.aparato : plan.aparato;
      try {
        sesion = await trasladar(ctx, bot, plan, sesion.contexto, aparato);
        pagina = sesion.pagina;
      } catch (error: unknown) {
        await registrarFallo(
          ctx,
          lugar,
          undefined,
          'Volver a entrar a la caja',
          'La caja vuelve a este aparato',
          error,
        );
        await ctx.esperarSim(5);
        continue;
      }
    }
    paginasDeCaja.set(plan.caja, pagina);
    if (pausaDeCaos.enCurso) {
      // La disputa de dos cajas sobre una cuenta necesita a las dos quietas un instante.
      pausaDeCaos.quietas += 1;
      // `enCurso` lo apaga el bot de caos desde otra tarea: TypeScript no ve ese cambio.
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      while (pausaDeCaos.enCurso && !ctx.terminado()) await ctx.esperarSim(0.25);
      pausaDeCaos.quietas -= 1;
      continue;
    }
    const minutos = (ctx.ahoraSim().getTime() - apertura) / 60_000;
    try {
      if (plan.traslado !== undefined && !hechos.trasladada && minutos >= plan.traslado.enMinuto) {
        hechos.trasladada = true; // se intenta una sola vez: a medias nunca se repite
        sesion = await trasladar(ctx, bot, plan, sesion.contexto, plan.traslado.aparato);
        pagina = sesion.pagina;
        hechos.trasladada = true;
        continue;
      }
      await movimientos(ctx, bot, plan, pagina, cajon, minutos, hechos);
      if (await cobrarLaSiguiente()) continue;
      // En cada vuelta ociosa se entrega lo que la cocina ya dejó listo para llevar (el cierre no deja pedidos sin entregar).
      await entregarLoQueEstaListo();
      if (ctx.azar.probabilidad(plan.paraLlevar)) {
        await irACaja(pagina, ctx.entorno.appUrl);
        const r = ctx.azar.elegir(CATALOGO_LLEVAR);
        cajon.efectivoNetoCentavos += await cobrarParaLlevar(
          ctx,
          bot,
          pagina,
          plan.caja,
          [{ ...r, veces: ctx.azar.entero(1, 3) }],
          ritmo,
        );
      } else {
        await ctx.esperarSim(1);
      }
    } catch (error: unknown) {
      await registrarFallo(
        ctx,
        lugar,
        pagina,
        'Un paso de la caja',
        'El paso termina sin error',
        error,
      );
      await ctx.esperarSim(1);
    }
  }
  // Antes de cerrar la caja cobra lo que ya estaba pedido: una mesa con la cuenta pedida no deja cerrar.
  const limite = Date.now() + VACIAR_MS;
  while (Date.now() < limite && (await cobrarLaSiguiente())) continue;
  await cerrar(ctx, bot, plan, pagina, cajon);
  await sesion.contexto.close();
}

async function movimientos(
  ctx: ContextoDelBot,
  bot: Bot,
  plan: PlanDeCaja,
  pagina: Page,
  cajon: CajonDelLibro,
  minutos: number,
  hechos: { retiros: number; entradas: number },
): Promise<void> {
  const retiro = plan.retiros[hechos.retiros];
  if (retiro !== undefined && minutos >= retiro.enMinuto) {
    // Se cuenta como hecho ANTES de intentarlo: si falla a medias nunca se repite (duplicaría el retiro).
    hechos.retiros += 1;
    await irACaja(pagina, ctx.entorno.appUrl);
    await irAMovimientos(pagina);
    const { pidioPin } = await medido(
      ctx,
      { bot, pantalla: 'Caja → Movimientos' },
      pagina,
      'registrar un retiro',
      () =>
        retirar(pagina, {
          centavos: retiro.centavos,
          aDondeVa: retiro.aDondeVa,
          autoriza: { nombre: GERENTE, pin: pinVigente(ctx.entorno, GERENTE) },
        }),
    );
    cajon.retirosCentavos += retiro.centavos;
    ctx.libro.anotar(bot.nombre, {
      tipo: 'retiro',
      caja: plan.caja,
      centavos: retiro.centavos,
      conPin: pidioPin,
      motivo: retiro.aDondeVa,
    });
  }
  const entrada = plan.entradas[hechos.entradas];
  if (entrada !== undefined && minutos >= entrada.enMinuto) {
    hechos.entradas += 1;
    await irACaja(pagina, ctx.entorno.appUrl);
    await irAMovimientos(pagina);
    await medido(
      ctx,
      { bot, pantalla: 'Caja → Movimientos' },
      pagina,
      'registrar una entrada de cambio',
      () => entradaDeCambio(pagina, entrada.centavos, 'De la caja chica', 'cambio en monedas'),
    );
    cajon.entradasCentavos += entrada.centavos;
    ctx.libro.anotar(bot.nombre, {
      tipo: 'entrada',
      caja: plan.caja,
      centavos: entrada.centavos,
      conPin: false,
      motivo: 'cambio en monedas',
    });
  }
}

/** El traslado: se cierra el aparato viejo y la misma cajera, en el nuevo, trae la caja («Trasladar aquí»). */
async function trasladar(
  ctx: ContextoDelBot,
  bot: Bot,
  plan: PlanDeCaja,
  viejo: { close(): Promise<void> },
  aparato: NombreDeAparato,
) {
  await viejo.close();
  const nuevo = await abrirSesion(ctx, plan.persona, aparato);
  await irACaja(nuevo.pagina, ctx.entorno.appUrl);
  // En el aparato nuevo la pantalla ofrece «Trasladar aquí» o ya enseña la caja abierta: se espera a una de las dos.
  const traer = nuevo.pagina.getByRole('button', { name: 'Trasladar aquí' });
  const aqui = nuevo.pagina.getByText(/^Caja abierta desde/);
  const cual = await esperarAlguno(nuevo.pagina, [traer, aqui], 45_000);
  if (cual === 0) {
    await medido(
      ctx,
      { bot, pantalla: 'Caja → Traer' },
      nuevo.pagina,
      'traer la caja a este aparato',
      () => traerLaCaja(nuevo.pagina, plan.persona),
    );
  }
  ctx.libro.anotar(bot.nombre, { tipo: 'traslado', caja: plan.caja, de: plan.aparato, a: aparato });
  return nuevo;
}

/** Entrega lo para llevar que la cocina va dejando listo, hasta que no quede nada o pasen `minutos` reales. */
async function entregarTodo(ctx: ContextoDelBot, pagina: Page, minutos: number): Promise<void> {
  await irACaja(pagina, ctx.entorno.appUrl);
  const limite = Date.now() + minutos * 60_000;
  while (Date.now() < limite) {
    await entregarLoListo(pagina);
    if ((await pendientesParaLlevar(pagina)) === 0) return;
    await new Promise((r) => setTimeout(r, 10_000));
  }
}

async function cerrar(
  ctx: ContextoDelBot,
  bot: Bot,
  plan: PlanDeCaja,
  pagina: Page,
  cajon: CajonDelLibro,
): Promise<void> {
  // La caja no cierra con pedidos para llevar cobrados sin entregar (regla de la app): antes de
  // contar, se entrega lo listo y se espera a que la cocina termine lo que falta (sigue trabajando
  // hasta que las cajas cierran).
  // Si la entrega previa falla (la pantalla no está como se espera), se registra y se intenta el
  // cierre igual: el servidor dirá si falta algo.
  await entregarTodo(ctx, pagina, 10).catch((error: unknown) =>
    registrarFallo(
      ctx,
      { bot, pantalla: 'Caja → Para llevar' },
      pagina,
      'Entregar lo para llevar antes de cerrar',
      'No queda nada sin entregar',
      error,
    ),
  );
  // Los cierres de caja van uno tras otro (dos a la vez no completaron en el ensayo): cada una espera su turno.
  const turno = plan.cierraDespuesDe ?? 0;
  const limite = Date.now() + 6 * 60_000;
  while ((ctx.mundo.volumen.get('cajas_cerradas') ?? 0) < turno && Date.now() < limite)
    await new Promise((r) => setTimeout(r, 1_000));
  const esperado = esperadoDelCajon(cajon);
  const contado = esperado + DIFERENCIA[plan.alCerrar];
  try {
    await irACaja(pagina, ctx.entorno.appUrl);
    const intento = () =>
      medido(ctx, { bot, pantalla: 'Caja → Cierre diario' }, pagina, 'cerrar la caja', () =>
        cierreDeLaCaja(pagina, contado),
      );
    // Si el servidor dice que aún hay pedidos sin entregar, la cajera lee el aviso, entrega lo que
    // falta y lo intenta otra vez (una sola).
    const r = await intento().catch(async (error: unknown) => {
      if (!String(error).includes('sin entregar')) throw error;
      await entregarTodo(ctx, pagina, 5);
      await irACaja(pagina, ctx.entorno.appUrl);
      return intento();
    });
    if (r.bloqueadoPorMesas) {
      await registrarFallo(
        ctx,
        { bot, pantalla: 'Caja → Cierre diario' },
        pagina,
        'Cerrar la caja',
        'Cierra (no quedan mesas abiertas)',
        'El sistema avisó de mesas pendientes',
      );
      return;
    }
    ctx.libro.anotar(bot.nombre, {
      tipo: 'corte',
      caja: plan.caja,
      contadoCentavos: contado,
      esperadoCentavos: esperado,
    });
  } catch (error: unknown) {
    await registrarFallo(
      ctx,
      { bot, pantalla: 'Caja → Cierre diario' },
      pagina,
      'Cerrar la caja y bajar el PDF del corte',
      'La caja queda cerrada y baja un PDF',
      error,
      'alto',
    );
  } finally {
    contar(ctx.mundo, 'cajas_cerradas');
  }
}
