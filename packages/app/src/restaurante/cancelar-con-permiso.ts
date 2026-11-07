import 'server-only';

import { ErrorDominio, validarEntorno, type Rol } from '@morphiqpos/contracts';
import type { Transaccion } from '@morphiqpos/data';
import { sql } from 'kysely';

import { Rechazo } from '../fallos.ts';
import { ROLES_QUE_AUTORIZAN, leerAutorizacion } from '../identidad/supervisor.ts';

/**
 * QUIÉN CANCELA O ANULA QUÉ CUENTA (DP-13.2, decisión DP-D51).
 *
 * `restaurante.cancelar_orden` y `restaurante.anular_linea` ya dejaban entrar al mesero (DP-12.4),
 * pero en CUALQUIER mesa de su sucursal, y una cuenta que el cliente ya pidió —o cuya precuenta
 * ya se imprimió y está en la mesa— se podía hacer desaparecer sin que nadie más la viera. Ahora:
 *
 *   · Una cuenta pagada (o con pagos), dividida, reembolsada o absorbida no se cancela: un cobro
 *     se devuelve con un reembolso, una dividida vive en sus partes, una absorbida en la principal.
 *   · El MESERO cancela o anula sólo en las mesas que atiende o que tiene asignadas. Cajero,
 *     gerente, administrador y dueño, en cualquiera de su sucursal (la frontera de sucursal la
 *     pone el comando).
 *   · Con la cuenta PEDIDA (`cuenta_solicitada`) o la precuenta IMPRESA, quien no autoriza por su
 *     puesto necesita el PIN de un gerente, administrador o dueño, en una autorización atada a
 *     ESA cuenta y a cancelar (`identidad/supervisor.ts`: `cuenta` y `para`). Es lo
 *     predeterminado; Miguel lo apaga con `configuracion.valores.pin_al_cancelar_cuenta_pedida =
 *     false`.
 *
 * Devuelve quién autorizó (el empleo del supervisor), o `null` si no hizo falta, para la auditoría.
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

export const CLAVE_DEL_PIN_AL_CANCELAR = 'pin_al_cancelar_cuenta_pedida';

interface Contexto {
  readonly tx: Transaccion;
  readonly ahora: Date;
  readonly ambito: {
    readonly organizacionId: string;
    readonly empleoId: string;
    readonly rol: Rol;
  };
}

/** ¿Pide PIN cancelar una cuenta pedida o impresa? Sí, salvo que el negocio lo apagó. */
async function pinAlCancelar(ctx: Contexto): Promise<boolean> {
  const fila = await ctx.tx
    .selectFrom('configuracion')
    .select('valores')
    .where('organizacion_id', '=', ctx.ambito.organizacionId)
    .executeTakeFirst();
  const valores = fila?.valores;
  if (typeof valores !== 'object' || valores === null || Array.isArray(valores)) return true;
  return (valores as Record<string, unknown>)[CLAVE_DEL_PIN_AL_CANCELAR] !== false;
}

/** Lo que una cuenta absorbida al unir mesas le hereda a la que la absorbió. */
interface Absorbida {
  /** Se pidió alguna vez: al pedirla se le sella su `codigo_caja`, y unirla no lo borra. */
  readonly pedida: boolean;
  readonly impresas: number;
  readonly atiende: string | null;
}

/**
 * Las cuentas que ESTA absorbió al unir mesas (y las que aquéllas habían absorbido antes), con la
 * unión viva o ya separada: separar no devuelve el consumo, así que sus platillos siguen aquí.
 * Al absorberla, la cuenta pasa a `absorbida` y pierde su «se pidió»; su mesa pasa a nombre de
 * quien atiende la principal. Sin esto, unir mesas borraría el PIN y le daría a un mesero la mesa
 * de otro.
 */
async function absorbidasPor(
  tx: Transaccion,
  organizacionId: string,
  ordenId: string,
): Promise<readonly Absorbida[]> {
  const { rows } = await sql<Absorbida>`
    with recursive grupo (id) as (
      select um.orden_absorbida_id
        from uniones_mesa u
        join union_mesa_miembros um on um.union_id = u.id
       where u.organizacion_id = ${organizacionId}
         and u.orden_id = ${ordenId}
         and um.orden_absorbida_id is not null
      union
      select um.orden_absorbida_id
        from grupo g
        join uniones_mesa u on u.orden_id = g.id and u.organizacion_id = ${organizacionId}
        join union_mesa_miembros um on um.union_id = u.id
       where um.orden_absorbida_id is not null
    )
    select a.codigo_caja is not null as pedida,
           a.precuentas_impresas as impresas,
           a.empleado_atiende_id as atiende
      from grupo g
      join ordenes a on a.id = g.id and a.organizacion_id = ${organizacionId}
  `.execute(tx);
  return rows;
}

