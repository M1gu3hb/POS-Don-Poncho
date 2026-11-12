/**
 * EL MESERO Y LOS TELÉFONOS DE LA MESA: confirma el pedido que armaron los comensales en el portal
 * del QR (modo «sólo el mesero confirma y envía») y manda a cocina a su nombre. Las líneas las anota
 * en el libro el comensal que las pidió; aquí sólo se marca cuántas ya salieron a cocina.
 */
import type { Page } from '@playwright/test';

import type { ContextoDelBot } from '../bot.ts';
import { contar } from '../mundo.ts';
import { intentar, recuperar } from './ayudas.ts';
import { confirmarPedidoDelPortal, pedirLaCuenta } from './mesero-cuenta.ts';
import type { MesaEnPantalla } from './mesero-ui.ts';

/** Atiende «Mesa N quiere ordenar»: abre la mesa (o entra a la abierta) y manda a cocina lo del portal. */
export async function atenderPortal(
  ctx: ContextoDelBot,
  pagina: Page,
  persona: string,
  mesa: number,
): Promise<void> {
  const grupo = ctx.mundo.portal.get(mesa);
  if (grupo === undefined || grupo.enviadas >= grupo.lineas.length) return;
  const hasta = grupo.lineas.length;
  const ok = await intentar(
    ctx,
    pagina,
    {
      bot: persona,
      pantalla: `Portal · mesa ${String(mesa)}`,
      hizo: `Confirmar el pedido del portal de la mesa ${String(mesa)}`,
      esperaba: 'La mesa se abre con lo que pidieron los teléfonos y sale a cocina.',
      paso: 'confirmar pedido del portal',
    },
    () => confirmarPedidoDelPortal(pagina, mesa, grupo.llegada.personas),
  );
  if (ok) {
    grupo.enviadas = hasta;
    contar(ctx.mundo, 'pedidos_del_portal_confirmados');
  } else {
    await recuperar(pagina, ctx.entorno.appUrl, '/mesero');
  }
}

/**
 * El grupo del portal no pudo pedir la cuenta por el teléfono y se la pide al mesero en persona: el
 * mesero que ve esa mesa en su pantalla la pide por la suya («la decide la caja») y la deja por cobrar
 * con lo que de verdad salió a cocina.
 */
export async function cuentasQueMePidenEnPersona(
  ctx: ContextoDelBot,
  pagina: Page,
  persona: string,
  mesas: readonly MesaEnPantalla[],
  ahoraMin: number,
): Promise<void> {
  for (const grupo of [...ctx.mundo.portal.values()]) {
    if (grupo.pideLaCuentaEnPersona !== true || grupo.cuentaPedida) continue;
    if (!mesas.some((m) => m.numero === grupo.mesa)) continue;
    const ok = await intentar(
      ctx,
      pagina,
      {
        bot: persona,
        pantalla: `Mesero · mesa ${String(grupo.mesa)}`,
        hizo: `Pedir la cuenta de la mesa ${String(grupo.mesa)} (del portal), que me la pidieron en persona`,
        esperaba: 'La pre-cuenta con su código de caja y el total.',
        paso: 'pedir la cuenta del portal en persona',
      },
      async () => {
        await pedirLaCuenta(pagina, grupo.mesa, 'caja');
      },
    );
    if (!ok) {
      await recuperar(pagina, ctx.entorno.appUrl, '/mesero');
      continue;
    }
    grupo.cuentaPedida = true;
    grupo.pideLaCuentaEnPersona = false;
    ctx.mundo.porCobrar.push({
      cuenta: grupo.llegada.id,
      mesa: grupo.mesa,
      esperadoCentavos: grupo.lineas
        .slice(0, grupo.enviadas)
        .reduce((s, l) => s + l.importeCentavos, 0),
      pedidaEn: ahoraMin,
      propinaCentavos: 0,
      propinaPorcentaje: 0,
      cobrandola: null,
    });
    contar(ctx.mundo, 'cuentas_del_portal_pedidas_en_persona');
  }
}

/** Suelta las mesas del portal cuyo grupo ya pagó y se fue (la mesa vuelve a «Libre» en la pantalla). */
export function soltarMesasDelPortal(ctx: ContextoDelBot, mesas: readonly MesaEnPantalla[]): void {
  for (const [numero, grupo] of [...ctx.mundo.portal]) {
    const libre = mesas.find((m) => m.numero === numero)?.estado === 'Libre';
    if (libre && grupo.cuentaPedida && grupo.enviadas > 0) {
      ctx.mundo.portal.delete(numero);
      ctx.mundo.atendidas.delete(numero);
    }
  }
}
