import 'server-only';

import type { Transaccion } from '@morphiqpos/data';

import { ajustarComandaAlMinimo } from './items.ts';
import { cerrarElMovimiento, type Paso } from './preparacion.ts';
import { ESTADOS_COMANDA_ACTIVOS, type EstadoComanda } from './transiciones.ts';

/**
 * Hallazgo 7 (DP-22) · La comanda que sigue viva tras quitar un platillo se ajusta a lo que queda.
 *
 * ── El defecto que cierra ───────────────────────────────────────────────────
 * La comanda se deriva del MÍNIMO de sus platos vivos (`ajustarComandaAlMinimo`). Marcar un plato
 * lo recalculaba, cobrar lo recalculaba, pero quitar un platillo sólo cancelaba la comanda si no le
 * quedaba ninguno. Con dos platos —uno ya «listo» y otro por preparar— el mesero quitaba el segundo
 * y la comanda seguía en «nuevo» aunque su único plato vivo estaba listo: la mesa no pasaba a
 * «Esperando entrega» y el mesero no recibía el aviso.
 *
 * ── Lo que hace ─────────────────────────────────────────────────────────────
 * Para cada comanda VIVA con platos de esa línea: la ajusta al mínimo de los platos que le quedan
 * (los cancelados no cuentan) y, si cambió de estado, sigue el MISMO cierre que cuando la estación
 * mueve un plato (`cerrarElMovimiento`: lo ya cobrado, las líneas de venta y la mesa). Si el estado
 * no cambió (el plato que queda sigue pendiente, o sólo se redujo una cantidad) no escribe nada.
 *
 * Va DESPUÉS de cancelar las comandas sin platillos, y con los candados ya tomados en el orden de
 * `candados-de-cocina.ts` (cuenta → comandas → platos → líneas): no toma nada nuevo.
 */
export async function ajustarComandasTrasAnular(
  tx: Transaccion,
  paso: Paso,
  datos: {
    readonly organizacionId: string;
    readonly lineaId: string;
    readonly empleoId: string | null;
    readonly ahora: Date;
  },
): Promise<readonly string[]> {
  const { organizacionId, lineaId, empleoId, ahora } = datos;
  const vivas = await tx
    .selectFrom('comandas')
    .select([
      'id',
      'estado',
      'orden_id as ordenId',
      'mesa_id as mesaId',
      'estacion_nombre as estacionNombre',
    ])
    .where('organizacion_id', '=', organizacionId)
    .where('estado', 'in', [...ESTADOS_COMANDA_ACTIVOS])
    .where('id', 'in', (eb) =>
      eb
        .selectFrom('comanda_items')
        .select('comanda_id')
        .where('organizacion_id', '=', organizacionId)
        .where('orden_linea_id', '=', lineaId),
    )
    .orderBy('id')
    .execute();

  const movidas: string[] = [];
  for (const fila of vivas) {
    const comanda = { ...fila, estado: fila.estado as EstadoComanda };
    const estadoComanda = await paso('ajustar_comanda', () =>
      ajustarComandaAlMinimo(tx, organizacionId, comanda.id, comanda.estado, ahora),
    );
    if (estadoComanda === comanda.estado) continue;
    await cerrarElMovimiento(tx, paso, { organizacionId, comanda, estadoComanda, empleoId, ahora });
    movidas.push(comanda.id);
  }
  return movidas;
}