export async function exigirPermisoParaCancelar(
  ctx: Contexto,
  ordenId: string,
  autorizacion: string | undefined,
  /**
   * DP-14.6-7 · La cocina no se pudo comprobar y todo cuenta como ya hecho: pide el PIN aunque la
   * cuenta no se haya pedido y aunque el negocio apagara el PIN al cancelar (es pérdida firmada).
   */
  sinComprobarLaCocina = false,
): Promise<string | null> {
  const { organizacionId, empleoId, rol } = ctx.ambito;
  // Una PARTE de una cuenta dividida no tiene mesa: la tiene su madre (DP-14.6).
  const cuenta = await ctx.tx
    .selectFrom('ordenes as o')
    .leftJoin('ordenes as ma', (join) =>
      join
        .onRef('ma.id', '=', 'o.orden_padre_id')
        .onRef('ma.organizacion_id', '=', 'o.organizacion_id'),
    )
    .leftJoin('mesas as m', (join) =>
      join
        .on(sql<boolean>`m.id = coalesce(o.mesa_id, ma.mesa_id)`)
        .onRef('m.organizacion_id', '=', 'o.organizacion_id'),
    )
    .select([
      'o.estado as estado',
      'o.precuentas_impresas as impresas',
      'o.codigo_caja as codigoCaja',
      'o.empleado_atiende_id as atiendeLaCuenta',
      'm.empleado_atiende_id as atiendeLaMesa',
      'm.empleado_asignado_id as asignadoALaMesa',
      'ma.id as madreId',
      'ma.codigo_caja as codigoDeLaMadre',
      'ma.precuentas_impresas as impresasDeLaMadre',
      'ma.empleado_atiende_id as atiendeLaMadre',
    ])
    .where('o.organizacion_id', '=', organizacionId)
    .where('o.id', '=', ordenId)
    .executeTakeFirst();
  if (cuenta === undefined) {
    throw new ErrorDominio('ORDEN_NO_ENCONTRADA', 'Esa cuenta ya no existe.');
  }
  const absorbidas = await absorbidasPor(ctx.tx, organizacionId, cuenta.madreId ?? ordenId);

  const suya = [
    cuenta.atiendeLaCuenta,
    cuenta.atiendeLaMadre,
    cuenta.atiendeLaMesa,
    cuenta.asignadoALaMesa,
  ];
  if (rol === 'mesero' && !suya.includes(empleoId)) {
    throw new Rechazo('SIN_PERMISO', 'denegado', {
      codigo: 'SIN_PERMISO',
      mensaje: 'Esa mesa la atiende otro mesero: que la cancele él, o el gerente.',
    });
  }
  if (rol === 'mesero' && absorbidas.some((a) => a.atiende !== null && a.atiende !== empleoId)) {
    throw new Rechazo('SIN_PERMISO', 'denegado', {
      codigo: 'SIN_PERMISO',
      mensaje: 'En esa cuenta hay una mesa unida de otro mesero: que la cancele el gerente.',
    });
  }

  // «Pedida» es también la que se pidió y se REABRIÓ para un pedido del portal (QA2-007, DP-D58):
  // vuelve a `confirmada`, pero conserva su `codigo_caja`, el papel que el comensal tiene en la mano.
  const pedidaOImpresa =
    cuenta.estado === 'cuenta_solicitada' ||
    cuenta.codigoCaja !== null ||
    cuenta.codigoDeLaMadre !== null ||
    cuenta.impresas > 0 ||
    (cuenta.impresasDeLaMadre ?? 0) > 0 ||
    absorbidas.some((a) => a.pedida || a.impresas > 0);
  if (ROLES_QUE_AUTORIZAN.includes(rol)) return null;
  if (!sinComprobarLaCocina && (!pedidaOImpresa || !(await pinAlCancelar(ctx)))) return null;

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
          ? 'No se pudo comprobar la cocina: cancelar pide el PIN de un gerente o del dueño, y todo queda como pérdida.'
          : 'La cuenta ya se pidió (o se imprimió): cancelarla pide el PIN de un gerente o del dueño.',
      { pidePin: true },
    );
  }
  return carga.supervisor;
}
