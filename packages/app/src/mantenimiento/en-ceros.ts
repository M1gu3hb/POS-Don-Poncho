import 'server-only';

import { ErrorDominio, PAQUETES_TODOS } from '@morphiqpos/contracts';
import { repoFolios, type Esquema, type Transaccion } from '@morphiqpos/data';
import { SERIE_DE_CORTES, SERIE_DE_CUENTAS } from '@morphiqpos/domain/venta';
import { sql, type Kysely } from 'kysely';
import { z } from 'zod';

import { definirComando } from '../comando.ts';
import { leerFoliosDelNegocio } from '../configuracion/folios-leidos.ts';
import type { ResultadoMantenimiento } from './comandos.ts';
import { exigirNombreDelNegocio } from './confirmacion.ts';
import { exigirQueNoHayaOperacionReal } from './operacion-real.ts';
import { exigirPlataforma } from './plataforma.ts';

/**
 * DP-18 · 1.6 · DEJAR PRODUCCIÓN EN CEROS después de las pruebas de Miguel (`scripts/dejar-en-ceros.mjs`).
 *
 * Dos piezas:
 *   · `loQueHayParaDejarEnCeros` cuenta lo que hay (y lo que hay ANTES del día dado) para que el
 *     guion se niegue si algo no es de prueba: una cuenta, una caja o un pago de antes, o más cuentas
 *     cobradas de las que se le dijeron;
 *   · `mantenimiento.reiniciar_folios`: el siguiente ticket y el siguiente corte vuelven a su «Primer
 *     folio» (1001 y 101 en Don Poncho; 1 y 1 si nadie lo cambió). SÓLO esas dos series (y la del
 *     corte de turno, `CT`, a 1): se niega si todavía hay una cuenta o un corte con folio —primero se
 *     purgan, o los números chocarían—, si hay movimientos en cualquier otra serie (remisiones,
 *     fiado, liquidaciones de propina…) y si el negocio ya opera de verdad (H1, `operacion-real.ts`).
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
  const primeros = await leerFoliosDelNegocio(db, org);
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
      // Un contador sólo está «usado» si pasó de su primer folio (1001 las cuentas, 101 los cortes).
      foliosUsados: await n(
        sql`select count(*)::int n from folios
             where organizacion_id = ${org}
               and siguiente > case serie
                     when ${SERIE_DE_CUENTAS} then ${primeros.primerFolioDeCuentas}::bigint
                     when ${SERIE_DE_CORTES} then ${primeros.primerFolioDeCortes}::bigint
                     else 1 end`,
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

/** La serie del arqueo parcial de un turno (`repos/caja.ts`): no se lee con prefijo, vuelve a 1. */
const SERIE_DEL_CORTE_DE_TURNO = 'CT';

/** Series que NO son cuentas ni cortes y ya dieron folios: las remisiones, el fiado, las liquidaciones. */
async function otrasSeriesConMovimientos(tx: Transaccion, org: string): Promise<string[]> {
  const series = await sql<{ serie: string }>`
    select distinct serie from folios
     where organizacion_id = ${org} and siguiente > 1
       and serie not in (${SERIE_DE_CUENTAS}, ${SERIE_DE_CORTES}, ${SERIE_DEL_CORTE_DE_TURNO})
     order by serie
  `.execute(tx);
  const nombres = series.rows.map((f) => f.serie);
  // Las liquidaciones de propina no llevan fila en `folios`: su consecutivo sale de su tabla.
  const liquidaciones = await sql<{ n: number }>`
    select count(*)::int n from liquidaciones_propina where organizacion_id = ${org}
  `.execute(tx);
  if ((liquidaciones.rows[0]?.n ?? 0) > 0) nombres.push('LIQ');
  return nombres.sort();
}

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
    await ctx.paso('sin_operacion_real', () =>
      exigirQueNoHayaOperacionReal(ctx.tx, org, ctx.ahora),
    );
    const negocio = await exigirNombreDelNegocio(ctx.tx, org, entrada.confirmacionNombreNegocio);
    const enUso = await ctx.paso('folios_en_uso', async () => {
      const r = await sql<{ n: number }>`
        select ((select count(*) from ordenes where organizacion_id = ${org} and folio is not null)
              + (select count(*) from sesiones_caja where organizacion_id = ${org} and folio is not null)
              + (select count(*) from cortes_turno where organizacion_id = ${org} and folio is not null))::int n
      `.execute(ctx.tx);
      return r.rows[0]?.n ?? 0;
    });
    if (enUso > 0) {
      throw new ErrorDominio(
        'MANTENIMIENTO_NO_CONFIRMADO',
        `Todavía hay ${String(enUso)} cuentas o cortes con folio: purga primero las ventas y los cortes.`,
      );
    }
    const otras = await ctx.paso('otras_series', () => otrasSeriesConMovimientos(ctx.tx, org));
    if (otras.length > 0) {
      throw new ErrorDominio(
        'MANTENIMIENTO_NO_CONFIRMADO',
        `Hay movimientos en otras series de folios (${otras.join(', ')}): no se reinician. Las cuentas y los cortes no se tocan.`,
      );
    }
    const folios = await leerFoliosDelNegocio(ctx.tx, org);
    const reiniciados = await ctx.paso('reiniciar', async () => {
      const cuentas = await repoFolios.fijarSiguienteFolio(
        ctx.tx,
        org,
        SERIE_DE_CUENTAS,
        BigInt(folios.primerFolioDeCuentas),
      );
      const cortes = await repoFolios.fijarSiguienteFolio(
        ctx.tx,
        org,
        SERIE_DE_CORTES,
        BigInt(folios.primerFolioDeCortes),
      );
      const deTurno = await ctx.tx
        .updateTable('folios')
        .set({ siguiente: 1n })
        .where('organizacion_id', '=', org)
        .where('serie', '=', SERIE_DEL_CORTE_DE_TURNO)
        .where('siguiente', '<>', 1n)
        .executeTakeFirst();
      return cuentas + cortes + Number(deTurno.numUpdatedRows);
    });
    ctx.auditar({
      entidadId: org,
      payload: {
        reiniciados,
        primerFolioDeCuentas: folios.primerFolioDeCuentas,
        primerFolioDeCortes: folios.primerFolioDeCortes,
      },
    });
    return { negocio, borrado: { folios: reiniciados } };
  },
});
