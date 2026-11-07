import 'server-only';

import type { EstadoDelCosto } from '@morphiqpos/domain/venta';
import { sql, type RawBuilder } from 'kysely';

/**
 * ¿SE CONOCE EL COSTO DE LO VENDIDO? La regla del servidor (DP-13.2), una sola.
 *
 * Al cobrar se guarda una foto del costo, y un platillo SIN receta entra con costo cero
 * (`productos.costo_unitario_centavos` es `not null default 0`). Por eso una cuenta sin receta
 * salía con «100 % de margen», y una cuenta con un platillo con receta y otro sin ella, con un
 * margen inflado: el costo del que no tiene receta contaba como cero.
 *
 *   · Una LÍNEA con importe y costo cero no tiene costo conocido (la cortesía en $0 no cuenta).
 *   · Una CUENTA con todas sus líneas así es «sin receta»; con algunas, «receta incompleta»; con
 *     ninguna, su costo se conoce.
 *
 * El corte (`consultas.ts`), el puente (`puente/consultar.ts`, para Caja, el Cierre del día, el
 * corte heredado y el CSV de Registros) y las pantallas nuevas leen ESTO; ninguna pantalla vuelve a
 * decidirlo. El margen de un periodo sale sólo de las cuentas con costo conocido, y se dice
 * cuántas quedaron fuera.
 *
 * LÍMITE CONOCIDO (DP-14.6-2): el insumo en cero se lee de la receta y del costo VIVOS del insumo,
 * no de una foto congelada en la línea (la línea sólo guarda el costo total de la receta al
 * cobrar, y congelar la marca pediría una columna nueva). Si más tarde el negocio le pone costo a
 * ese insumo, un corte ya cerrado se relee como «conocido» con el costo congelado parcial, y al
 * revés si lo vuelve a poner en cero. Una venta sin receta (`lineaSinCosto`) sí es histórica.
 */

/** La línea `l` (una fila de `orden_lineas`) se vendió con importe y sin costo. */
export const lineaSinCosto = (l: string): RawBuilder<boolean> =>
  sql<boolean>`(${sql.ref(`${l}.total_centavos`)} > 0
                and ${sql.ref(`${l}.costo_unitario_centavos`)} <= 0)`;

/**
 * DP-14.6-2 · La línea `l` vende un platillo con receta cuyo costo NO está completo: alguno de los
 * insumos de su receta activa tiene costo cero. El costo congelado en la línea sólo suma los que
 * sí lo tienen, y el margen sale inflado aunque el costo no sea cero.
 */
export const lineaConInsumoSinCosto = (l: string): RawBuilder<boolean> =>
  sql<boolean>`exists (
    select 1
      from recetas rc
      join insumos ic
        on ic.id = rc.insumo_id and ic.organizacion_id = rc.organizacion_id
     where rc.organizacion_id = ${sql.ref(`${l}.organizacion_id`)}
       and rc.producto_id = ${sql.ref(`${l}.producto_id`)}
       and rc.activa
       and ic.costo_unitario_centavos <= 0)`;

/** La línea no tiene el costo completo: ninguno (sin receta) o le falta el de un insumo. */
export const lineaSinCostoCompleto = (l: string): RawBuilder<boolean> =>
  sql<boolean>`(${lineaSinCosto(l)} or ${lineaConInsumoSinCosto(l)})`;

/** El estado del costo de la cuenta `o` (una fila de `ordenes`), por sus líneas vivas. */
export const estadoDelCostoDe = (o: string): RawBuilder<EstadoDelCosto> =>
  sql<EstadoDelCosto>`(
    select case
             when count(*) filter (where ${lineaSinCostoCompleto('lc')}) = 0 then 'conocido'
             when count(*) filter (where not ${lineaSinCosto('lc')}) = 0 then 'sin_receta'
             else 'receta_incompleta'
           end
      from orden_lineas lc
     where lc.organizacion_id = ${sql.ref(`${o}.organizacion_id`)}
       and lc.orden_id = ${sql.ref(`${o}.id`)}
       and lc.anulada_en is null
       and lc.total_centavos > 0)`;
