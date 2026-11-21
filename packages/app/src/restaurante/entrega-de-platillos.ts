import 'server-only';

import { PAQUETES_RESTAURANTE } from '@morphiqpos/contracts';
import type { Transaccion } from '@morphiqpos/data';

import { definirComando } from '../definicion.ts';
import { tomarCandadosDeCocina } from './candados-de-cocina.ts';
import { ordenDeMesa } from './datos.ts';
import { entradaEntregarPedidos } from './esquemas.ts';
import { sincronizarMesa } from './preparacion-escrituras.ts';
import { recalcularEstadoDeLineas } from './propagacion.ts';
import { ROLES_DE_COCINA } from './roles-de-cocina.ts';

/**
 * DP-24 · «MARCAR COMO ENTREGADO» entrega los PLATILLOS que ya están listos.
 *
 * Antes entregaba comandas enteras en `listo`. Con la cocina por producto una comanda sigue en
 * «nuevo» mientras le falte un platillo aunque otros ya estén en la ventana, y el mesero no podía
 * recogerlos. Ahora el comando mueve cada platillo `listo` de la cuenta a `entregado` y deja la
 * comanda donde sus platillos digan (el menos avanzado). Si luego sale otro platillo, vuelve a
 * haber algo listo y el mismo botón de la misma tarjeta lo entrega.
 *
 * La mesa sólo se mueve cuando una comanda terminó de entregarse por completo; una que sigue viva
 * (le faltan platillos) la mantiene en el estado que tenía.
 */

export interface ResultadoEntrega {
  readonly ordenId: string;
  /** Las comandas que tuvieron al menos un platillo entregado. */
  readonly entregadas: readonly string[];
  readonly estaciones: readonly string[];
  /** Cuántos platillos (renglones de comanda) se entregaron. */
  readonly platillos: number;
  readonly estadoMesa: string | null;
}

export const entregarPedidos = definirComando<
  Transaccion,
  typeof entradaEntregarPedidos,
  ResultadoEntrega
>({
  nombre: 'restaurante.entregar_pedidos',
  entidad: 'comanda',
  escribe: true,
  roles: [...ROLES_DE_COCINA],
  paquetes: PAQUETES_RESTAURANTE,
  sucursal: { ordenId: 'ordenes', 'comandaIds[]': 'comandas' },
  modulo: 'cocina',
  entrada: entradaEntregarPedidos,
  async ejecutar(ctx, entrada) {
    const { organizacionId, empleoId } = ctx.ambito;

    const orden = await ctx.paso('cargar_orden', () =>
      ordenDeMesa(ctx.tx, organizacionId, entrada.ordenId),
    );
    // H2 · La cuenta ya está tomada; faltan sus comandas, platos y líneas, en el orden de siempre.
    await ctx.paso('candados', () =>
      tomarCandadosDeCocina(ctx.tx, {
        organizacionId,
        ordenIds: [orden.id],
        comandas: { de: 'las-cuentas' },
      }),
    );

    const listos = await ctx.paso('buscar_listos', () =>
      platillosListosDeLaCuenta(ctx.tx, organizacionId, entrada.ordenId, entrada.comandaIds),
    );
    const comandaIds = [...new Set(listos.map((p) => p.comandaId))];

    // Un comando que no entregó nada no escribe nada: el mesero llegó antes que el plato.
    let estadoMesa: string | null = null;
    if (listos.length > 0) {
      await ctx.paso('entregar_platillos', () =>
        ctx.tx
          .updateTable('comanda_items')
          .set({ estado: 'entregado' })
          .where('organizacion_id', '=', organizacionId)
          .where(
            'id',
            'in',
            listos.map((p) => p.id),
          )
          .where('estado', '=', 'listo')
          .execute(),
      );
      const terminadas = await ctx.paso('derivar_comandas', () =>
        derivarComandas(ctx.tx, organizacionId, comandaIds, ctx.ahora),
      );
      await ctx.paso('recalcular_lineas', () =>
        recalcularEstadoDeLineas(ctx.tx, organizacionId, comandaIds),
      );
      if (terminadas.length > 0) {
        estadoMesa = await ctx.paso('avanzar_mesa', () =>
          sincronizarMesa(ctx.tx, {
            organizacionId,
            ordenId: entrada.ordenId,
            mesaId: orden.mesaId,
            comandasMovidas: terminadas,
            estadoComanda: 'entregado',
            empleoId,
            ahora: ctx.ahora,
          }),
        );
      }
    }

    const estaciones = [
      ...new Set(listos.map((p) => p.estacionNombre).filter((n): n is string => n !== null)),
    ];
    ctx.auditar({
      entidadId: entrada.ordenId,
      payload: { entregadas: comandaIds.length, platillos: listos.length, estaciones, estadoMesa },
    });
    return {
      ordenId: entrada.ordenId,
      entregadas: comandaIds,
      estaciones,
      platillos: listos.length,
      estadoMesa,
    };
  },
});

interface PlatilloListo {
  readonly id: string;
  readonly comandaId: string;
  readonly estacionNombre: string | null;
}

async function platillosListosDeLaCuenta(
  tx: Transaccion,
  organizacionId: string,
  ordenId: string,
  comandaIds: readonly string[] | undefined,
): Promise<readonly PlatilloListo[]> {
  let comandas = tx
    .selectFrom('comandas')
    .select(['id', 'estacion_nombre as estacionNombre'])
    .where('organizacion_id', '=', organizacionId)
    .where('orden_id', '=', ordenId);
  if (comandaIds !== undefined) comandas = comandas.where('id', 'in', [...comandaIds]);
  const deLaCuenta = await comandas.execute();
  if (deLaCuenta.length === 0) return [];

  const platillos = await tx
    .selectFrom('comanda_items')
    .select(['id', 'comanda_id as comandaId'])
    .where('organizacion_id', '=', organizacionId)
    .where(
      'comanda_id',
      'in',
      deLaCuenta.map((c) => c.id),
    )
    .where('estado', '=', 'listo')
    .execute();
  const estacionDe = new Map(deLaCuenta.map((c) => [c.id, c.estacionNombre]));
  return platillos.map((p) => ({
    id: p.id,
    comandaId: p.comandaId,
    estacionNombre: estacionDe.get(p.comandaId) ?? null,
  }));
}

/**
 * Una comanda a la que ya no le queda ningún platillo por entregar queda ENTREGADA. La que aún
 * tiene platillos en el fuego sigue como estaba. Devuelve las que terminaron: sólo esas mueven la
 * mesa.
 */
async function derivarComandas(
  tx: Transaccion,
  organizacionId: string,
  comandaIds: readonly string[],
  ahora: Date,
): Promise<readonly string[]> {
  const terminadas: string[] = [];
  for (const comandaId of comandaIds) {
    const platillos = await tx
      .selectFrom('comanda_items')
      .select('estado')
      .where('organizacion_id', '=', organizacionId)
      .where('comanda_id', '=', comandaId)
      .execute();
    const pendientes = platillos.some((p) => p.estado !== 'entregado' && p.estado !== 'cancelado');
    if (pendientes) continue;
    const resultado = await tx
      .updateTable('comandas')
      .set({ estado: 'entregado', entregada_en: ahora })
      .where('organizacion_id', '=', organizacionId)
      .where('id', '=', comandaId)
      .where('estado', '=', 'listo')
      .executeTakeFirst();
    if (Number(resultado.numUpdatedRows) === 1) terminadas.push(comandaId);
  }
  return terminadas;
}
