import 'server-only';

import { ErrorDominio, PAQUETES_OPERATIVOS } from '@morphiqpos/contracts';
import { repoCaja, type Transaccion } from '@morphiqpos/data';
import { frasePagado } from '@morphiqpos/domain/gastos';
import { z } from 'zod';

import { leerNombresDeCajas, nombreDeLaCaja } from '../caja/lugares.ts';
import { definirComando } from '../definicion.ts';
import { elegirLaCajaDeLaQueSale } from './sesion-de-caja.ts';

/**
 * EL EFECTIVO DE UN GASTO O UNA COMPRA, A LA VISTA (DP-21 · Bloque 11 · M22, A11 y H4).
 *
 * Se queda la regla DP-D115 (`sesion-de-caja.ts`): el efectivo sale del cajón de la caja abierta y,
 * sin caja abierta, no se registra. Estas dos lecturas la HACEN VISIBLE, y los nombres los pone el
 * servidor (el de la caja es el del Bloque 5: «Caja principal»), no la pantalla:
 *
 *   · `gastos.cajon_para_pagar` — ANTES de guardar: de qué caja saldría el efectivo (la de este
 *     aparato o, si no tiene, la única otra abierta) y cuánto hay en ella (el efectivo esperado,
 *     que es lo que el servidor derivará al cerrar), para avisar si el pago lo dejaría en negativo;
 *   · `gastos.pagos_de_la_caja` — DESPUÉS: de qué caja salió cada gasto o compra en efectivo, que es
 *     lo que Compras y gastos enseña («Pagado en efectivo de Caja principal»).
 *
 * Las leen quienes registran gastos y compras (los mismos `roles` de `gastos.registrar`).
 */

const ROLES = ['dueno', 'administrador', 'gerente'] as const;
const TOPE_DE_IDS = 100;

export interface CajonParaPagar {
  /** `una`: sale de `caja`; `ninguna`: no hay caja abierta (no se registra); `varias`: no se adivina. */
  readonly caso: 'una' | 'ninguna' | 'varias';
  readonly caja: {
    readonly sesionCajaId: string;
    readonly nombre: string;
    /** `false`: este aparato no tiene caja propia y sale de la otra abierta. */
    readonly esDeEsteAparato: boolean;
    /** El efectivo esperado ahora, en centavos: lo que hay en el cajón según el servidor. */
    readonly esperadoCentavos: string;
  } | null;
}

export const entradaCajonParaPagar = z.strictObject({});

export const cajonParaPagar = definirComando<
  Transaccion,
  typeof entradaCajonParaPagar,
  CajonParaPagar
>({
  nombre: 'gastos.cajon_para_pagar',
  entidad: 'sesion_caja',
  escribe: false,
  roles: ROLES,
  paquetes: PAQUETES_OPERATIVOS,
  entrada: entradaCajonParaPagar,
  async ejecutar(ctx) {
    const { organizacionId, sucursalId, terminalId } = ctx.ambito;
    if (sucursalId === null) {
      throw new ErrorDominio(
        'GASTO_INVALIDO',
        'Registra desde una sucursal: es de dónde sale el dinero.',
      );
    }
    const abiertas = await ctx.paso('cargar_cajas', () =>
      ctx.tx
        .selectFrom('sesiones_caja as s')
        .leftJoin('terminales as t', 't.id', 's.terminal_id')
        .select(['s.id', 's.terminal_id', 's.lugar', 't.nombre as terminal'])
        .where('s.organizacion_id', '=', organizacionId)
        .where('s.sucursal_id', '=', sucursalId)
        .where('s.estado', '=', 'abierta')
        .orderBy('s.abierta_en', 'asc')
        .execute(),
    );
    const elegida = elegirLaCajaDeLaQueSale(abiertas, terminalId);
    if (elegida.caso !== 'una') return { caso: elegida.caso, caja: null };

    const nombres = await leerNombresDeCajas(ctx.tx, organizacionId);
    const arqueo = await ctx.paso('arqueo', () =>
      repoCaja.arqueoDeSesion(ctx.tx, organizacionId, elegida.fila.id),
    );
    return {
      caso: 'una',
      caja: {
        sesionCajaId: elegida.fila.id,
        nombre: nombreDeLaCaja(elegida.fila.lugar, nombres, elegida.fila.terminal),
        esDeEsteAparato: elegida.esDeEsteAparato,
        esperadoCentavos: arqueo.efectivoEsperadoCentavos.toString(),
      },
    };
  },
});

export interface PagoDeLaCaja {
  readonly tipo: 'gasto' | 'compra';
  readonly id: string;
  readonly caja: string;
  /** «Pagado en efectivo de Caja principal». */
  readonly frase: string;
}

export const entradaPagosDeLaCaja = z.strictObject({
  gastoIds: z.array(z.uuid()).max(TOPE_DE_IDS).default([]),
  compraIds: z.array(z.uuid()).max(TOPE_DE_IDS).default([]),
});

export const pagosDeLaCaja = definirComando<
  Transaccion,
  typeof entradaPagosDeLaCaja,
  { readonly pagos: readonly PagoDeLaCaja[] }
>({
  nombre: 'gastos.pagos_de_la_caja',
  entidad: 'gasto',
  escribe: false,
  roles: ROLES,
  paquetes: PAQUETES_OPERATIVOS,
  entrada: entradaPagosDeLaCaja,
  async ejecutar(ctx, entrada) {
    const { organizacionId } = ctx.ambito;
    if (entrada.gastoIds.length === 0 && entrada.compraIds.length === 0) return { pagos: [] };

    // El movimiento de la caja es la verdad de que el efectivo SALIÓ de un cajón: el gasto lo
    // referencia como `gasto`; la compra de contado, como `pago_proveedor`.
    const filas = await ctx.paso('leer_movimientos', () =>
      ctx.tx
        .selectFrom('movimientos_caja as m')
        .innerJoin('sesiones_caja as s', 's.id', 'm.sesion_caja_id')
        .leftJoin('terminales as t', 't.id', 's.terminal_id')
        .select(['m.referencia_tipo', 'm.referencia_id', 's.lugar', 't.nombre as terminal'])
        .where('m.organizacion_id', '=', organizacionId)
        .where('m.tipo', '=', 'gasto')
        .where((eb) =>
          eb.or([
            ...(entrada.gastoIds.length === 0
              ? []
              : [
                  eb.and([
                    eb('m.referencia_tipo', '=', 'gasto'),
                    eb('m.referencia_id', 'in', entrada.gastoIds),
                  ]),
                ]),
            ...(entrada.compraIds.length === 0
              ? []
              : [
                  eb.and([
                    eb('m.referencia_tipo', '=', 'pago_proveedor'),
                    eb('m.referencia_id', 'in', entrada.compraIds),
                  ]),
                ]),
          ]),
        )
        .execute(),
    );
    const nombres = await leerNombresDeCajas(ctx.tx, organizacionId);
    const pagos: PagoDeLaCaja[] = [];
    for (const fila of filas) {
      if (fila.referencia_id === null) continue;
      const caja = nombreDeLaCaja(fila.lugar, nombres, fila.terminal);
      pagos.push({
        tipo: fila.referencia_tipo === 'gasto' ? 'gasto' : 'compra',
        id: fila.referencia_id,
        caja,
        frase: frasePagado('efectivo', caja),
      });
    }
    return { pagos };
  },
});
