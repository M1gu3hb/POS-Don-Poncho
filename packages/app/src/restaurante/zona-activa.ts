import 'server-only';

import { ErrorDominio, PAQUETES_RESTAURANTE } from '@morphiqpos/contracts';
import type { Transaccion } from '@morphiqpos/data';
import { sql } from 'kysely';
import { z } from 'zod';

import { definirComando, type ContextoComando } from '../definicion.ts';

/**
 * DP-15.1 · DESACTIVAR Y REACTIVAR UNA ZONA DEL SALÓN.
 *
 * Las zonas se creaban y renombraban; una que ya no se usa («Terraza» en invierno) sólo podía
 * quedarse estorbando. La regla, una sola vez y en el servidor:
 *
 *   · Desactivar: no se deja si alguna mesa de la zona está ocupada, tiene cuenta abierta o está
 *     unida a otra (error claro, con los números). Si todas están libres, se apagan con la zona:
 *     dejan de mostrarse en el plano del mesero y el portal QR las rechaza (`activa`).
 *   · Reactivar: vuelven EXACTAMENTE las que se apagaron con la zona. La memoria de cuáles fueron
 *     está en la auditoría de esa desactivación (`mesasDesactivadas`): una mesa que alguien ya
 *     había dado de baja antes no resucita. Sin migración: no hacía falta una columna nueva.
 *   · Si al reactivar el nombre ya lo tiene otra zona activa, o el número de una mesa ya lo usa
 *     otra mesa activa (índice `mesas_numero_unico`), no se reactiva a medias: se dice qué choca.
 *
 * La zona es del negocio (catálogo), así que aplica a las mesas de todas sus sucursales.
 */

const QUIEN_LA_CAMBIA = ['dueno', 'administrador', 'gerente'] as const;

export const entradaFijarZonaActiva = z.object({
  zonaId: z.uuid(),
  activa: z.boolean(),
});

export interface ResultadoZonaActiva {
  readonly zonaId: string;
  readonly activa: boolean;
  /** Cuántas mesas se apagaron (al desactivar) o volvieron (al reactivar). */
  readonly mesasAfectadas: number;
  /**
   * DP-16 · Algo que la persona debe saber y no es un error: al reactivar, que no se encontró qué
   * mesas volver (o volvieron menos de las que se apagaron). `null` si todo cuadró.
   */
  readonly aviso: string | null;
}

interface ZonaCargada {
  readonly id: string;
  readonly nombre: string;
}

const lista = (numeros: readonly number[]): string =>
  numeros.length === 1 ? `la mesa ${String(numeros[0])}` : `las mesas ${numeros.join(', ')}`;

/** Los números de las mesas activas de la zona que NO están libres y sueltas. */
async function mesasEnUso(
  tx: Transaccion,
  organizacionId: string,
  zonaId: string,
): Promise<readonly number[]> {
  const filas = await tx
    .selectFrom('mesas')
    .select('numero')
    .where('organizacion_id', '=', organizacionId)
    .where('zona_id', '=', zonaId)
    .where('activa', '=', true)
    .where((eb) =>
      eb.or([
        eb('estado', '<>', 'libre'),
        eb('orden_activa_id', 'is not', null),
        eb('unida_a_mesa_id', 'is not', null),
      ]),
    )
    .orderBy('numero')
    .forUpdate()
    .execute();
  return filas.map((f) => f.numero);
}

/** Los ids que apagó la última desactivación de esta zona, según su rastro. */
async function mesasQueSeApagaron(
  tx: Transaccion,
  organizacionId: string,
  zonaId: string,
): Promise<readonly string[] | null> {
  const { rows } = await sql<{ ids: unknown }>`
    select a.payload -> 'mesasDesactivadas' as ids
      from auditoria a
     where a.organizacion_id = ${organizacionId}
       and a.accion = 'restaurante.fijar_zona_activa'
       and a.entidad_id = ${zonaId}
       and a.payload ->> 'activa' = 'false'
       -- Un «ya estaba apagada» también queda en el rastro, pero sin la lista: no es la desactivación.
       and a.payload -> 'mesasDesactivadas' is not null
     order by a.id desc
     limit 1
  `.execute(tx);
  const ids = rows[0]?.ids;
  // `null`: no hay rastro de esa desactivación (la zona se apagó sin él): no se sabe qué volver.
  return Array.isArray(ids) ? ids.filter((i): i is string => typeof i === 'string') : null;
}

