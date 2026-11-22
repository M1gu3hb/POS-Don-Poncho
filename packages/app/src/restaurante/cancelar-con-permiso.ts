import 'server-only';

import { ErrorDominio, validarEntorno, type Rol } from '@morphiqpos/contracts';
import type { Transaccion } from '@morphiqpos/data';

import { Rechazo } from '../fallos.ts';
import {
  ROLES_QUE_AUTORIZAN,
  leerAutorizacion,
  type CargaDeAutorizacion,
} from '../identidad/supervisor.ts';
import { gastarLaAutorizacion } from '../venta/autorizacion-de-un-uso.ts';

/**
 * QUIÉN QUITA LO YA ENVIADO Y QUIÉN CANCELA UNA CUENTA (DP-24 · Parte 2; antes DP-13.2).
 *
 * `restaurante.anular_linea` (un platillo que ya se mandó a cocina) y `restaurante.cancelar_orden`
 * (la cuenta entera) hacen desaparecer dinero ya capturado. Por eso:
 *
 *   · El MESERO no entra: sólo quita lo que todavía no manda a cocina, que es su carrito y vive en
 *     su pantalla, sin comando. El servidor lo dice dos veces: los roles de los comandos y, aquí,
 *     la regla de dominio (un rol nuevo en la lista de un comando no se cuela sin querer).
 *   · El CAJERO quita o cancela SIEMPRE con el PIN de un gerente, administrador o dueño, en una
 *     autorización atada a ESA cuenta y a cancelar (`identidad/supervisor.ts`: `cuenta` y `para`).
 *     Ya no depende de que la cuenta se haya pedido ni de ninguna configuración del negocio.
 *   · Gerente, administrador y dueño autorizan por su puesto: sin PIN.
 *   · Una cuenta pagada (o con pagos), dividida, reembolsada o absorbida no se cancela: un cobro
 *     se devuelve con un reembolso, una dividida vive en sus partes, una absorbida en la principal.
 *
 * Devuelve quién autorizó (el empleo del supervisor), o `null` si fue por su puesto, para la
 * auditoría.
 */

/** Los estados de una cuenta que ya no se cancela, con lo que se le dice a quien lo intenta. */
const NO_SE_CANCELA: Readonly<Record<string, string>> = {
  pagada: 'Esa cuenta ya se cobró: un cobro se devuelve con un reembolso, no se cancela.',
  parcialmente_pagada:
    'Esa cuenta ya tiene pagos: lo cobrado se devuelve con un reembolso, no se cancela.',
  dividida:
    'Esa cuenta se dividió: no se cancela entera. Cancela (o cobra) cada una de sus partes.',
  reembolsada: 'Esa cuenta ya se cobró y se devolvió: no hay nada que cancelar.',
  parcialmente_reembolsada: 'Esa cuenta se cobró y se devolvió en parte: no se cancela.',
  absorbida: 'Esa cuenta se unió a otra mesa: se cancela la cuenta de la mesa principal.',
};

/** Lanza si la cuenta, por su estado, ya no se cancela. */
export function exigirQueSeCancele(estado: string): void {
  const porque = NO_SE_CANCELA[estado];
  if (porque !== undefined) throw new ErrorDominio('ORDEN_NO_EDITABLE', porque, { estado });
}

interface Contexto {
  readonly ahora: Date;
  readonly ambito: {
    readonly organizacionId: string;
    readonly empleoId: string;
    readonly rol: Rol;
  };
}

/** Lo que se le dice a quien no puede, sea el mesero o un rol que alguien agregue por error. */
const SOLO_CAJA_Y_GERENCIA =
  'Quitar lo que ya se mandó a cocina o cancelar una cuenta es de la caja, con el PIN de un gerente, o de la gerencia. El mesero sólo quita lo que todavía no manda.';

export function exigirPermisoParaCancelar(
  ctx: Contexto,
  ordenId: string,
  autorizacion: string | undefined,
  /**
   * DP-14.6-7 · La cocina no se pudo comprobar y todo cuenta como ya hecho. El cajero siempre pide
   * el PIN; esto sólo cambia lo que se le dice.
   */
  sinComprobarLaCocina = false,
): CargaDeAutorizacion | null {
  const { organizacionId, empleoId, rol } = ctx.ambito;
  if (ROLES_QUE_AUTORIZAN.includes(rol)) return null;
  if (rol !== 'cajero') {
    throw new Rechazo('SIN_PERMISO', 'denegado', {
      codigo: 'SIN_PERMISO',
      mensaje: SOLO_CAJA_Y_GERENCIA,
    });
  }

  const carga =
    autorizacion === undefined
      ? null
      : leerAutorizacion(
          autorizacion,
          { organizacionId, solicitaEmpleoId: empleoId, cuenta: ordenId, para: 'cancelacion' },
          validarEntorno(process.env).SESSION_SECRET,
          ctx.ahora,
        );
  if (carga === null) {
    throw new ErrorDominio(
      'PUESTO_NO_OTORGABLE',
      autorizacion !== undefined
        ? 'Esa autorización venció o es de otra cuenta: que el gerente teclee su PIN otra vez.'
        : sinComprobarLaCocina
          ? 'No se pudo comprobar la cocina: cancelar pide el PIN de un gerente, administrador o dueño, y todo queda como pérdida.'
          : 'Quitar un platillo o cancelar la cuenta pide el PIN de un gerente, administrador o dueño.',
      { pidePin: true },
    );
  }
  return carga;
}

/**
 * DP-25 · La firma de quitar o cancelar es de UN uso: la misma no quita un segundo platillo ni
 * cancela después la cuenta (antes, mandando el comando a mano, servía mientras viviera). Se gasta
 * DENTRO de la transacción (`venta/autorizacion-de-un-uso.ts`): si la acción se revierte, la firma
 * sigue servible; y dos usos a la vez se forman en fila y el segundo se rechaza.
 */
export async function gastarElPermisoParaCancelar(
  tx: Transaccion,
  organizacionId: string,
  carga: CargaDeAutorizacion | null,
): Promise<void> {
  if (carga === null) return;
  await gastarLaAutorizacion(tx, organizacionId, carga, {
    mensaje:
      'Esa autorización ya se usó: cada platillo que se quita, y cada cuenta que se cancela, lleva su PIN. Que el gerente lo teclee otra vez.',
    datos: { pidePin: true },
  });
}
