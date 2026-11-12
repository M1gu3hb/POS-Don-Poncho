/**
 * EL MESERO: un bot por mesero, en su teléfono (Android 360, Android 412 o iPhone). Mira SUS mesas
 * en la pantalla, toma las llegadas sin QR, pide por rondas, recoge lo listo, pide la cuenta, quita
 * platillos y, de vez en cuando, cambia de mesa o une dos para un grupo grande. Atiende además lo que
 * piden los teléfonos de la mesa (portal del QR) y «Llamar a mi mesero».
 *
 * Todo lo que sabe que hizo queda en el libro; lo que sale mal, en incidentes.
 */
import type { Page } from '@playwright/test';

import type { Bot, ContextoDelBot } from '../bot.ts';
import type { NombreDeAparato } from '../aparatos.ts';
import { minutoDelDia } from '../horario.ts';
import { contar, type Llegada } from '../mundo.ts';
import { planearRonda } from '../pedido.ts';
import { asegurarSesion, despertar, entrarOFallar } from '../sesion.ts';
import { ESPERA_MS, intentar, recuperar, traza, vigilarServidor } from './ayudas.ts';
import {
  atenderAyuda,
  cambiarDeMesa,
  dejarLimpia,
  pedirLaCuenta,
  quitarPlatillo,
  solicitudesPendientes,
  unirMesas,
  type Propina,
} from './mesero-cuenta.ts';
import {
  atenderPortal,
  cuentasQueMePidenEnPersona,
  soltarMesasDelPortal,
} from './mesero-portal.ts';
import {
  abrirMesa,
  alMapa,
  entregarListos,
  hayListoParaRecoger,
  mesasEnPantalla,
  type MesaEnPantalla,
} from './mesero-ui.ts';
import { pedirRonda, subtotalDe, type CuentaDelMesero } from './mesero-ronda.ts';

export interface ConfigDelMesero {
  readonly numero: number;
  readonly persona: string;
  readonly aparato: NombreDeAparato;
  /** Quién autoriza lo que pide PIN (el gerente de prueba). */
  readonly quienAutoriza: string;
}

const MAX_CUENTAS = 3;
const ESPERANDO_COCINA = new Set(['Pedido enviado', 'En preparación', 'Esperando entrega']);

function propinaAlAzar(ctx: ContextoDelBot): { propina: Propina; porcentaje: number } {
  const p = ctx.azar.real();
  if (p < 0.65) return { propina: 'caja', porcentaje: 0 };
  if (p < 0.77) return { propina: 'sin', porcentaje: 0 };
  return p < 0.89 ? { propina: 10, porcentaje: 10 } : { propina: 15, porcentaje: 15 };
}

class Mesero {
  readonly cuentas: CuentaDelMesero[] = [];
  readonly ctx: ContextoDelBot;
  readonly cfg: ConfigDelMesero;
  readonly pagina: Page;
  constructor(ctx: ContextoDelBot, cfg: ConfigDelMesero, pagina: Page) {
    this.ctx = ctx;
    this.cfg = cfg;
    this.pagina = pagina;
  }

  private base(pantalla: string) {
    return { bot: this.cfg.persona, pantalla };
  }

  private librar(c: CuentaDelMesero): void {
    for (const [mesa, quien] of [...this.ctx.mundo.atendidas])
      if (quien === c.cuenta || quien === `${c.cuenta}+`) this.ctx.mundo.atendidas.delete(mesa);
    this.cuentas.splice(this.cuentas.indexOf(c), 1);
  }

  /** Toma una llegada sin QR si hay lugar: abre la mesa, pide la primera ronda y, si son muchos, une otra. */
  async tomarLlegada(mesas: readonly MesaEnPantalla[], ahoraMin: number): Promise<void> {
    const { ctx } = this;
    if (this.cuentas.length >= MAX_CUENTAS) return;
    const libres = mesas.filter((m) => m.estado === 'Libre' && !ctx.mundo.atendidas.has(m.numero));
    const idx = ctx.mundo.llegadas.findIndex((l) => !l.usaQr && l.horaSim <= ahoraMin);
    const mesa = libres[0];
    if (idx === -1 || mesa === undefined) return;
    const [llegada] = ctx.mundo.llegadas.splice(idx, 1) as [Llegada];
    ctx.mundo.atendidas.set(mesa.numero, llegada.id);
    const alergia = ctx.azar.probabilidad(0.1) ? 'alérgico a los cacahuates' : '';
    const abierta = await intentar(
      ctx,
      this.pagina,
      {
        ...this.base(`Mesero · mesa ${String(mesa.numero)}`),
        hizo: `Abrir la mesa ${String(mesa.numero)} para ${String(llegada.personas)}`,
        esperaba: 'La mesa queda abierta con su cuenta.',
        paso: 'abrir mesa',
      },
      () =>
        abrirMesa(this.pagina, mesa.numero, llegada.personas, {
          celebracion: llegada.celebracion,
          alergia,
        }),
    );
    if (!abierta) {
      ctx.mundo.atendidas.delete(mesa.numero);
      await recuperar(this.pagina, ctx.entorno.appUrl, '/mesero');
      return;
    }
    contar(ctx.mundo, 'cuentas_de_mesa');
    const cuenta: CuentaDelMesero = {
      cuenta: llegada.id,
      mesa: mesa.numero,
      personas: llegada.personas,
      rondas: llegada.rondas,
      pedirCuentaEn: ahoraMin + llegada.minutosEnLaMesa,
      enviadas: [],
      quitadas: 0,
      ronda: 0,
      proximaRondaEn: ahoraMin,
      fase: 'abierta',
      llegoEnPortal: false,
      unida: false,
      movida: false,
    };
    this.cuentas.push(cuenta);
    await this.siguienteRonda(cuenta, ahoraMin);
  }