async function desactivar(ctx: ContextoComando<Transaccion>, zona: ZonaCargada): Promise<number> {
  const { organizacionId } = ctx.ambito;
  const enUso = await ctx.paso('mirar_mesas_en_uso', () =>
    mesasEnUso(ctx.tx, organizacionId, zona.id),
  );
  if (enUso.length > 0) {
    throw new ErrorDominio(
      'ZONA_CON_MESAS_OCUPADAS',
      `La zona «${zona.nombre}» tiene ${lista(enUso)} ocupada${enUso.length === 1 ? '' : 's'}, ` +
        'con cuenta abierta o unida. Cóbralas, libéralas o sepáralas antes de desactivar la zona.',
      { mesas: enUso.join(', ') },
    );
  }
  const apagadas = await ctx.paso('apagar_mesas', () =>
    ctx.tx
      .updateTable('mesas')
      .set({ activa: false })
      .where('organizacion_id', '=', organizacionId)
      .where('zona_id', '=', zona.id)
      .where('activa', '=', true)
      .returning('id')
      .execute(),
  );
  await ctx.paso('apagar_zona', () =>
    ctx.tx
      .updateTable('zonas')
      .set({ activa: false })
      .where('organizacion_id', '=', organizacionId)
      .where('id', '=', zona.id)
      .execute(),
  );
  ctx.auditar({
    entidadId: zona.id,
    payload: {
      activa: false,
      nombre: zona.nombre,
      mesasDesactivadas: apagadas.map((m) => m.id),
    },
  });
  return apagadas.length;
}

async function exigirNombreLibre(
  ctx: ContextoComando<Transaccion>,
  zona: ZonaCargada,
): Promise<void> {
  const { organizacionId } = ctx.ambito;
  const repetida = await ctx.paso('nombre_libre', async () => {
    const { rows } = await sql<{ id: string }>`
      select z.id::text as id
        from zonas z
       where z.organizacion_id = ${organizacionId}
         and z.activa
         and z.id <> ${zona.id}
         and lower(regexp_replace(trim(z.nombre), '\\s+', ' ', 'g'))
           = lower(regexp_replace(trim(${zona.nombre}), '\\s+', ' ', 'g'))
       limit 1
    `.execute(ctx.tx);
    return rows[0];
  });
  if (repetida !== undefined) {
    throw new ErrorDominio(
      'ZONA_NO_REACTIVABLE',
      `Ya hay otra zona «${zona.nombre}» activa. Cámbiale el nombre a una de las dos.`,
    );
  }
}

/** Lo que se le dice a quien reactiva cuando las mesas que volvieron no son las que se apagaron. */
export function avisoDeLaReactivacion(
  rastro: readonly string[] | null,
  volvieron: number,
): string | null {
  if (rastro === null) {
    return 'La zona volvió, pero no hay registro de qué mesas se apagaron con ella: enciende sus mesas desde el plano.';
  }
  if (volvieron < rastro.length) {
    return `Volvieron ${String(volvieron)} de las ${String(rastro.length)} mesas que se apagaron con la zona; las otras ya no están o ya estaban encendidas. Revisa el plano.`;
  }
  return null;
}

