import 'server-only';

import { ErrorDominio, PAQUETES_MOSTRADOR } from '@morphiqpos/contracts';
import type { Esquema, Transaccion } from '@morphiqpos/data';
import type { Kysely } from 'kysely';
import { z } from 'zod';

import { definirComando } from '../definicion.ts';
import { guardarConfiguracionParcial } from '../puente/configuracion.ts';

/**
 * LOS LUGARES DE CAJA (DP-21 · Bloque 5 · M1 y O9).
 *
 * Lo que vio Miguel: «las cajas se suman (Caja 28, Caja 32, Caja 37…). Deben ser 1 o 2 fijas,
 * que se trasladen, y mejor con nombre». Cada aparato que entra crea una terminal, y ése era el
 * nombre que veía la caja.
 *
 * La caja ya no es el aparato:
 *
 *   · el cupo de la sucursal (`sucursales.cajas_simultaneas`) define los LUGARES: 1, 2…;
 *   · cada lugar tiene un nombre que pone el dueño («Caja principal», «Caja barra»), en
 *     `configuracion.valores.nombres_de_cajas`; sin nombre, «Caja 1», «Caja 2»;
 *   · la sesión de caja guarda en qué lugar abrió (`sesiones_caja.lugar`, la 193) y un índice
 *     único no deja dos abiertas en el mismo lugar;
 *   · el nombre nunca cambia por el aparato: al trasladar la caja (`caja.traer`) el lugar viaja
 *     con ella. Ticket, corte, Registros y «abierta en…» dicen «Caja principal».
 *
 * Los aparatos tienen su propio nombre («Aparato N», o el que les pongan en Configuración →
 * Este aparato) y nunca se enseñan como si fueran una caja.
 */

export const CLAVE_NOMBRES_DE_CAJAS = 'nombres_de_cajas';
/** El cupo de la base va de 1 a 4 (la 179): no hay más lugares que ésos. */
export const LUGARES_MAXIMOS = 4;
const LARGO_MAXIMO_DEL_NOMBRE = 40;

/** Los nombres guardados, por lugar (el primero es el del lugar 1). Lo que no se entienda, sin nombre. */
export function nombresDeCajasEn(valores: unknown): readonly (string | null)[] {
  if (typeof valores !== 'object' || valores === null || Array.isArray(valores)) return [];
  const guardados = (valores as Record<string, unknown>)[CLAVE_NOMBRES_DE_CAJAS];
  if (!Array.isArray(guardados)) return [];
  return guardados.slice(0, LUGARES_MAXIMOS).map((nombre: unknown) => {
    if (typeof nombre !== 'string') return null;
    const limpio = nombre.trim().slice(0, LARGO_MAXIMO_DEL_NOMBRE);
    return limpio === '' ? null : limpio;
  });
}

/**
 * Cómo se llama una caja. Con lugar, el nombre que le puso el dueño o «Caja N». Sin lugar (las
 * sesiones anteriores a la 193), el nombre de su aparato, que es como se llamaba entonces.
 */
export function nombreDeLaCaja(
  lugar: number | null | undefined,
  nombres: readonly (string | null)[],
  aparato: string | null | undefined,
): string {
  if (lugar === null || lugar === undefined) return aparato ?? 'Caja';
  return nombres[lugar - 1] ?? `Caja ${String(lugar)}`;
}

/** «Caja principal · iMin mostrador»: la caja y, si se sabe, en qué aparato está abierta. */
export function cajaConSuAparato(
  lugar: number | null | undefined,
  nombres: readonly (string | null)[],
  aparato: string | null | undefined,
): string {
  const caja = nombreDeLaCaja(lugar, nombres, aparato);
  if (lugar === null || lugar === undefined) return caja;
  return aparato === null || aparato === undefined || aparato === ''
    ? caja
    : `${caja} · ${aparato}`;
}

/** Los lugares que no tienen caja abierta, de menor a mayor. */
export function lugaresLibres(
  cupo: number,
  ocupados: readonly (number | null | undefined)[],
): readonly number[] {
  const tope = Math.min(Math.max(1, Math.trunc(cupo)), LUGARES_MAXIMOS);
  const tomados = new Set(ocupados.filter((lugar): lugar is number => typeof lugar === 'number'));
  const libres: number[] = [];
  for (let lugar = 1; lugar <= tope; lugar += 1) {
    if (!tomados.has(lugar)) libres.push(lugar);
  }
  return libres;
}

/**
 * El lugar en el que abre una caja: el que se pidió, si existe y está libre, o el primero libre.
 * `null` = no hay lugar (o el pedido no vale): no se abre.
 */
export function lugarParaAbrir(
  cupo: number,
  ocupados: readonly (number | null | undefined)[],
  pedido?: number,
): number | null {
  const libres = lugaresLibres(cupo, ocupados);
  if (pedido === undefined) return libres[0] ?? null;
  return libres.includes(pedido) ? pedido : null;
}

export async function leerNombresDeCajas(
  db: Kysely<Esquema> | Transaccion,
  organizacionId: string,
): Promise<readonly (string | null)[]> {
  const fila = await db
    .selectFrom('configuracion')
    .select('valores')
    .where('organizacion_id', '=', organizacionId)
    .executeTakeFirst();
  return nombresDeCajasEn(fila?.valores);
}

const nombreDeCaja = z.string().trim().max(LARGO_MAXIMO_DEL_NOMBRE);

export const entradaNombrarCajas = z.strictObject({
  /** Un nombre por lugar, en orden. Vacío = «Caja N». */
  nombres: z.array(nombreDeCaja).min(1).max(LUGARES_MAXIMOS),
});

export interface CajasNombradas {
  readonly nombres: readonly (string | null)[];
}

export const nombrarCajas = definirComando<Transaccion, typeof entradaNombrarCajas, CajasNombradas>(
  {
    nombre: 'caja.nombrar_cajas',
    entidad: 'configuracion',
    escribe: true,
    roles: ['dueno', 'administrador'],
    paquetes: PAQUETES_MOSTRADOR,
    entrada: entradaNombrarCajas,
    async ejecutar(ctx, entrada) {
      const { organizacionId } = ctx.ambito;
      const nombres = entrada.nombres.map((nombre) => (nombre === '' ? null : nombre));
      // Dos cajas con el mismo nombre no se distinguen en el corte ni en el ticket.
      const puestos = nombres.filter((n): n is string => n !== null).map((n) => n.toLowerCase());
      if (new Set(puestos).size !== puestos.length) {
        throw new ErrorDominio('CONFIGURACION_INVALIDA', 'Dos cajas no pueden llamarse igual.');
      }
      const antes = await ctx.paso('leer', () => leerNombresDeCajas(ctx.tx, organizacionId));
      await ctx.paso('guardar', () =>
        guardarConfiguracionParcial(
          ctx.tx,
          organizacionId,
          { [CLAVE_NOMBRES_DE_CAJAS]: nombres },
          { desdeComando: true },
        ),
      );
      ctx.auditar({ entidadId: null, payload: { antes, despues: nombres } });
      return { nombres };
    },
  },
);
