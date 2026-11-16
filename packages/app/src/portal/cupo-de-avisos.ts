import 'server-only';

import { ErrorDominio } from '@morphiqpos/contracts';

import type { ContextoPortal } from './definicion-publica.ts';
import { permitirPortal } from './limite.ts';

/**
 * EL TOPE DE AVISOS AL MESERO (DP-21).
 *
 * «Llamar al mesero», «Ayuda» y «Pedir la cuenta» hacen sonar la tableta del mesero, y el QR de la
 * mesa está impreso: quien le tomó una foto puede apretar el botón desde la calle. Los índices
 * únicos ya impiden dos avisos iguales PENDIENTES, pero «volver a llamar» renueva el aviso (suena
 * otra vez) y un aviso resuelto deja pedir otro. Aquí se pone el tope:
 *
 *   · por TELÉFONO: el id que firma el servidor (`telefono.ts`). Uno que el navegador se inventó, o
 *     ninguno, cae en el cubo «sin teléfono» de la mesa: inventar ids no da más avisos;
 *   · por MESA: todos los teléfonos juntos.
 *
 * No hay tope por IP a propósito: todos los comensales del local comparten el WiFi.
 *
 * Se cuenta ANTES de tocar nada y FUERA de la transacción del comando (`contarIntento` abre la
 * suya): un intento que se rechaza gasta cuota igual. El del teléfono se mira primero y lo que
 * niega no gasta el de la mesa, para que un solo teléfono no agote el cupo de sus compañeros.
 */

/** Lo que lee el comensal cuando ya se avisó de más: amable, nunca «error». */
export const YA_AVISAMOS = 'Ya avisamos a tu mesero. Llegará en un momento.';

/** El cubo de los avisos que llegan sin un teléfono que el servidor haya firmado. */
const SIN_TELEFONO = 'sin-telefono';

/**
 * ¿Le toca avisar a este teléfono? `huella` es la del teléfono firmado, o `null` si no hay uno
 * válido. `false`: ya avisó de más (él o su mesa) y no debe sonar nada.
 */
export async function hayCupoParaAvisar(
  ctx: ContextoPortal,
  huella: string | null,
): Promise<boolean> {
  const { tokenMesa, organizacionId } = ctx.ambito;
  const contexto = { correlationId: ctx.correlationId, organizacionId };
  const delTelefono = await permitirPortal(
    'aviso_telefono',
    `${tokenMesa}:${huella ?? SIN_TELEFONO}`,
    ctx.pimienta,
    contexto,
  );
  if (!delTelefono.ok) return false;
  const delaMesa = await permitirPortal('aviso_mesa', tokenMesa, ctx.pimienta, contexto);
  return delaMesa.ok;
}

/** El rechazo de un aviso de más, con la misma regla de «ya avisamos» que el índice único. */
export function yaSeAvisoDeMas(tipo: string): ErrorDominio {
  return new ErrorDominio('QR_SOLICITUD_DUPLICADA', YA_AVISAMOS, { tipo });
}
