import 'server-only';

import { PAQUETES_RESTAURANTE } from '@morphiqpos/contracts';
import type { Transaccion } from '@morphiqpos/data';

import { definirComando, type ContextoComando } from '../definicion.ts';
import { tomarCandadosDeCocina } from './candados-de-cocina.ts';
import { comandaPorId, type ComandaViva } from './datos.ts';
import { ROLES_DE_COCINA } from './roles-de-cocina.ts';
import { entregarLoListoYaCobrado } from './comandas-al-cobrar.ts';
import { entradaTransicionarPedido } from './esquemas.ts';
import { ajustarComandaAlMinimo, itemDeComanda, moverItem, type ItemDeComanda } from './items.ts';
import { moverComanda, sincronizarMesa } from './preparacion-escrituras.ts';
import { propagarAItems, recalcularEstadoDeLineas } from './propagacion.ts';
import {
  esTransicionValida,
  estadoComandaDeItem,
  evaluarTransicion,
  type EstadoComanda,
} from './transiciones.ts';

/**
 * El ciclo de preparación: `transicionar_pedido` y `entregar_pedidos` (E6-6).
 *
 * Los dos comparten la misma mecánica y por eso viven juntos: mueven comandas,
 * arrastran sus items y las líneas de venta en la MISMA transacción, y después
 * deciden si la mesa avanza.
 *
 * ── La versión monotónica ──────────────────────────────────────────────────
 * No hay columna `version` en `comandas`: la versión es el rango del estado
 * (ver `transiciones.ts`). Un toque que llega tarde pidiendo `en_preparacion`
 * sobre una comanda que ya está `listo` NO devuelve el plato al fuego: se
 * rechaza con `TRANSICION_INVALIDA`. Y el `where estado = <el que leímos>` de
 * cada `update` es lo que hace que dos pantallas de cocina abiertas a la vez no
 * se pisen: la segunda actualiza cero filas y revierte.
 */

export interface ResultadoTransicion {
  readonly comandaId: string;
  readonly estado: string;
  readonly estadoAnterior: string;
  readonly estadoMesa: string | null;
}

export const transicionarPedido = definirComando<
  Transaccion,
  typeof entradaTransicionarPedido,
  ResultadoTransicion