  async siguienteRonda(c: CuentaDelMesero, ahoraMin: number): Promise<void> {
    const { ctx } = this;
    const lineas = planearRonda(ctx.azar, ctx.mundo, c.personas);
    const ok = await pedirRonda(ctx, this.pagina, this.cfg.persona, c, lineas);
    c.proximaRondaEn =
      ahoraMin +
      Math.max(
        8,
        Math.floor(((c.pedirCuentaEn - ahoraMin) / Math.max(1, c.rondas - c.ronda)) * 0.8),
      );
    if (!ok) await recuperar(this.pagina, ctx.entorno.appUrl, '/mesero');
    else if (c.ronda === 1) await this.cosasRaras(c);
  }

  /** Quitar un platillo, cambiar de mesa: lo que a veces pasa después del primer pedido. */
  private async cosasRaras(c: CuentaDelMesero): Promise<void> {
    const { ctx } = this;
    const unico = c.enviadas.find(
      (l) =>
        l.cantidad === 1 && c.enviadas.filter((o) => o.producto.id === l.producto.id).length === 1,
    );
    if (unico !== undefined && c.enviadas.length >= 2 && ctx.azar.probabilidad(0.15)) {
      const ok = await intentar(
        ctx,
        this.pagina,
        {
          ...this.base(`Mesero · mesa ${String(c.mesa)}`),
          hizo: `Quitar ${unico.producto.nombre}`,
          esperaba: 'El platillo sale de la cuenta con su motivo.',
          paso: 'quitar platillo',
        },
        async () => {
          await quitarPlatillo(
            this.pagina,
            c.mesa,
            unico.producto.nombre,
            'Me equivoqué al tomar la orden',
            null,
          );
        },
      );
      if (ok) {
        c.quitadas += unico.importeCentavos;
        ctx.libro.anotar(this.cfg.persona, {
          tipo: 'cancelacion',
          cuenta: c.cuenta,
          producto: unico.producto.nombre,
          importeCentavos: unico.importeCentavos,
          motivo: 'Me equivoqué al tomar la orden',
        });
        contar(ctx.mundo, 'cancelaciones');
      } else await recuperar(this.pagina, ctx.entorno.appUrl, '/mesero');
    }
  }

  async cuentaDeMesa(c: CuentaDelMesero, ahoraMin: number): Promise<void> {
    const { ctx } = this;
    const { propina, porcentaje } = propinaAlAzar(ctx);
    // Se asigna dentro de `intentar`: con el `as`, TypeScript no la da por `null` para siempre.
    let leida = null as Awaited<ReturnType<typeof pedirLaCuenta>> | null;
    const ok = await intentar(
      ctx,
      this.pagina,
      {
        ...this.base(`Mesero · mesa ${String(c.mesa)}`),
        hizo: 'Solicitar cuenta',
        esperaba: 'La pre-cuenta con su código de caja y el total.',
        paso: 'pedir la cuenta',
      },
      async () => {
        leida = await pedirLaCuenta(this.pagina, c.mesa, propina);
      },
    );
    if (!ok || leida === null) {
      await recuperar(this.pagina, ctx.entorno.appUrl, '/mesero');
      return;
    }
    const { codigo, totalCentavos, preguntoPropina } = leida;
    const subtotal = subtotalDe(c);
    const propinaCentavos = preguntoPropina ? Math.round((subtotal * porcentaje) / 100) : 0;
    if (totalCentavos !== null && totalCentavos !== subtotal + propinaCentavos) {
      await ctx.incidente(
        {
          ...this.base(`Mesero · mesa ${String(c.mesa)}`),
          hizo: `Pedir la cuenta de ${c.cuenta}`,
          esperaba: `TOTAL ${String(subtotal + propinaCentavos)} centavos (lo anotado + propina).`,
          paso: 'total de la pre-cuenta',
          reproducido: 'no intentado',
          gravedad: 'alto',
          clase: 'dinero',
          evidencia: { consola: [`pre-cuenta: ${String(totalCentavos)}`] },
        },
        this.pagina,
      );
    }
    c.fase = 'cuenta';
    ctx.mundo.porCobrar.push({
      cuenta: c.cuenta,
      mesa: c.mesa,
      esperadoCentavos: subtotal,
      pedidaEn: ahoraMin,
      codigo,
      propinaCentavos,
      propinaPorcentaje: preguntoPropina ? porcentaje : 0,
      cobrandola: null,
    });
    contar(ctx.mundo, 'cuentas_pedidas');
  }

