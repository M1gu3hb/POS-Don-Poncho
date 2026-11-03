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
 */

/** La línea `l` (una fila de `orden_lineas`) se vendió con importe y sin costo. */
export const lineaSinCosto = (l: string): RawBuilder<boolean> =>
  sql<boolean>`(${sql.ref(`${l}.total_centavos`)} > 0
                and ${sql.ref(`${l}.costo_unitario_centavos`)} <= 0)`;

/** El estado del costo de la cuenta `o` (una fila de `ordenes`), por sus líneas vivas. */
export const estadoDelCostoDe = (o: string): RawBuilder<EstadoDelCosto> =>
  sql<EstadoDelCosto>`(
    select case
             when count(*) filter (where ${lineaSinCosto('lc')}) = 0 then 'conocido'
             when count(*) filter (where not ${lineaSinCosto('lc')}) = 0 then 'sin_receta'
             else 'receta_incompleta'
           end
      from orden_lineas lc
     where lc.organizacion_id = ${sql.ref(`${o}.organizacion_id`)}
       and lc.orden_id = ${sql.ref(`${o}.id`)}
       and lc.anulada_en is null
       and lc.total_centavos > 0)`;