>({
  nombre: 'restaurante.transicionar_pedido',
  entidad: 'comanda',
  escribe: true,
  roles: [...ROLES_DE_COCINA],
  paquetes: PAQUETES_RESTAURANTE,
  sucursal: { comandaId: 'comandas', comandaItemId: 'comanda_items' },
  modulo: 'cocina',
  entrada: entradaTransicionarPedido,
  async ejecutar(ctx, entrada) {
    const { organizacionId, empleoId } = ctx.ambito;

    // H2 · Los candados primero y siempre en el mismo orden (`candados-de-cocina.ts`): cuenta →
    // comanda → platos → líneas. La primera lectura sólo dice de qué cuenta es la comanda; la que
    // vale es la de después del candado, con el estado que la otra pantalla ya dejó.
    const ubicada = await ctx.paso('ubicar_comanda', () =>
      comandaPorId(ctx.tx, organizacionId, entrada.comandaId),
    );
    await ctx.paso('candados', () =>
      tomarCandadosDeCocina(ctx.tx, {
        organizacionId,
        ordenIds: [ubicada.ordenId],
        comandas: { de: 'ids', ids: [ubicada.id] },
      }),
    );
    const comanda = await ctx.paso('cargar_comanda', () =>
      comandaPorId(ctx.tx, organizacionId, entrada.comandaId),
    );

    const itemId = entrada.comandaItemId;
    const item =
      itemId === undefined
        ? null
        : await ctx.paso('cargar_item', () =>
            itemDeComanda(ctx.tx, organizacionId, comanda.id, itemId),
          );

    // Lanza TRANSICION_INVALIDA si el destino no sigue a la tabla o retrocede.
    // Sobre el item se evalúa la MISMA tabla, traduciendo `pendiente` a `nuevo`.
    const partida = item === null ? comanda.estado : estadoComandaDeItem(item.estado);
    // DP-24 · Un toque tardío sobre un PLATILLO que otro cocinero ya adelantó (pedía «en preparación»
    // y ya está listo) no es un fallo ni lo regresa: no hace nada. La comanda sigue como estaba.
    const yaAdelantado =
      item !== null && partida !== entrada.estado && esTransicionValida(entrada.estado, partida);
    const movimiento = yaAdelantado
      ? ({ tipo: 'sin_cambio' } as const)
      : evaluarTransicion(partida, entrada.estado);

    if (movimiento.tipo === 'sin_cambio') {
      ctx.auditar({
        entidadId: comanda.id,
        payload: { estado: comanda.estado, itemId: itemId ?? null, sinCambio: true },
      });
      return {
        comandaId: comanda.id,
        estado: comanda.estado,
        estadoAnterior: comanda.estado,
        estadoMesa: null,
      };
    }

    const estadoComanda =
      item === null
        ? await moverToda(ctx.tx, (nombre, fn) => ctx.paso(nombre, fn), {
            organizacionId,
            comanda,
            destino: entrada.estado,
            empleoId,
            ahora: ctx.ahora,
          })
        : await moverUnPlato(ctx, comanda, item, entrada.estado);

    const estadoMesa = await cerrarElMovimiento(ctx.tx, (nombre, fn) => ctx.paso(nombre, fn), {
      organizacionId,
      comanda,
      estadoComanda,
      empleoId,
      ahora: ctx.ahora,
      // DP-24 · Un platillo suelto que no cambia a la comanda no es noticia para la mesa.
      cambioLaComanda: item === null || estadoComanda !== comanda.estado,
      salioUnPlato: item !== null && entrada.estado === 'listo',
    });

    ctx.auditar({
      entidadId: comanda.id,
      payload: {
        de: comanda.estado,
        a: estadoComanda,
        itemId: itemId ?? null,
        estacion: comanda.estacionNombre,
        estadoMesa,
      },
    });

    return {
      comandaId: comanda.id,
      estado: estadoComanda,
      estadoAnterior: comanda.estado,
      estadoMesa,
    };
  },
});

/** Cómo se nombra un paso: el del comando, o directo para quien no lleva bitácora de pasos. */
export type Paso = <T>(nombre: string, fn: () => Promise<T>) => Promise<T>;

export interface DatosDeLaComanda {
  readonly organizacionId: string;
  readonly comanda: ComandaViva;
  /** Quien la mueve; nulo desde el teléfono de una estación, que no tiene sesión (DP-9.4). */
  readonly empleoId: string | null;
  readonly ahora: Date;
}

/** La comanda entera: se mueve la cabecera y sus items la siguen. */
async function moverToda(
  tx: Transaccion,
  paso: Paso,
  datos: DatosDeLaComanda & { readonly destino: EstadoComanda },
): Promise<EstadoComanda> {
  const { organizacionId, comanda, destino } = datos;
  await paso('mover_comanda', () =>
    moverComanda(tx, {
      organizacionId,
      comandaId: comanda.id,
      desde: comanda.estado,
      hacia: destino,
      empleoId: datos.empleoId,
      ahora: datos.ahora,
    }),
  );
  await paso('propagar_items', () =>
    propagarAItems(tx, organizacionId, [comanda.id], destino, datos.ahora),
  );
  return destino;
}

/**
 * Después de mover: las líneas de la venta siguen a sus platos y la mesa avanza si le toca.
 *
 * Es EL cierre de una comanda que cambió de estado: lo usan mover un plato, mover la comanda
 * entera y quitar el platillo que faltaba (`ajustar-comandas-tras-anular.ts`).
 */
