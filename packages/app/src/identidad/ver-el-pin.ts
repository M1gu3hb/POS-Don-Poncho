import 'server-only';

import { ErrorDominio, PAQUETES_TODOS, validarEntorno } from '@morphiqpos/contracts';
import type { Transaccion } from '@morphiqpos/data';
import { z } from 'zod';

import { definirComando } from '../definicion.ts';
import { gastarLaAutorizacion } from '../venta/autorizacion-de-un-uso.ts';
import { descifrarPin, llaveDelEntorno } from './pin-cifrado.ts';
import { leerAutorizacion } from './supervisor.ts';

/**
 * DP-25 · Parte 7 · EL DUEÑO VE EL PIN DE SU GENTE (Configuración → Personas, con un ojito).
 *
 * Al personal se le olvida el PIN y cambiarlo a cada rato es un problema. El PIN se sigue guardando
 * como hash para entrar; al ponerlo se guarda además una copia cifrada (`pin-cifrado.ts`). Verla:
 *
 *   · Es SÓLO del dueño: el servidor rechaza a cualquier otro puesto, aunque la pantalla no lo
 *     enseñe (R11).
 *   · Con SU propio PIN: la firma de `/api/identidad/supervisor` con `para: 'ver_pin'`, tecleada por
 *     él mismo (la de otra persona no sirve), y de UN uso (`autorizacion-de-un-uso.ts`).
 *   · Cada vista queda en la auditoría: quién vio el PIN de quién y cuándo. Nunca el PIN.
 *   · El PIN de antes, sin copia, dice «No disponible»; sin llave en el entorno, la función está
 *     apagada y no rompe nada.
 */

const SOLO_EL_DUENO = ['dueno'] as const;

export const entradaVerElPin = z.object({
  /** De quién. `empleoId`, como en `identidad.establecer_pin`. */
  empleado: z.uuid(),
  /** La firma del PIN del dueño, `para: 'ver_pin'`, de un solo uso. */
  autorizacion: z.string().min(20).max(2_000),
});

export const entradaPinesVisibles = z.object({});

export type PinVisto =
  | { readonly disponible: true; readonly pin: string }
  | { readonly disponible: false; readonly motivo: 'sin_copia' | 'apagada' };

export interface PinesVisibles {
  /** `false` sin llave en el entorno: la pantalla no enseña el ojito. */
  readonly activa: boolean;
  /** Quiénes tienen copia (por `empleoId`); los demás dicen «No disponible». */
  readonly conCopia: readonly string[];
}

/** La credencial de esa persona, DENTRO del negocio de quien pregunta. */
function credencialDe(tx: Transaccion, organizacionId: string, empleoId: string) {
  return tx
    .selectFrom('empleos')
    .innerJoin('personas', 'personas.id', 'empleos.persona_id')
    .innerJoin('identidades', 'identidades.persona_id', 'personas.id')
    .leftJoin('credenciales_pin', 'credenciales_pin.identidad_id', 'identidades.id')
    .select([
      'identidades.id as identidadId',
      'personas.nombre as nombre',
      'credenciales_pin.pin_cifrado as copia',
    ])
    .where('empleos.id', '=', empleoId)
    .where('empleos.organizacion_id', '=', organizacionId)
    .where('empleos.activo', '=', true)
    .executeTakeFirst();
}

export const verElPin = definirComando<Transaccion, typeof entradaVerElPin, PinVisto>({
  nombre: 'identidad.ver_pin',
  entidad: 'empleo',
  // Escribe su rastro: cada vista queda en la auditoría, con su llave de idempotencia.
  escribe: true,
  roles: [...SOLO_EL_DUENO],
  paquetes: PAQUETES_TODOS,
  sinFrontera: {
    empleado:
      'El equipo es del negocio: el dueño ve el PIN de la gente de todas sus sucursales, igual que se lo pone.',
  },
  entrada: entradaVerElPin,
  async ejecutar(ctx, entrada) {
    const { organizacionId, empleoId } = ctx.ambito;

    // La firma es la del DUEÑO MISMO: quien la tecleó es quien pregunta, y es el dueño.
    const firma = leerAutorizacion(
      entrada.autorizacion,
      { organizacionId, solicitaEmpleoId: empleoId, para: 'ver_pin' },
      validarEntorno(process.env).SESSION_SECRET,
      ctx.ahora,
    );
    if (firma === null || firma.supervisor !== empleoId || firma.rol !== 'dueno') {
      throw new ErrorDominio(
        'PUESTO_NO_OTORGABLE',
        'Para ver un PIN, el dueño teclea el suyo otra vez.',
        { pidePin: true },
      );
    }
    await ctx.paso('gastar_autorizacion', () =>
      gastarLaAutorizacion(ctx.tx, organizacionId, firma, {
        mensaje: 'Esa autorización ya se usó: cada PIN que se ve lleva el tuyo. Tecléalo otra vez.',
        datos: { pidePin: true },
      }),
    );

    const credencial = await ctx.paso('leer_credencial', () =>
      credencialDe(ctx.tx, organizacionId, entrada.empleado),
    );
    if (credencial === undefined) {
      throw new ErrorDominio('ACCESO_NO_ENCONTRADO', 'Esa persona no existe o está dada de baja.');
    }

    const llave = llaveDelEntorno();
    const pin =
      llave === null || credencial.copia === null
        ? null
        : descifrarPin(credencial.copia, llave, credencial.identidadId);
    const visto: PinVisto =
      pin !== null
        ? { disponible: true, pin }
        : { disponible: false, motivo: llave === null ? 'apagada' : 'sin_copia' };

    // Quién vio el PIN de quién (la fila ya lleva quién y cuándo). NUNCA el PIN.
    ctx.auditar({
      entidadId: entrada.empleado,
      payload: {
        vio: empleoId,
        aQuien: credencial.nombre,
        disponible: visto.disponible,
        autorizacion: firma.n,
      },
    });
    return visto;
  },
});

export const pinesVisibles = definirComando<Transaccion, typeof entradaPinesVisibles, PinesVisibles>({
  nombre: 'identidad.pines_visibles',
  entidad: 'empleo',
  escribe: false,
  roles: [...SOLO_EL_DUENO],
  paquetes: PAQUETES_TODOS,
  entrada: entradaPinesVisibles,
  async ejecutar(ctx) {
    if (llaveDelEntorno() === null) return { activa: false, conCopia: [] };
    const filas = await ctx.paso('leer_copias', () =>
      ctx.tx
        .selectFrom('empleos')
        .innerJoin('personas', 'personas.id', 'empleos.persona_id')
        .innerJoin('identidades', 'identidades.persona_id', 'personas.id')
        .innerJoin('credenciales_pin', 'credenciales_pin.identidad_id', 'identidades.id')
        .select('empleos.id as empleoId')
        .where('empleos.organizacion_id', '=', ctx.ambito.organizacionId)
        .where('empleos.activo', '=', true)
        .where('credenciales_pin.pin_cifrado', 'is not', null)
        .execute(),
    );
    return { activa: true, conCopia: filas.map((f) => f.empleoId) };
  },
});