async function reactivar(
  ctx: ContextoComando<Transaccion>,
  zona: ZonaCargada,
): Promise<{ readonly volvieron: number; readonly aviso: string | null }> {
  const { organizacionId } = ctx.ambito;
  await exigirNombreLibre(ctx, zona);
  const rastro = await ctx.paso('recordar_mesas', () =>
    mesasQueSeApagaron(ctx.tx, organizacionId, zona.id),
  );
  const ids = rastro ?? [];
  const volver =
    ids.length === 0
      ? []
      : await ctx.paso('mesas_que_vuelven', () =>
          ctx.tx
            .selectFrom('mesas')
            .select(['id', 'numero'])
            .where('organizacion_id', '=', organizacionId)
            .where('zona_id', '=', zona.id)
            .where('activa', '=', false)
            .where('id', 'in', [...ids])
            .orderBy('numero')
            .forUpdate()
            .execute(),
        );
  if (volver.length > 0) {
    const choques = await ctx.paso('numeros_libres', () =>
      ctx.tx
        .selectFrom('mesas')
        .select('numero')
        .where('organizacion_id', '=', organizacionId)
        .where('activa', '=', true)
        .where(
          'numero',
          'in',
          volver.map((m) => m.numero),
        )
        .orderBy('numero')
        .execute(),
    );
    if (choques.length > 0) {
      const primero = choques[0]?.numero ?? 0;
      throw new ErrorDominio(
        'ZONA_NO_REACTIVABLE',
        `No se puede reactivar «${zona.nombre}»: ya hay otra mesa ${String(primero)} activa. ` +
          'Cámbiale el número a una de las dos.',
        { mesas: choques.map((c) => c.numero).join(', ') },
      );
    }
    await ctx.paso('encender_mesas', () =>
      ctx.tx
        .updateTable('mesas')
        .set({ activa: true })
        .where('organizacion_id', '=', organizacionId)
        .where(
          'id',
          'in',
          volver.map((m) => m.id),
        )
        .execute(),
    );
  }
  await ctx.paso('encender_zona', () =>
    ctx.tx
      .updateTable('zonas')
      .set({ activa: true })
      .where('organizacion_id', '=', organizacionId)
      .where('id', '=', zona.id)
      .execute(),
  );
  ctx.auditar({
    entidadId: zona.id,
    payload: { activa: true, nombre: zona.nombre, mesasReactivadas: volver.map((m) => m.id) },
  });
  return { volvieron: volver.length, aviso: avisoDeLaReactivacion(rastro, volver.length) };
}

export const fijarZonaActiva = definirComando<
  Transaccion,
  typeof entradaFijarZonaActiva,
  ResultadoZonaActiva
>({
  nombre: 'restaurante.fijar_zona_activa',
  entidad: 'zona',
  escribe: true,
  roles: [...QUIEN_LA_CAMBIA],
  paquetes: PAQUETES_RESTAURANTE,
  modulo: 'mesas',
  entrada: entradaFijarZonaActiva,
  async ejecutar(ctx, entrada) {
    const { organizacionId } = ctx.ambito;
    const zona = await ctx.paso('cargar_zona', () =>
      ctx.tx
        .selectFrom('zonas')
        .select(['id', 'nombre', 'activa'])
        .where('organizacion_id', '=', organizacionId)
        .where('id', '=', entrada.zonaId)
        .forUpdate()
        .executeTakeFirst(),
    );
    if (zona === undefined) {
      throw new ErrorDominio('ZONA_NO_ENCONTRADA', 'Esa zona no existe.');
    }

    // Dos toques al mismo botón describen el mismo hecho: el segundo no es un error.
    if (zona.activa === entrada.activa) {
      ctx.auditar({ entidadId: zona.id, payload: { activa: entrada.activa, yaEstaba: true } });
      return { zonaId: zona.id, activa: zona.activa, mesasAfectadas: 0, aviso: null };
    }

    if (entrada.activa) {
      const { volvieron, aviso } = await reactivar(ctx, zona);
      return { zonaId: zona.id, activa: true, mesasAfectadas: volvieron, aviso };
    }
    const apagadas = await desactivar(ctx, zona);
    return { zonaId: zona.id, activa: false, mesasAfectadas: apagadas, aviso: null };
  },
});