  /** Recorre las mesas: recoge lo listo, pide cuenta y rondas a su hora, y suelta las ya cobradas. */
  async atenderMesas(mesas: readonly MesaEnPantalla[], ahoraMin: number): Promise<void> {
    const { ctx } = this;
    for (const m of mesas) {
      if (ctx.terminado()) return;
      if (
        m.estado === 'Esperando entrega' &&
        (await hayListoParaRecoger(this.pagina, m.numero).catch(() => false))
      ) {
        const ok = await intentar(
          ctx,
          this.pagina,
          {
            ...this.base(`Mesero · mesa ${String(m.numero)}`),
            hizo: 'Marcar entregado',
            esperaba: 'La mesa queda «Ocupada» con todo entregado.',
            paso: 'marcar entregado',
          },
          async () => {
            await entregarListos(this.pagina, m.numero);
          },
        );
        await alMapa(this.pagina).catch(() => undefined);
        if (ok) contar(ctx.mundo, 'entregas');
        else await recuperar(this.pagina, ctx.entorno.appUrl, '/mesero');
      }
      if (m.estado === 'Limpieza') await dejarLimpia(this.pagina, m.numero).catch(() => undefined);
    }
    for (const c of [...this.cuentas]) {
      const estado = mesas.find((m) => m.numero === c.mesa)?.estado ?? '';
      if (c.fase === 'cuenta' && estado === 'Libre') this.librar(c);
      else if (c.fase === 'abierta' && c.ronda < c.rondas && ahoraMin >= c.proximaRondaEn)
        await this.siguienteRonda(c, ahoraMin);
      else if (
        c.fase === 'abierta' &&
        c.ronda >= c.rondas &&
        ahoraMin >= c.pedirCuentaEn &&
        (!ESPERANDO_COCINA.has(estado) || ahoraMin >= c.pedirCuentaEn + 25)
      )
        await this.cuentaDeMesa(c, ahoraMin);
    }
  }

  /** Une una mesa libre propia a un grupo grande (5–6) y la libera con su cuenta. */
  async unirParaGrupoGrande(mesas: readonly MesaEnPantalla[]): Promise<void> {
    const { ctx } = this;
    const grande = this.cuentas.find(
      (c) => c.personas >= 5 && c.ronda >= 1 && c.fase === 'abierta' && !c.unida,
    );
    const otra = mesas.find((m) => m.estado === 'Libre' && !ctx.mundo.atendidas.has(m.numero));
    if (grande === undefined || otra === undefined || !ctx.azar.probabilidad(0.5)) return;
    ctx.mundo.atendidas.set(otra.numero, `${grande.cuenta}+`);
    grande.unida = true;
    const ok = await intentar(
      ctx,
      this.pagina,
      {
        ...this.base('Mesero · unir mesas'),
        hizo: `Unir la mesa ${String(grande.mesa)} con la ${String(otra.numero)}`,
        esperaba: 'Las dos mesas quedan unidas.',
        paso: 'unir mesas',
      },
      () => unirMesas(this.pagina, grande.mesa, otra.numero),
    );
    if (!ok) await recuperar(this.pagina, ctx.entorno.appUrl, '/mesero');
    else contar(ctx.mundo, 'mesas_unidas');
  }

