/**
 * UNA RONDA DEL MESERO: toca cada platillo, compara el carrito con lo que DEBE costar (del
 * catálogo que el personal conoce), manda a cocina y lo anota en el libro, línea por línea.
 */
import type { Page } from '@playwright/test';

import type { ContextoDelBot } from '../bot.ts';
import { contar } from '../mundo.ts';
import { NOTA_LARGA, totalDe, type LineaPlaneada } from '../pedido.ts';
import { intentar } from './ayudas.ts';
import {
  agregarLinea,
  alMapa,
  enviarACocina,
  entrarALaMesa,
  totalDelCarrito,
} from './mesero-ui.ts';

export interface CuentaDelMesero {
  readonly cuenta: string;
  readonly mesa: number;
  readonly personas: number;
  readonly rondas: number;
  readonly pedirCuentaEn: number;
  readonly enviadas: LineaPlaneada[];
  quitadas: number;
  ronda: number;
  proximaRondaEn: number;
  fase: 'abierta' | 'cuenta';
  llegoEnPortal: boolean;
  unida: boolean;
  movida: boolean;
}

export const subtotalDe = (c: CuentaDelMesero): number => totalDe(c.enviadas) - c.quitadas;

/** Anota una línea enviada en el libro (lo que el mesero SABE que pidió). */
export function anotarLineas(
  ctx: ContextoDelBot,
  bot: string,
  cuenta: string,
  lineas: readonly LineaPlaneada[],
  canal: 'mesa' | 'portal',
): void {
  for (const l of lineas) {
    ctx.libro.anotar(bot, {
      tipo: 'linea',
      cuenta,
      producto: l.producto.nombre,
      cantidad: l.cantidad,
      opciones: l.opciones.map((o) => o.opcion),
      importeCentavos: l.importeCentavos,
      estacion: l.producto.estacion,
      canal,
    });
    contar(ctx.mundo, `linea:${l.producto.tipoVenta}`);
  }
  contar(ctx.mundo, 'lineas', lineas.length);
}

/** Pide una ronda en la mesa. Devuelve si el servidor la aceptó (y quedó anotada). */
export async function pedirRonda(
  ctx: ContextoDelBot,
  pagina: Page,
  bot: string,
  cuenta: CuentaDelMesero,
  lineas: readonly LineaPlaneada[],
): Promise<boolean> {
  const pantalla = `Mesero · mesa ${String(cuenta.mesa)}`;
  const base = { bot, pantalla };
  const dentro = await intentar(
    ctx,
    pagina,
    {
      ...base,
      hizo: `Entrar a la mesa ${String(cuenta.mesa)}`,
      esperaba: 'Abrir el diálogo de la mesa.',
      paso: 'entrar a la mesa',
    },
    () => entrarALaMesa(pagina, cuenta.mesa),
  );
  if (!dentro) return false;
  for (const l of lineas) {
    const ok = await intentar(
      ctx,
      pagina,
      {
        ...base,
        hizo: `Agregar ${String(l.cantidad)} × ${l.producto.nombre}`,
        esperaba: 'La línea queda en el pedido.',
        paso: `agregar ${l.producto.tipoVenta}`,
      },
      () => agregarLinea(pagina, cuenta.mesa, l),
    );
    if (!ok) return false;
  }
  const esperado = totalDe(lineas);
  const enCarrito = await totalDelCarrito(pagina).catch(() => null);
  if (enCarrito !== null && enCarrito !== esperado) {
    await ctx.incidente(
      {
        pantalla,
        hizo: `Armar ${String(lineas.length)} línea(s) por ${String(esperado)} centavos`,
        esperaba: `El carrito dice ${String(esperado)} centavos.`,
        paso: 'total del carrito',
        reproducido: 'no intentado',
        gravedad: 'alto',
        clase: 'dinero',
        evidencia: { consola: [`carrito: ${String(enCarrito)} · esperado: ${String(esperado)}`] },
      },
      pagina,
    );
  }
  const nota = ctx.azar.probabilidad(0.12) ? NOTA_LARGA : '';
  const enviado = await intentar(
    ctx,
    pagina,
    {
      ...base,
      hizo: 'Enviar a Cocina',
      esperaba: 'El servidor acepta el pedido y avisa «¡Pedido enviado a cocina!».',
      paso: 'enviar a cocina',
    },
    () => enviarACocina(pagina, nota),
  );
  if (!enviado) return false;
  anotarLineas(ctx, bot, cuenta.cuenta, lineas, 'mesa');
  cuenta.enviadas.push(...lineas);
  cuenta.ronda += 1;
  await alMapa(pagina).catch(() => undefined);
  return true;
}
