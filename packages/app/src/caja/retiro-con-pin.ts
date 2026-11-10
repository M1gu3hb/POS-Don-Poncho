import 'server-only';

import { ErrorDominio, PAQUETES_MOSTRADOR, validarEntorno } from '@morphiqpos/contracts';
import type { Transaccion } from '@morphiqpos/data';
import { z } from 'zod';

import { definirComando, type ContextoComando } from '../definicion.ts';
import { leerAutorizacion } from '../identidad/supervisor.ts';
import { guardarConfiguracionParcial } from '../puente/configuracion.ts';
import { gastarLaAutorizacion } from '../venta/autorizacion-de-un-uso.ts';
import { entradaMovimientoCaja } from '../venta/esquemas.ts';

/**
 * «PEDIR PIN DE GERENTE EN RETIROS MAYORES A $X» (DP-16, encargo 1.4).
 *
 * El retiro es la salida de dinero que más fácil esconde un faltante, y la cajera lo registra sola.
 * Arriba de un monto que el dueño fija en Configuración → Caja, el servidor pide la autorización de
 * un gerente, administrador o dueño: la MISMA pieza del descuento (`/api/identidad/supervisor`
 * firma el PIN; `gastarLaAutorizacion` la gasta), atada a ese monto y de un solo uso. Sin umbral
 * (el valor por omisión) no se pide nada.
 *
 * Vive en `configuracion.valores` (sin columna, sin migración) y sólo se escribe por
 * `caja.fijar_umbral_de_retiro`: dueño o administrador, con su antes y su después en la auditoría.
 * Quien ya es gerente, administrador o dueño no necesita a otro: la regla es para la cajera.
 */

export const CLAVE_UMBRAL_DE_RETIRO = 'retiro_pin_arriba_de_centavos';

/** Mismo tope que cualquier importe de la caja: diez millones de pesos. */
const TOPE_DEL_UMBRAL_CENTAVOS = 1_000_000_000;

const QUIEN_DECIDE = ['dueno', 'administrador'] as const;
/** Los puestos que autorizan por sí mismos: no se les pide el PIN de otro para su propio retiro. */
const ROLES_DE_GERENCIA: readonly string[] = ['gerente', 'administrador', 'dueno'];

/** El umbral que dice el documento: un entero positivo en centavos, o `null` (no se pide). */
export function umbralDeRetiroEn(valores: unknown): number | null {
  if (typeof valores !== 'object' || valores === null || Array.isArray(valores)) return null;
  const valor = (valores as Record<string, unknown>)[CLAVE_UMBRAL_DE_RETIRO];
  return typeof valor === 'number' && Number.isSafeInteger(valor) && valor > 0 ? valor : null;
}

export async function leerUmbralDeRetiro(
  tx: Transaccion,
  organizacionId: string,
): Promise<number | null> {
  const fila = await tx
    .selectFrom('configuracion')
    .select('valores')
    .where('organizacion_id', '=', organizacionId)
    .executeTakeFirst();
  return umbralDeRetiroEn(fila?.valores);
}

/** ¿Este retiro necesita el PIN de un gerente? Mayor ESTRICTO que el umbral, y sólo para la cajera. */
export function retiroPideAutorizacion(
  rol: string,
  magnitudCentavos: bigint,
  umbralCentavos: number | null,
): boolean {
  if (umbralCentavos === null) return false;
  if (ROLES_DE_GERENCIA.includes(rol)) return false;
  return magnitudCentavos > BigInt(umbralCentavos);
}

/** `caja.movimiento` con la autorización firmada del supervisor, cuando el retiro pasa del umbral. */
export const entradaMovimientoConAutorizacion = entradaMovimientoCaja.safeExtend({
  autorizacion: z.string().min(20).max(2_000).optional(),
});

export interface AvalDelRetiro {
  readonly autorizadoPor: string;
  readonly autorizadoRol: string;
  /** El nonce de la autorización gastada: va a la auditoría y `gastarLaAutorizacion` lo busca ahí. */
  readonly autorizacion: string;
}

/**
 * Comprueba —y gasta— la autorización de un retiro que la necesita. `null` si no hace falta. Errores
 * claros: sin autorización, de otro monto, vencida o ya usada.
 */
export async function avalarElRetiro(
  ctx: ContextoComando<Transaccion>,
  retiro: {
    readonly umbralCentavos: number | null;
    readonly magnitudCentavos: bigint;
    readonly autorizacion: string | undefined;
  },
): Promise<AvalDelRetiro | null> {
  const { organizacionId, empleoId, rol } = ctx.ambito;
  if (!retiroPideAutorizacion(rol, retiro.magnitudCentavos, retiro.umbralCentavos)) return null;
  if (retiro.autorizacion === undefined) {
    throw new ErrorDominio(
      'PUESTO_NO_OTORGABLE',
      'Un retiro de ese monto lo autoriza un gerente, administrador o dueño con su PIN.',
    );
  }
  const leida = leerAutorizacion(
    retiro.autorizacion,
    {
      organizacionId,
      solicitaEmpleoId: empleoId,
      para: 'retiro',
      montoCentavos: retiro.magnitudCentavos,
    },
    validarEntorno(process.env).SESSION_SECRET,
    ctx.ahora,
  );
  if (leida === null) {
    throw new ErrorDominio(
      'PUESTO_NO_OTORGABLE',
      'La autorización venció o es de otro monto: que quien autoriza teclee su PIN otra vez.',
    );
  }
  await gastarLaAutorizacion(ctx.tx, organizacionId, leida);
  return { autorizadoPor: leida.supervisor, autorizadoRol: leida.rol, autorizacion: leida.n };
}

export const entradaFijarUmbralDeRetiro = z.object({
  /** En centavos; `null` lo apaga (no se pide PIN en ningún retiro). */
  umbralCentavos: z.number().int().min(1).max(TOPE_DEL_UMBRAL_CENTAVOS).nullable(),
});

export interface ResultadoUmbralDeRetiro {
  readonly umbralCentavos: number | null;
}

export const fijarUmbralDeRetiro = definirComando<
  Transaccion,
  typeof entradaFijarUmbralDeRetiro,
  ResultadoUmbralDeRetiro
>({
  nombre: 'caja.fijar_umbral_de_retiro',
  entidad: 'configuracion',
  escribe: true,
  roles: [...QUIEN_DECIDE],
  paquetes: PAQUETES_MOSTRADOR,
  entrada: entradaFijarUmbralDeRetiro,
  async ejecutar(ctx, entrada) {
    const { organizacionId } = ctx.ambito;
    const antes = await ctx.paso('leer', () => leerUmbralDeRetiro(ctx.tx, organizacionId));
    // El guardado parcial toma el documento con candado y lo escribe entero.
    await ctx.paso('guardar', () =>
      guardarConfiguracionParcial(
        ctx.tx,
        organizacionId,
        { [CLAVE_UMBRAL_DE_RETIRO]: entrada.umbralCentavos },
        { desdeComando: true },
      ),
    );
    ctx.auditar({
      entidadId: null,
      payload: { antes, despues: entrada.umbralCentavos },
    });
    return { umbralCentavos: entrada.umbralCentavos };
  },
});