export async function cerrarElMovimiento(
  tx: Transaccion,
  paso: Paso,
  datos: DatosDeLaComanda & {
    readonly estadoComanda: EstadoComanda;
    /**
     * DP-24 · Falso cuando sólo se movió un platillo y la comanda siguió donde estaba: la mesa
     * no se toca (otra estación puede ir más adelante y regresarla sería mentirle al mapa).
     */
    readonly cambioLaComanda?: boolean;
    /** DP-24 · Un platillo quedó listo aunque la comanda aún no: igual se mira si ya se cobró. */
    readonly salioUnPlato?: boolean;
  },
): Promise<string | null> {
  const { organizacionId, comanda } = datos;
  // DP-15 (QA, J-H3): lo que se termina de una cuenta ya cobrada no espera a ningún mesero.
  if (datos.estadoComanda === 'listo' || datos.salioUnPlato === true) {
    await paso('entregar_lo_ya_cobrado', () =>
      entregarLoListoYaCobrado(tx, organizacionId, comanda.id, datos.ahora),
    );
  }
  await paso('recalcular_lineas', () => recalcularEstadoDeLineas(tx, organizacionId, [comanda.id]));
  if (datos.cambioLaComanda === false) return null;
  return paso('avanzar_mesa', () =>
    sincronizarMesa(tx, {
      organizacionId,
      ordenId: comanda.ordenId,
      mesaId: comanda.mesaId,
      comandasMovidas: [comanda.id],
      estadoComanda: datos.estadoComanda,
      empleoId: datos.empleoId,
      ahora: datos.ahora,
    }),
  );
}

/**
 * Mueve una comanda ENTERA con la misma regla que `transicionar_pedido`: sólo hacia adelante,
 * con el `where estado = leído` que hace que dos pantallas no se pisen, y la mesa detrás. La usa
 * el teléfono de una estación (DP-9.4), que no tiene sesión ni bitácora de pasos.
 */
export async function moverLaComandaEntera(
  tx: Transaccion,
  datos: DatosDeLaComanda & { readonly destino: EstadoComanda },
  paso: Paso = (_nombre, fn) => fn(),
): Promise<{ readonly estado: EstadoComanda; readonly sinCambio: boolean }> {
  // H2 · Mismo orden de candados que `transicionar_pedido`; el estado que vale es el de después.
  await paso('candados', () =>
    tomarCandadosDeCocina(tx, {
      organizacionId: datos.organizacionId,
      ordenIds: [datos.comanda.ordenId],
      comandas: { de: 'ids', ids: [datos.comanda.id] },
    }),
  );
  const comanda = await paso('cargar_comanda', () =>
    comandaPorId(tx, datos.organizacionId, datos.comanda.id),
  );
  const vigentes = { ...datos, comanda };
  if (evaluarTransicion(comanda.estado, datos.destino).tipo === 'sin_cambio') {
    return { estado: comanda.estado, sinCambio: true };
  }
  const estadoComanda = await moverToda(tx, paso, vigentes);
  await cerrarElMovimiento(tx, paso, { ...vigentes, estadoComanda });
  return { estado: estadoComanda, sinCambio: false };
}

/**
 * Un solo plato: se mueve el item y la comanda se DERIVA del mínimo.
 *
 * Al revés que la rama de arriba, y a propósito. Si aquí se moviera también la
 * cabecera, marcar listo el primero de tres platos dejaría la comanda entera en
 * `listo` y el mesero recogería una charola incompleta.
 */
async function moverUnPlato(
  ctx: ContextoComando<Transaccion>,
  comanda: ComandaViva,
  item: ItemDeComanda,
  destino: EstadoComanda,
): Promise<EstadoComanda> {
  const { organizacionId } = ctx.ambito;
  await ctx.paso('mover_item', () => moverItem(ctx.tx, organizacionId, item, destino, ctx.ahora));
  return ctx.paso('derivar_comanda', () =>
    ajustarComandaAlMinimo(ctx.tx, organizacionId, comanda.id, comanda.estado, ctx.ahora),
  );
}

/** El comando de la mesa vive aparte (DP-24): entrega platillos, no comandas. */
export { entregarPedidos, type ResultadoEntrega } from './entrega-de-platillos.ts';
