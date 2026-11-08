import 'server-only';

import { ErrorDominio, PAQUETES_MOSTRADOR } from '@morphiqpos/contracts';
import type { Transaccion } from '@morphiqpos/data';
import { sql } from 'kysely';
import { z } from 'zod';

import { definirComando } from '../definicion.ts';
import { violaIndice } from '../portal/errores-sql.ts';

/**
 * LAS TERMINALES DE LA SUCURSAL, CON SU NOMBRE (DP-14 · ronda 2, medio 3).
 *
 * Cada navegador que abre la caja se da de alta solo como «Caja N» (DP-14.2), y con dos cajas el
 * aviso «Ya se cobró en Caja 7» no le dice a nadie cuál es. El dueño o el administrador las ve en
 * Configuración → Caja —cuál tiene la caja abierta— y las nombra («Caja 1», «Barra»). Cada cambio
 * queda en la auditoría con el nombre de antes y el de después. El nombre es único en la sucursal
 * (índice `terminales_nombre_unico`, sin distinguir mayúsculas): se dice antes de chocar con él.
 */

const QUIEN_NOMBRA = ['dueno', 'administrador'] as const;

export interface TerminalDeLaSucursal {
  readonly id: string;
  readonly nombre: string;
  /** Tiene una caja abierta ahora. */
  readonly cajaAbierta: boolean;
}

export const entradaTerminales = z.object({});
export const entradaNombrarTerminal = z.object({
  /** La terminal que se nombra (no `terminalId`: ése es el del ámbito, de la sesión, R16). */
  terminal: z.uuid(),
  nombre: z.string().trim().min(1).max(40),
});

/** El nombre ya lo tiene otra caja de la sucursal: lo dice la comprobación y lo dice el índice. */
function nombreRepetido(nombre: string): ErrorDominio {
  return new ErrorDominio(
    'TERMINAL_NOMBRE_REPETIDO',
    `Ya hay otra caja que se llama «${nombre}». Elige otro nombre.`,
  );
}

function sucursalDe(sucursalId: string | null): string {
  if (sucursalId === null) {
    throw new ErrorDominio('VENTA_SIN_TERMINAL', 'Entra desde una sucursal para ver sus cajas.');
  }
  return sucursalId;
}

async function leerTerminales(
  tx: Transaccion,
  organizacionId: string,
  sucursalId: string,
): Promise<readonly TerminalDeLaSucursal[]> {
  const { rows } = await sql<TerminalDeLaSucursal>`
    select t.id::text as "id",
           t.nombre as "nombre",
           exists (select 1
                     from sesiones_caja s
                    where s.organizacion_id = t.organizacion_id
                      and s.terminal_id = t.id
                      and s.estado = 'abierta') as "cajaAbierta"
      from terminales t
     where t.organizacion_id = ${organizacionId}
       and t.sucursal_id = ${sucursalId}
       and t.activa
       -- Cada navegador que entra se da de alta como terminal (el teléfono del mesero, la tableta
       -- de cocina): sólo son cajas las que alguna vez abrieron una sesión de caja.
       and exists (select 1
                     from sesiones_caja s
                    where s.organizacion_id = t.organizacion_id
                      and s.terminal_id = t.id)
     order by lower(t.nombre), t.id
  `.execute(tx);
  return rows;
}

export const terminalesDeLaSucursal = definirComando<
  Transaccion,
  typeof entradaTerminales,
  { readonly terminales: readonly TerminalDeLaSucursal[] }
>({
  nombre: 'caja.terminales',
  entidad: 'terminal',
  escribe: false,
  roles: [...QUIEN_NOMBRA],
  paquetes: PAQUETES_MOSTRADOR,
  entrada: entradaTerminales,
  async ejecutar(ctx) {
    const sucursalId = sucursalDe(ctx.ambito.sucursalId);
    const terminales = await ctx.paso('leer_terminales', () =>
      leerTerminales(ctx.tx, ctx.ambito.organizacionId, sucursalId),
    );
    return { terminales };
  },
});

export const nombrarTerminal = definirComando<
  Transaccion,
  typeof entradaNombrarTerminal,
  TerminalDeLaSucursal
>({
  nombre: 'caja.nombrar_terminal',
  entidad: 'terminal',
  escribe: true,
  roles: [...QUIEN_NOMBRA],
  paquetes: PAQUETES_MOSTRADOR,
  entrada: entradaNombrarTerminal,
  async ejecutar(ctx, entrada) {
    const { organizacionId } = ctx.ambito;
    const sucursalId = sucursalDe(ctx.ambito.sucursalId);
    const antes = await ctx.paso('leer_terminal', () =>
      ctx.tx
        .selectFrom('terminales')
        .select(['id', 'nombre'])
        .where('organizacion_id', '=', organizacionId)
        .where('sucursal_id', '=', sucursalId)
        .where('id', '=', entrada.terminal)
        .forUpdate()
        .executeTakeFirst(),
    );
    if (antes === undefined) {
      throw new ErrorDominio('TERMINAL_NO_ENCONTRADA', 'Esa caja no es de esta sucursal.');
    }
    const repetida = await ctx.paso('nombre_libre', () =>
      ctx.tx
        .selectFrom('terminales')
        .select('id')
        .where('sucursal_id', '=', sucursalId)
        .where('id', '<>', entrada.terminal)
        .where(sql<boolean>`lower(nombre) = lower(${entrada.nombre})`)
        .executeTakeFirst(),
    );
    if (repetida !== undefined) throw nombreRepetido(entrada.nombre);
    await ctx.paso('nombrar', async () => {
      try {
        await ctx.tx
          .updateTable('terminales')
          .set({ nombre: entrada.nombre })
          .where('organizacion_id', '=', organizacionId)
          .where('id', '=', entrada.terminal)
          .execute();
      } catch (error: unknown) {
        // Dos renombres a la vez al mismo nombre: los dos pasaron `nombre_libre` y éste chocó con
        // el índice único. Es lo mismo que la comprobación de arriba, no un error interno.
        if (violaIndice(error, 'terminales_nombre_unico')) throw nombreRepetido(entrada.nombre);
        throw error;
      }
    });
    ctx.auditar({
      entidadId: entrada.terminal,
      payload: { antes: antes.nombre, despues: entrada.nombre },
    });
    const todas = await leerTerminales(ctx.tx, organizacionId, sucursalId);
    const nombrada = todas.find((t) => t.id === entrada.terminal);
    return nombrada ?? { id: entrada.terminal, nombre: entrada.nombre, cajaAbierta: false };
  },
});
