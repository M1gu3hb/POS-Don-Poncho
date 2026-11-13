/**
 * LOS COMENSALES: un solo bot administra los grupos que llegan con QR (15–25 teléfonos a la vez).
 * Cada grupo escoge una mesa libre, abre `/qr/<token>` en 2–4 teléfonos, arma el pedido compartido
 * entre todos, llama al mesero para confirmar, repite por rondas, y al final pide ayuda a veces y
 * pide la cuenta con su propina.
 *
 * Lo que el mesero confirmó (y salió a cocina) se anota en el libro con canal `portal`; la cuenta
 * pedida queda en `mundo.porCobrar` para que las cajas la cobren.
 */
import type { Page } from '@playwright/test';

import type { NombreDeAparato } from '../aparatos.ts';
import type { Bot, ContextoDelBot } from '../bot.ts';
import { estanciaAlSentarse, minutoDelDia } from '../horario.ts';
import { contar, type GrupoDePortal, type Llegada } from '../mundo.ts';
import { planearRonda } from '../pedido.ts';
import { intentar, vigilarServidor } from './ayudas.ts';
import {
  abrirElQr,
  agregarAlPortal,
  llamarParaConfirmar,
  pedirAyuda,
  pedirCuentaPorElPortal,
} from './comensal-ui.ts';

const APARATOS: readonly NombreDeAparato[] = ['android-360', 'android-412', 'iphone'];
const MINUTOS_PARA_QUE_CONFIRMEN = 25;

interface Telefono {
  readonly pagina: Page;
  readonly cerrar: () => Promise<void>;
}

async function esperarMinutos(
  ctx: ContextoDelBot,
  minutos: number,
  hasta: () => boolean,
): Promise<boolean> {
  const limite = minutoDelDia(ctx.ahoraSim()) + minutos;
  while (!ctx.terminado() && minutoDelDia(ctx.ahoraSim()) < limite) {
    if (hasta()) return true;
    await ctx.esperarSim(0.5);
  }
  return hasta();
}

/** Anota en el libro lo que el mesero ya mandó a cocina de este grupo y que todavía no estaba anotado. */
function anotarLoConfirmado(ctx: ContextoDelBot, grupo: GrupoDePortal, yaAnotadas: number): number {
  if (grupo.enviadas <= yaAnotadas) return yaAnotadas;
  const nuevas = grupo.lineas.slice(yaAnotadas, grupo.enviadas);
  for (const l of nuevas) {
    ctx.libro.anotar(`comensales-${grupo.llegada.id}`, {
      tipo: 'linea',
      cuenta: grupo.llegada.id,
      producto: l.producto,
      cantidad: l.cantidad,
      opciones: l.opciones,
      importeCentavos: l.importeCentavos,
      estacion: l.estacion,
      canal: 'portal',
    });
  }
  contar(ctx.mundo, 'lineas_del_portal', nuevas.length);
  return grupo.enviadas;
}

/** El grupo se fue sin cuenta (nada salió a cocina): la mesa vuelve a estar disponible. */
function soltarLaMesa(ctx: ContextoDelBot, grupo: GrupoDePortal): void {
  if (ctx.mundo.portal.get(grupo.mesa) === grupo) ctx.mundo.portal.delete(grupo.mesa);
  if (ctx.mundo.atendidas.get(grupo.mesa) === grupo.llegada.id)
    ctx.mundo.atendidas.delete(grupo.mesa);
}

async function abrirTelefonos(
  ctx: ContextoDelBot,
  llegada: Llegada,
  token: string,
): Promise<Telefono[]> {
  const telefonos: Telefono[] = [];
  for (let i = 0; i < llegada.telefonos; i += 1) {
    const { contexto, pagina } = await ctx.nuevoContexto(ctx.azar.elegir(APARATOS));
    vigilarServidor(ctx, pagina, () => `Portal · ${llegada.id}`);
    telefonos.push({ pagina, cerrar: () => contexto.close() });
    const ok = await intentar(
      ctx,
      pagina,
      {
        bot: `comensales-${llegada.id}`,
        pantalla: 'Portal del comensal',
        hizo: `Escanear el QR del teléfono ${String(i + 1)}`,
        esperaba: 'El menú de la mesa con «Atención» y el pedido compartido.',
        paso: 'escanear el QR',
      },
      () => abrirElQr(pagina, ctx.entorno.appUrl, token),
    );
    if (!ok) return telefonos;
  }
  return telefonos;
}

