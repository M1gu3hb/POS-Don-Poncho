import 'server-only';

import { ErrorDominio, PAQUETES_TODOS } from '@morphiqpos/contracts';
import type { Esquema, Transaccion } from '@morphiqpos/data';
import { sql, type Kysely } from 'kysely';
import { z } from 'zod';

import { definirComando } from '../comando.ts';
import type { ResultadoMantenimiento } from './comandos.ts';
import { exigirNombreDelNegocio } from './confirmacion.ts';
import { exigirPlataforma } from './plataforma.ts';

/**
 * DP-18 · 1.6 · DEJAR PRODUCCIÓN EN CEROS después de las pruebas de Miguel (`scripts/dejar-en-ceros.mjs`).
 *
 * Dos piezas:
 *   · `loQueHayParaDejarEnCeros` cuenta lo que hay (y lo que hay ANTES del día dado) para que el
 *     guion se niegue si algo no es de prueba: una cuenta, una caja o un pago de antes, o más cuentas
 *     cobradas de las que se le dijeron;
 *   · `mantenimiento.reiniciar_folios`: el siguiente ticket (y el siguiente corte) vuelven a 1. Se
 *     niega si todavía hay una cuenta o un corte con folio: primero se purgan, o los números chocarían.
 * El número para llevar sale de las cuentas del día (`numero-para-llevar.ts`): sin cuentas, empieza
 * en 1 solo. La auditoría no se toca.
 */

export interface LoQueHay {
  readonly conteos: {
    readonly cuentas: number;
    readonly cobradas: number;
    readonly pagos: number;
    readonly cajas: number;
    readonly cortes: number;
    readonly comandas: number;
    readonly carritos: number;
    readonly movimientosDeCaja: number;
    readonly inventarioDeVentas: number;
    readonly foliosUsados: number;
  };
  readonly anteriores: { readonly cuentas: number; readonly cajas: number; readonly pagos: number };
}

const contar = async (db: Kysely<Esquema>, consulta: ReturnType<typeof sql<{ n: number }>>) =>
  (await consulta.execute(db)).rows[0]?.n ?? 0;

/** Lo que hay del negocio, y lo que hay de antes del día `desde` (AAAA-MM-DD en su zona). */
export async function loQueHayParaDejarEnCeros(
  db: Kysely<Esquema>,
  organizacionId: string,
  desde: string,
): Promise<LoQueHay> {
  const org = organizacionId;
  const inicio = sql`(${desde}::date::timestamp at time zone (select zona_horaria from organizaciones where id = ${org}))`;
  const n = (consulta: ReturnType<typeof sql<{ n: number }>>) => contar(db, consulta);
  return {
    conteos: {
      cuentas: await n(sql`select count(*)::int n from ordenes where organizacion_id = ${org}`),
      cobradas: await n(
        sql`select count(*)::int n from ordenes where organizacion_id = ${org} and estado = 'pagada'`,
      ),
      pagos: await n(sql`select count(*)::int n from pagos where organizacion_id = ${org}`),
      cajas: await n(sql`select count(*)::int n from sesiones_caja where organizacion_id = ${org}`),
      cortes: await n(sql`select count(*)::int n from cortes_turno where organizacion_id = ${org}`),
      comandas: await n(sql`select count(*)::int n from comandas where organizacion_id = ${org}`),
      carritos: await n(
        sql`select count(*)::int n from carritos_mesa where organizacion_id = ${org}`,
      ),
      movimientosDeCaja: await n(
        sql`select count(*)::int n from movimientos_caja where organizacion_id = ${org}`,
      ),
      inventarioDeVentas: await n(
        sql`select count(*)::int n from movimientos_stock where organizacion_id = ${org} and referencia_tipo = 'orden'`,
      ),
      foliosUsados: await n(
        sql`select count(*)::int n from folios where organizacion_id = ${org} and siguiente > 1`,
      ),
    },
    anteriores: {
      cuentas: await n(
        sql`select count(*)::int n from ordenes where organizacion_id = ${org} and created_at < ${inicio}`,
      ),
      cajas: await n(
        sql`select count(*)::int n from sesiones_caja where organizacion_id = ${org} and abierta_en < ${inicio}`,
      ),
      pagos: await n(
        sql`select count(*)::int n from pagos where organizacion_id = ${org} and created_at < ${inicio}`,
      ),
    },
  };
}

/** Por qué NO es sólo lo de prueba (vacío si se puede dejar en ceros). */
export function motivosParaNoDejarEnCeros(hay: LoQueHay, ventasDePrueba: number): string[] {
  const motivos: string[] = [];
  if (hay.anteriores.cuentas > 0)
    motivos.push(`hay ${String(hay.anteriores.cuentas)} cuentas de antes`);
  if (hay.anteriores.cajas > 0) motivos.push(`hay ${String(hay.anteriores.cajas)} cajas de antes`);
  if (hay.anteriores.pagos > 0) motivos.push(`hay ${String(hay.anteriores.pagos)} pagos de antes`);
  if (hay.conteos.cobradas > ventasDePrueba) {
    motivos.push(
      `hay ${String(hay.conteos.cobradas)} cuentas cobradas y se dijo que las de prueba eran ${String(ventasDePrueba)}`,
    );
  }
  return motivos;
}

export const entradaReiniciarFolios = z.object({
  confirmacionNombreNegocio: z.string().trim().min(1).max(200),
});

export const reiniciarFolios = definirComando<
  Transaccion,
  typeof entradaReiniciarFolios,
  ResultadoMantenimiento
>({
  nombre: 'mantenimiento.reiniciar_folios',
  entidad: 'organizacion',
  escribe: true,
  roles: ['dueno'],
  paquetes: PAQUETES_TODOS,
  entrada: entradaReiniciarFolios,
  async ejecutar(ctx, entrada) {
    await exigirPlataforma(ctx.tx, ctx.ambito);
    const org = ctx.ambito.organizacionId;
    const negocio = await exigirNombreDelNegocio(ctx.tx, org, entrada.confirmacionNombreNegocio);
    const enUso = await ctx.paso('folios_en_uso', async () => {
      const r = await sql<{ n: number }>`
        select ((select count(*) from ordenes where organizacion_id = ${org} and folio is not null)
              + (select count(*) from sesiones_caja where organizacion_id = ${org} and folio is not null))::int n
      `.execute(ctx.tx);
      return r.rows[0]?.n ?? 0;
    });
    if (enUso > 0) {
      throw new ErrorDominio(
        'MANTENIMIENTO_NO_CONFIRMADO',
        `Todavía hay ${String(enUso)} cuentas o cortes con folio: purga primero las ventas y los cortes.`,
      );
    }
    const r = await ctx.paso('reiniciar', () =>
      ctx.tx
        .updateTable('folios')
        .set({ siguiente: 1n })
        .where('organizacion_id', '=', org)
        .where('siguiente', '<>', 1n)
        .executeTakeFirst(),
    );
    const reiniciados = Number(r.numUpdatedRows);
    ctx.auditar({ entidadId: org, payload: { reiniciados } });
    return { negocio, borrado: { folios: reiniciados } };
  },
});
