import 'server-only';

import { ErrorDominio, PAQUETES_RESTAURANTE, type ErrorComando } from '@morphiqpos/contracts';
import type { Transaccion } from '@morphiqpos/data';
import { z } from 'zod';

import { definirComando } from '../definicion.ts';
import { Rechazo } from '../fallos.ts';
import { ORDEN_CERRADA } from '../portal/estados.ts';
import {
  decidirPropina,
  quienLaDecidio,
  quienPuedeElegirEn,
  type PropinaDeLaCuenta,
} from './una-sola-verdad.ts';

/**
 * `cuenta.fijar_propina` · LA CAJA ELIGE LA PROPINA, Y QUEDA EN EL SERVIDOR (DP-21 · Bloque 4).
 *
 * Antes la propina que elegía la Caja vivía sólo en su pantalla hasta cobrar: si los comensales
 * elegían después en el portal, nadie se enteraba, y al cobrar ganaba la última en escribir.
 * Ahora la elección de la Caja se guarda EN EL MOMENTO, con la `version` de la cuenta que la
 * pantalla leyó:
 *
 *   · si la cuenta cambió desde esa lectura, o si la propina ya la decidió otra pantalla (los
 *     comensales, el mesero), contesta 409 con la propina VIGENTE y no escribe nada;
 *   · la Caja puede cambiar la de otro a propósito (`cambiar: true`, el botón «Cambiarla»): se
 *     aplica y queda en la auditoría como un cambio de la Caja.
 *
 * Nunca se escribe un importe: sólo cómo se decidió (tipo y puntos base). La propina se sigue
 * calculando sobre el total cotizado y su dinero vive en `pagos`, al cobrar.
 */

export const entradaFijarPropina = z.strictObject({
  ordenId: z.uuid(),
  /** La `version` de la cuenta que la Caja tenía en pantalla al elegir. */
  version: z.number().int().min(0),
  propinaTipo: z.enum(['sin_propina', 'porcentaje', 'monto_manual']),
  /** 15 % es 1500. */
  propinaPuntosBase: z.number().int().min(0).max(10_000),
  /** «Cambiarla»: pisar a propósito la que eligió otra pantalla. */
  cambiar: z.boolean().default(false),
});

export interface PropinaFijada {
  readonly ordenId: string;
  /** La `version` nueva de la cuenta: la Caja la manda al cobrar. */
  readonly version: number;
  readonly propinaTipo: string;
  readonly propinaPuntosBase: number;
  readonly propinaOrigen: string;
}

const NOMBRES: Readonly<Record<string, string>> = {
  portal_qr: 'Los comensales',
  mesero: 'El mesero',
  caja: 'La caja',
};

/** «Los comensales ya eligieron 10 % de propina.», para quien llegó después. */
export function mensajeDeLaVigente(vigente: PropinaDeLaCuenta): string {
  const quien = NOMBRES[quienLaDecidio(vigente) ?? 'caja'] ?? 'La caja';
  const verbo = quien === 'Los comensales' ? 'ya eligieron' : 'ya eligió';
  if (vigente.tipo === 'sin_propina' || vigente.puntosBase === 0) {
    return `${quien} ${verbo}: sin propina.`;
  }
  const porcentaje = (vigente.puntosBase / 100).toLocaleString('es-MX', {
    maximumFractionDigits: 2,
  });
  return `${quien} ${verbo} ${porcentaje} % de propina.`;
}

/** El 409 que lleva la propina vigente: la pantalla la enseña sin tener que volver a leer. */
export function conflictoDePropina(
  mensaje: string,
  vigente: PropinaDeLaCuenta,
  version: number,
): Rechazo {
  const error: ErrorComando = {
    codigo: 'CONFLICTO_ESTADO',
    mensaje,
    datos: {
      regla: 'PROPINA_VIGENTE',
      propinaTipo: vigente.tipo,
      propinaPuntosBase: vigente.puntosBase,
      propinaOrigen: vigente.origen,
      version,
    },
  };
  return new Rechazo('CONFLICTO_ESTADO', 'conflicto', error);
}

