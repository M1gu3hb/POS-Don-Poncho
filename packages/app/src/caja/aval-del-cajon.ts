import 'server-only';

import { ErrorDominio, validarEntorno } from '@morphiqpos/contracts';
import type { Transaccion } from '@morphiqpos/data';

import type { ContextoComando } from '../definicion.ts';
import { leerAutorizacion } from '../identidad/supervisor.ts';
import { gastarLaAutorizacion } from '../venta/autorizacion-de-un-uso.ts';

/**
 * «ABRIR CAJÓN» A MANO PIDE EL PIN DE UN GERENTE, ADMINISTRADOR O DUEÑO (DP-21 · Bloque 7).
 *
 * La apertura SIN venta es la única que puede esconder un faltante, y la cajera la dispara sola.
 * Así que el servidor —no sólo la pantalla— exige la autorización firmada del supervisor
 * (`/api/identidad/supervisor` con `para: 'cajon'`): de un solo uso (`gastarLaAutorizacion`),
 * vigente, del negocio y de quien la pidió. A diferencia del retiro, aquí NO hay excepción para
 * quien ya es de mando: el gerente con la sesión abierta también la presenta, con su propio PIN.
 */

export interface AvalDelCajon {
  readonly autorizadoPor: string;
  readonly autorizadoRol: string;
  /** El nonce de la autorización gastada: va a la auditoría y `gastarLaAutorizacion` lo busca ahí. */
  readonly autorizacion: string;
}

const SIN_AUTORIZACION =
  'Abrir el cajón a mano lo autoriza un gerente, administrador o dueño con su PIN.';

/**
 * Comprueba —y gasta— la autorización de la apertura. Errores claros: sin autorización, de otro
 * propósito, de quien no es de mando, de otra persona, vencida o ya usada.
 */
export async function avalarElCajon(
  ctx: ContextoComando<Transaccion>,
  autorizacion: string | undefined,
): Promise<AvalDelCajon> {
  if (autorizacion === undefined) {
    throw new ErrorDominio('PUESTO_NO_OTORGABLE', SIN_AUTORIZACION);
  }
  const { organizacionId, empleoId } = ctx.ambito;
  const leida = leerAutorizacion(
    autorizacion,
    { organizacionId, solicitaEmpleoId: empleoId, para: 'cajon' },
    validarEntorno(process.env).SESSION_SECRET,
    ctx.ahora,
  );
  if (leida === null) {
    throw new ErrorDominio(
      'PUESTO_NO_OTORGABLE',
      'La autorización venció o no es para abrir el cajón: que quien autoriza teclee su PIN otra vez.',
    );
  }
  await gastarLaAutorizacion(ctx.tx, organizacionId, leida);
  return { autorizadoPor: leida.supervisor, autorizadoRol: leida.rol, autorizacion: leida.n };
}
