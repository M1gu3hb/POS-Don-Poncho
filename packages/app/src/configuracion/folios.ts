import 'server-only';

import { ErrorDominio, PAQUETES } from '@morphiqpos/contracts';
import { repoFolios, type Transaccion } from '@morphiqpos/data';
import { prefijoDeFolioValido, SERIE_DE_CORTES, SERIE_DE_CUENTAS } from '@morphiqpos/domain/venta';
import { sql } from 'kysely';

import { definirComando } from '../definicion.ts';
import { exigirQueNoHayaOperacionReal } from '../mantenimiento/operacion-real.ts';
import { guardarConfiguracionParcial } from '../puente/configuracion.ts';
import { CLAVE_DE_FOLIOS, esquemaDeFolios, type FoliosDelNegocio } from './folios-del-negocio.ts';
import { leerFoliosDelNegocio } from './folios-leidos.ts';

/**
 * «PREFIJO DEL FOLIO» y «PRIMER FOLIO» de Configuración → Ticket y folios (DP-21 · Bloque 6).
 *
 * Los guarda sólo el dueño, por este comando, con su antes y su después en la auditoría.
 *
 *   · El PREFIJO («DP») sólo cambia cómo se LEE el folio: se puede cambiar siempre.
 *   · El PRIMER FOLIO de cada serie (cuentas `A`, cortes `CC`) sólo se cambia con los folios en
 *     cero —ninguna cuenta ni corte con folio de esa serie— y mientras el negocio no opere de
 *     verdad (`exigirQueNoHayaOperacionReal`). Al guardarlo, el contador de esa serie (el mismo
 *     de siempre, `folios`) queda listo para que el SIGUIENTE folio sea ése.
 */

/** Cuántos folios se han dado en la serie del negocio: cuentas con folio o cortes con folio. */
async function foliosDados(
  tx: Transaccion,
  organizacionId: string,
  serie: string,
): Promise<number> {
  const r =
    serie === SERIE_DE_CUENTAS
      ? await sql<{ n: number }>`
          select count(*)::int n from ordenes
           where organizacion_id = ${organizacionId} and serie = ${serie} and folio is not null`.execute(
          tx,
        )
      : await sql<{ n: number }>`
          select count(*)::int n from sesiones_caja
           where organizacion_id = ${organizacionId} and serie = ${serie} and folio is not null`.execute(
          tx,
        );
  return r.rows[0]?.n ?? 0;
}

export const entradaFijarFolios = esquemaDeFolios;

export const fijarFolios = definirComando<Transaccion, typeof entradaFijarFolios, FoliosDelNegocio>(
  {
    nombre: 'configuracion.fijar_folios',
    entidad: 'configuracion',
    escribe: true,
    roles: ['dueno'],
    paquetes: PAQUETES,
    entrada: entradaFijarFolios,
    async ejecutar(ctx, entrada) {
      const { organizacionId } = ctx.ambito;
      const prefijo = prefijoDeFolioValido(entrada.prefijo);
      if (!prefijo.ok) throw new ErrorDominio('CONFIGURACION_INVALIDA', prefijo.mensaje);
      const despues: FoliosDelNegocio = {
        prefijo: prefijo.prefijo,
        primerFolioDeCuentas: entrada.primerFolioDeCuentas,
        primerFolioDeCortes: entrada.primerFolioDeCortes,
      };
      const antes = await ctx.paso('leer', () => leerFoliosDelNegocio(ctx.tx, organizacionId));

      const series = [
        {
          serie: SERIE_DE_CUENTAS,
          nombre: 'cuentas',
          antes: antes.primerFolioDeCuentas,
          despues: despues.primerFolioDeCuentas,
        },
        {
          serie: SERIE_DE_CORTES,
          nombre: 'cortes',
          antes: antes.primerFolioDeCortes,
          despues: despues.primerFolioDeCortes,
        },
      ].filter((s) => s.antes !== s.despues);

      if (series.length > 0) {
        await ctx.paso('sin_operacion_real', () =>
          exigirQueNoHayaOperacionReal(ctx.tx, organizacionId, ctx.ahora),
        );
        for (const s of series) {
          // Primero se reubica el contador (eso toma el candado de su fila) y DESPUÉS se cuenta:
          // un cobro a medio camino ya terminó, y si dejó un folio, esto se revierte entero.
          await ctx.paso(`contador_${s.serie}`, () =>
            repoFolios.fijarSiguienteFolio(ctx.tx, organizacionId, s.serie, BigInt(s.despues)),
          );
          const dados = await ctx.paso(`dados_${s.serie}`, () =>
            foliosDados(ctx.tx, organizacionId, s.serie),
          );
          if (dados > 0) {
            throw new ErrorDominio(
              'CONFIGURACION_CONFLICTO',
              `Ya hay ${String(dados)} ${s.nombre} con folio: el primer folio de las ${s.nombre} sólo se cambia con los folios en cero.`,
            );
          }
        }
      }

      await ctx.paso('guardar', () =>
        guardarConfiguracionParcial(
          ctx.tx,
          organizacionId,
          { [CLAVE_DE_FOLIOS]: despues },
          { desdeComando: true },
        ),
      );
      ctx.auditar({ entidadId: null, payload: { antes, despues } });
      return despues;
    },
  },
);