  async cambiarUnaMesa(mesas: readonly MesaEnPantalla[]): Promise<void> {
    const { ctx } = this;
    const c = this.cuentas.find(
      (x) => x.fase === 'abierta' && x.ronda >= 1 && !x.llegoEnPortal && !x.movida,
    );
    const destino = mesas.find((m) => m.estado === 'Libre' && !ctx.mundo.atendidas.has(m.numero));
    if (c === undefined || destino === undefined || !ctx.azar.probabilidad(0.05)) return;
    ctx.mundo.atendidas.set(destino.numero, c.cuenta);
    const ok = await intentar(
      ctx,
      this.pagina,
      {
        ...this.base('Mesero · cambiar de mesa'),
        hizo: `Pasar la cuenta de la mesa ${String(c.mesa)} a la ${String(destino.numero)}`,
        esperaba: 'La cuenta se va a la otra mesa.',
        paso: 'cambiar de mesa',
      },
      () => cambiarDeMesa(this.pagina, ctx.entorno.appUrl, c.mesa, destino.numero),
    );
    if (ok) {
      ctx.mundo.atendidas.delete(c.mesa);
      this.cuentas[this.cuentas.indexOf(c)] = { ...c, mesa: destino.numero, movida: true };
      contar(ctx.mundo, 'cambios_de_mesa');
    } else ctx.mundo.atendidas.delete(destino.numero);
    await recuperar(this.pagina, ctx.entorno.appUrl, '/mesero');
  }
}

async function vuelta(ctx: ContextoDelBot, m: Mesero): Promise<void> {
  const ahoraMin = minutoDelDia(ctx.ahoraSim());
  const quien = m.cfg.persona;
  traza(ctx, quien, 'vuelta');
  if ((await asegurarSesion(m.pagina, ctx.entorno, m.cfg.persona)) === 'reentro') {
    await ctx.incidente(
      {
        pantalla: 'Sesión',
        hizo: 'Seguir trabajando',
        esperaba: 'La sesión del mesero sigue vigente en la jornada.',
        paso: 'sesión vencida',
        reproducido: 'no intentado',
        gravedad: 'medio',
        clase: 'ux',
      },
      m.pagina,
    );
  }
  await despertar(m.pagina, ctx.entorno, m.cfg.persona);
  if (!new URL(m.pagina.url()).pathname.endsWith('/mesero'))
    await recuperar(m.pagina, ctx.entorno.appUrl, '/mesero');
  await alMapa(m.pagina).catch(() => undefined);
  const mesas = await mesasEnPantalla(m.pagina);
  traza(
    ctx,
    quien,
    `mesas: ${mesas.map((x) => `${String(x.numero)}=${x.estado}`).join(' ')} · cuentas: ${String(m.cuentas.length)}`,
  );
  soltarMesasDelPortal(ctx, mesas);
  await m.tomarLlegada(mesas, ahoraMin);
  await m.atenderMesas(mesas, ahoraMin);
  const pendientes = await solicitudesPendientes(m.pagina).catch(() => []);
  traza(
    ctx,
    quien,
    `solicitudes: ${pendientes.map((x) => `${String(x.mesa)}:${x.motivo}`).join(' ')}`,
  );
  for (const s of pendientes) {
    if (/ordenar/i.test(s.motivo)) await atenderPortal(ctx, m.pagina, m.cfg.persona, s.mesa);
    else
      await intentar(
        ctx,
        m.pagina,
        {
          bot: m.cfg.persona,
          pantalla: 'Solicitudes',
          hizo: `Atender «${s.motivo}» de la mesa ${String(s.mesa)}`,
          esperaba: 'La solicitud queda resuelta.',
          paso: 'atender ayuda',
        },
        () => atenderAyuda(m.pagina, s.mesa),
      );
  }
  await m.pagina
    .getByRole('button', { name: 'Mesas', exact: true })
    .click({ timeout: ESPERA_MS })
    .catch(() => undefined);
  await cuentasQueMePidenEnPersona(ctx, m.pagina, quien, mesas, ahoraMin);
  await m.unirParaGrupoGrande(mesas);
  await m.cambiarUnaMesa(mesas);
}

export function crearMesero(cfg: ConfigDelMesero): Bot {
  return {
    nombre: cfg.persona,
    rol: 'mesero',
    aparato: cfg.aparato,
    async correr(ctx) {
      const { contexto, pagina } = await ctx.nuevoContexto(cfg.aparato);
      pagina.setDefaultTimeout(ESPERA_MS);
      const mesero = new Mesero(ctx, cfg, pagina);
      vigilarServidor(ctx, pagina, () => 'Mesero');
      try {
        await entrarOFallar(pagina, ctx.entorno, cfg.persona);
        while (!ctx.terminado()) {
          await vuelta(ctx, mesero).catch(async (error: unknown) => {
            await ctx.incidente(
              {
                pantalla: 'Mesero',
                hizo: 'Una vuelta del mesero',
                esperaba: 'Terminar la vuelta sin fallos del guion.',
                paso: 'vuelta del mesero',
                reproducido: 'no intentado',
                gravedad: 'bajo',
                clase: 'prueba',
                evidencia: { consola: [String(error).slice(0, 300)] },
              },
              pagina,
            );
            await recuperar(pagina, ctx.entorno.appUrl, '/mesero');
          });
          await ctx.esperarSim(1);
        }
      } finally {
        await contexto.close();
      }
    },
  };
}