async function atenderGrupo(
  ctx: ContextoDelBot,
  llegada: Llegada,
  mesa: number,
  token: string,
): Promise<void> {
  const bot = `comensales-${llegada.id}`;
  const grupo: GrupoDePortal = { llegada, mesa, lineas: [], enviadas: 0, cuentaPedida: false };
  ctx.mundo.portal.set(mesa, grupo);
  const telefonos = await abrirTelefonos(ctx, llegada, token);
  try {
    const primero = telefonos[0]?.pagina;
    if (telefonos.length < llegada.telefonos || primero === undefined) {
      soltarLaMesa(ctx, grupo); // aún no piden nada: la mesa queda para otro grupo
      return;
    }
    let anotadas = 0;
    const inicio = minutoDelDia(ctx.ahoraSim());
    const estancia = estanciaAlSentarse(llegada, inicio);
    for (let ronda = 1; ronda <= llegada.rondas && !ctx.terminado(); ronda += 1) {
      const lineas = planearRonda(ctx.azar, ctx.mundo, llegada.personas, 4);
      for (const l of lineas) {
        const t = ctx.azar.elegir(telefonos);
        const ok = await intentar(
          ctx,
          t.pagina,
          {
            bot,
            pantalla: 'Portal del comensal',
            hizo: `Agregar ${String(l.cantidad)} × ${l.producto.nombre}`,
            esperaba: 'El platillo entra al pedido de la mesa.',
            paso: `agregar al portal (${l.producto.tipoVenta})`,
          },
          () => agregarAlPortal(t.pagina, l),
        );
        if (ok)
          grupo.lineas.push({
            producto: l.producto.nombre,
            cantidad: l.cantidad,
            opciones: l.opciones.map((o) => o.opcion),
            importeCentavos: l.importeCentavos,
            estacion: l.producto.estacion,
          });
      }
      const quien = ctx.azar.elegir(telefonos);
      let llamo = 0;
      await intentar(
        ctx,
        quien.pagina,
        {
          bot,
          pantalla: 'Portal del comensal',
          hizo: 'Llamar a mi mesero para confirmar',
          esperaba: 'El pedido queda guardado y el mesero recibe la solicitud.',
          paso: 'llamar al mesero',
        },
        async () => {
          llamo = await llamarParaConfirmar(quien.pagina);
          if (llamo !== 200) throw new Error(`llamar respondió ${String(llamo)}`);
        },
      );
      const confirmado = await esperarMinutos(
        ctx,
        MINUTOS_PARA_QUE_CONFIRMEN,
        () => grupo.enviadas >= grupo.lineas.length,
      );
      anotadas = anotarLoConfirmado(ctx, grupo, anotadas);
      if (!confirmado && !ctx.terminado()) {
        await ctx.incidente(
          {
            pantalla: 'Portal del comensal',
            hizo: `Pedir la ronda ${String(ronda)} por el portal`,
            esperaba: `El mesero la confirma en menos de ${String(MINUTOS_PARA_QUE_CONFIRMEN)} minutos.`,
            paso: 'pedido del portal sin confirmar',
            reproducido: 'no intentado',
            gravedad: 'alto',
            clase: 'ux',
          },
          quien.pagina,
        );
        // Se van sin esperar más: lo que ya salió a cocina se lo cobran pidiéndole la cuenta al mesero.
        // Si nada salió, la mesa NO se suelta: su carrito compartido quedó con platillos y el grupo
        // siguiente se los llevaría sin que el libro lo sepa.
        if (grupo.enviadas > 0) grupo.pideLaCuentaEnPersona = true;
        return;
      }
      if (ronda < llegada.rondas)
        await esperarMinutos(ctx, Math.max(8, Math.floor(estancia / llegada.rondas)), () => false);
    }
    if (ctx.azar.probabilidad(0.25)) {
      await intentar(
        ctx,
        primero,
        {
          bot,
          pantalla: 'Portal del comensal',
          hizo: 'Necesito ayuda',
          esperaba: 'El mesero recibe «Necesito ayuda» de la mesa.',
          paso: 'pedir ayuda',
        },
        async () => {
          if ((await pedirAyuda(primero)) !== 200) throw new Error('solicitud de ayuda rechazada');
        },
      );
    }
    await esperarMinutos(
      ctx,
      Math.max(0, estancia - (minutoDelDia(ctx.ahoraSim()) - inicio)),
      () => false,
    );
    if (ctx.terminado() || grupo.lineas.length === 0) return;
    const porcentaje = ctx.azar.elegir([0, 10, 10, 15]);
    let elegido = 0;
    let pidio = false;
    // Dos intentos; antes del segundo se vuelve a escanear el QR (como quien recarga la página).
    for (let intento = 1; intento <= 2 && !pidio && !ctx.terminado(); intento += 1) {
      if (intento > 1) await abrirElQr(primero, ctx.entorno.appUrl, token).catch(() => undefined);
      pidio = await intentar(
        ctx,
        primero,
        {
          bot,
          pantalla: 'Portal del comensal',
          hizo: `Pedir la cuenta${porcentaje === 0 ? '' : ` con ${String(porcentaje)} % de propina`}`,
          esperaba: 'La cuenta queda solicitada.',
          paso: 'pedir la cuenta por el portal',
        },
        async () => {
          const r = await pedirCuentaPorElPortal(primero, porcentaje);
          elegido = r.porcentaje;
          if (r.estado !== 200) throw new Error(`solicitud respondió ${String(r.estado)}`);
        },
      );
    }
    if (!pidio) {
      // Se la piden al mesero en persona; si nada salió a cocina no hay cuenta: la mesa se suelta.
      if (grupo.enviadas > 0) grupo.pideLaCuentaEnPersona = true;
      else soltarLaMesa(ctx, grupo);
      return;
    }
    grupo.cuentaPedida = true;
    const subtotal = grupo.lineas.reduce((s, l) => s + l.importeCentavos, 0);
    ctx.mundo.porCobrar.push({
      cuenta: llegada.id,
      mesa,
      esperadoCentavos: subtotal,
      pedidaEn: minutoDelDia(ctx.ahoraSim()),
      propinaCentavos: Math.round((subtotal * elegido) / 100),
      propinaPorcentaje: elegido,
      cobrandola: null,
    });
    contar(ctx.mundo, 'cuentas_pedidas_por_portal');
  } finally {
    for (const t of telefonos) await t.cerrar().catch(() => undefined);
  }
}