export const fijarPropina = definirComando<Transaccion, typeof entradaFijarPropina, PropinaFijada>({
  nombre: 'cuenta.fijar_propina',
  entidad: 'orden',
  escribe: true,
  roles: ['cajero', 'gerente', 'administrador', 'dueno'],
  paquetes: PAQUETES_RESTAURANTE,
  sucursal: { ordenId: 'ordenes' },
  entrada: entradaFijarPropina,
  async ejecutar(ctx, entrada) {
    const { organizacionId } = ctx.ambito;

    // Con candado: quien elige a la vez desde el portal espera aquí y después ve ésta.
    const cuenta = await ctx.paso('bloquear_cuenta', () =>
      ctx.tx
        .selectFrom('ordenes')
        .select([
          'id',
          'estado',
          'version',
          'propina_tipo',
          'propina_puntos_base',
          'propina_origen',
        ])
        .where('organizacion_id', '=', organizacionId)
        .where('id', '=', entrada.ordenId)
        .forUpdate()
        .executeTakeFirst(),
    );
    if (cuenta === undefined) {
      throw new ErrorDominio('ORDEN_NO_ENCONTRADA', 'Esa cuenta ya no existe.');
    }
    const vigente: PropinaDeLaCuenta = {
      tipo: cuenta.propina_tipo,
      puntosBase: cuenta.propina_puntos_base,
      origen: cuenta.propina_origen,
    };
    if ((ORDEN_CERRADA as readonly string[]).includes(cuenta.estado)) {
      throw conflictoDePropina(
        'Esa cuenta ya se cerró: su propina ya no cambia.',
        vigente,
        cuenta.version,
      );
    }

    const negocio = await ctx.paso('quien_elige', () =>
      ctx.tx
        .selectFrom('configuracion')
        .select('valores')
        .where('organizacion_id', '=', organizacionId)
        .executeTakeFirst(),
    );
    if (!quienPuedeElegirEn(negocio?.valores).caja) {
      throw new ErrorDominio(
        'PROPINA_NO_PERMITIDA',
        'En este negocio la Caja no elige la propina. Se cambia en Configuración → Ventas y cobro.',
      );
    }

    // La cuenta cambió desde que la Caja la leyó (lo normal: los comensales acaban de elegir).
    if (cuenta.version !== entrada.version) {
      throw conflictoDePropina(mensajeDeLaVigente(vigente), vigente, cuenta.version);
    }
    const veredicto = decidirPropina(vigente, { quien: 'caja', cambiar: entrada.cambiar });
    if (!veredicto.aplicar) {
      throw conflictoDePropina(mensajeDeLaVigente(vigente), vigente, cuenta.version);
    }

    // Un 0 % pedido como porcentaje es «sin propina»: significan lo mismo y así se agrupa igual.
    const tipo = entrada.propinaPuntosBase === 0 ? 'sin_propina' : entrada.propinaTipo;
    const puntosBase = tipo === 'sin_propina' ? 0 : entrada.propinaPuntosBase;
    const nuevaVersion = cuenta.version + 1;

    const escrita = await ctx.paso('fijar_propina', () =>
      ctx.tx
        .updateTable('ordenes')
        .set({
          propina_tipo: tipo,
          propina_puntos_base: puntosBase,
          propina_origen: 'caja',
          version: nuevaVersion,
        })
        .where('organizacion_id', '=', organizacionId)
        .where('id', '=', entrada.ordenId)
        .where('version', '=', cuenta.version)
        .where('estado', 'not in', [...ORDEN_CERRADA])
        .returning('id')
        .executeTakeFirst(),
    );
    if (escrita === undefined) {
      throw conflictoDePropina(mensajeDeLaVigente(vigente), vigente, cuenta.version);
    }

    ctx.auditar({
      entidadId: entrada.ordenId,
      payload: {
        antes: vigente,
        despues: { tipo, puntosBase, origen: 'caja' },
        // `true` cuando la Caja pisó a propósito la que eligieron los comensales o el mesero.
        cambio: veredicto.esCambio,
      },
    });

    return {
      ordenId: entrada.ordenId,
      version: nuevaVersion,
      propinaTipo: tipo,
      propinaPuntosBase: puntosBase,
      propinaOrigen: 'caja',
    };
  },
});
