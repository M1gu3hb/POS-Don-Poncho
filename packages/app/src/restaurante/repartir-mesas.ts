import 'server-only';

import { ErrorDominio, PAQUETES_RESTAURANTE } from '@morphiqpos/contracts';
import type { Transaccion } from '@morphiqpos/data';
import { z } from 'zod';

import { definirComando } from '../definicion.ts';

/**
 * `restaurante.repartir_mesas` — DP-14 · asignar varias mesas a un mesero de una vez.
 *
 * Asignar una mesa a su mesero ya existía, una por una, desde el editor de la mesa (la escritura
 * directa del puente). Con veinte mesas y un turno que cambia, repartirlas era veinte diálogos.
 * Esto es el mismo hecho —`mesas.empleado_asignado_id`— para varias mesas en UNA transacción: o
 * quedan todas con su mesero o no cambia ninguna, y la auditoría dice quién repartió qué.
 *
 * `mesero: null` las deja SIN ASIGNAR, que es como se quedan las de un mesero que se va y como las
 * ve todo el salón (`lib/asignacionMesas.js`).
 *
 * No toca `empleado_atiende_id` (quién la atiende ahora): eso es de `asignar_mesero`, otra
 * decisión.
 */

const ROLES = ['dueno', 'administrador', 'gerente'] as const;

/** Un salón grande tiene decenas de mesas; el tope evita una petición sin fondo. */
const TOPE_DE_MESAS = 200;

export const entradaRepartirMesas = z.object({
  /** El empleo del mesero, o `null` para dejarlas sin asignar. */
  mesero: z.uuid().nullable(),
  mesaIds: z.array(z.uuid()).min(1).max(TOPE_DE_MESAS),
});

export interface ResultadoRepartirMesas {
  readonly mesero: string | null;
  readonly mesas: number;
}

export const repartirMesas = definirComando<
  Transaccion,
  typeof entradaRepartirMesas,
  ResultadoRepartirMesas
>({
  nombre: 'restaurante.repartir_mesas',
  entidad: 'mesa',
  escribe: true,
  roles: [...ROLES],
  paquetes: PAQUETES_RESTAURANTE,
  sucursal: { 'mesaIds[]': 'mesas' },
  sinFrontera: {
    mesero:
      'El equipo es del negocio: el mesero se valida contra la organización y su puesto, no por sucursal.',
  },
  modulo: 'mesas',
  entrada: entradaRepartirMesas,
  async ejecutar(ctx, entrada) {
    const { organizacionId } = ctx.ambito;
    const ids = [...new Set(entrada.mesaIds)];

    if (entrada.mesero !== null) {
      // Con candado en su fila: una baja a la vez (que suelta sus mesas) espera a este reparto, o
      // este espera a la baja y ya no lo encuentra activo. Nunca quedan mesas de quien se fue.
      const mesero = await ctx.paso('cargar_mesero', () =>
        ctx.tx
          .selectFrom('empleos')
          .select('id')
          .where('id', '=', entrada.mesero ?? '')
          .where('organizacion_id', '=', organizacionId)
          .where('rol', '=', 'mesero')
          .where('activo', '=', true)
          .forUpdate()
          .executeTakeFirst(),
      );
      if (mesero === undefined) {
        throw new ErrorDominio(
          'ACCESO_NO_ENCONTRADO',
          'Ese mesero no existe, está dado de baja o no es mesero.',
        );
      }
    }

    // Las mesas se piden TODAS, de este negocio y en el mapa: una ajena o quitada no se reparte, y
    // se dice cuál faltó en vez de repartir las demás en silencio.
    const encontradas = await ctx.paso('cargar_mesas', () =>
      ctx.tx
        .selectFrom('mesas')
        .select(['id', 'numero'])
        .where('organizacion_id', '=', organizacionId)
        .where('activa', '=', true)
        .where('id', 'in', ids)
        .execute(),
    );
    if (encontradas.length !== ids.length) {
      throw new ErrorDominio(
        'MESA_NO_ENCONTRADA',
        'Alguna de las mesas ya no está en el mapa. Actualiza la pantalla e inténtalo otra vez.',
      );
    }

    await ctx.paso('repartir', () =>
      ctx.tx
        .updateTable('mesas')
        .set({ empleado_asignado_id: entrada.mesero, updated_at: ctx.ahora })
        .where('organizacion_id', '=', organizacionId)
        .where('id', 'in', ids)
        .execute(),
    );

    ctx.auditar({
      entidadId: null,
      payload: {
        mesero: entrada.mesero,
        mesas: encontradas.map((m) => m.numero).sort((a, b) => a - b),
        cantidad: encontradas.length,
      },
    });

    return { mesero: entrada.mesero, mesas: encontradas.length };
  },
});