export interface ConfigDeComensales {
  /** Teléfonos a la vez, como mucho (15–25 en el día normal). */
  readonly maximoDeTelefonos: number;
}

export function crearComensales(cfg: ConfigDeComensales): Bot {
  return {
    nombre: 'Comensales',
    rol: 'comensal',
    aparato: 'android-412',
    async correr(ctx) {
      let telefonosAbiertos = 0;
      const grupos = new Set<Promise<void>>();
      while (!ctx.terminado()) {
        const ahoraMin = minutoDelDia(ctx.ahoraSim());
        const idx = ctx.mundo.llegadas.findIndex((l) => l.usaQr && l.horaSim <= ahoraMin);
        const llegada = ctx.mundo.llegadas[idx];
        const mesa = ctx.mundo.mesas.find((m) => !ctx.mundo.atendidas.has(m.numero));
        if (
          llegada !== undefined &&
          mesa !== undefined &&
          telefonosAbiertos + llegada.telefonos <= cfg.maximoDeTelefonos
        ) {
          ctx.mundo.llegadas.splice(idx, 1);
          ctx.mundo.atendidas.set(mesa.numero, llegada.id);
          telefonosAbiertos += llegada.telefonos;
          const tarea = atenderGrupo(ctx, llegada, mesa.numero, mesa.qrToken)
            .catch(async (error: unknown) => {
              await ctx.incidente({
                pantalla: 'Portal del comensal',
                hizo: 'Atender al grupo',
                esperaba: 'Terminar sin fallos del guion.',
                paso: 'grupo del portal',
                reproducido: 'no intentado',
                gravedad: 'bajo',
                clase: 'prueba',
                evidencia: { consola: [String(error).slice(0, 300)] },
              });
            })
            .finally(() => {
              telefonosAbiertos -= llegada.telefonos;
              grupos.delete(tarea);
            });
          grupos.add(tarea);
        }
        await ctx.esperarSim(0.5);
      }
      await Promise.allSettled([...grupos]);
    },
  };
}
