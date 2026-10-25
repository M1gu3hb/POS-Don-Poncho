import 'server-only';

import type { Transaccion } from '@morphiqpos/data';
import { sql } from 'kysely';

/**
 * LO PROPIO DEL RESTAURANTE en su corte (C.6 de la 2.4), según su `02-DINERO-Y-CAJA.md` §9.3:
 * la propina repartida por mesero. Acotada a la organización y a la sesión.
 *
 * POS Don Poncho (DP-2): las consultas de los otros cuatro giros se fueron con ellos.
 */

// ── Restaurante ─────────────────────────────────────────────────────────────

export interface PropinaDeMesero {
  readonly mesero: string | null;
  readonly propinaCentavos: string;
  readonly cuentas: number;
}

export async function propinasPorMesero(
  tx: Transaccion,
  organizacionId: string,
  sesionCajaId: string,
): Promise<readonly PropinaDeMesero[]> {
  const { rows } = await sql<PropinaDeMesero>`
    select ev.nombre                          as "mesero",
           sum(p.propina_centavos)::text      as "propinaCentavos",
           count(distinct o.id)::int          as "cuentas"
      from pagos p
      join ordenes o on o.id = p.orden_id and o.organizacion_id = p.organizacion_id
      left join empleados_visibles ev on ev.id = o.empleado_atiende_id
     where p.organizacion_id = ${organizacionId}
       and p.sesion_caja_id = ${sesionCajaId}
       and p.estado = 'confirmado'
       and p.propina_centavos > 0
     group by ev.nombre
     order by sum(p.propina_centavos) desc
  `.execute(tx);
  return rows;
}
