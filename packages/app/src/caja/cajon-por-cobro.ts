import 'server-only';

import { PAQUETES_MOSTRADOR } from '@morphiqpos/contracts';
import type { Transaccion } from '@morphiqpos/data';
import { z } from 'zod';

import { definirComando } from '../definicion.ts';

/**
 * EL CAJÓN QUE SE ABRE AL COBRAR TAMBIÉN QUEDA EN LA AUDITORÍA (DP-20 · Parte 3.4).
 *
 * El cajón lo abre la app del aparato (un pulso a la impresora); el servidor no lo ve. La
 * apertura SIN venta ya tenía su comando (`caja.abrir_cajon`, F-984: exige la caja abierta de esa
 * terminal y la anota en el turno). Faltaba la otra: la que se dispara sola al cobrar en efectivo.
 * La pantalla la registra aquí ANTES de mandar el pulso: quién, cuándo y con qué cobro. Sin
 * migración: va en la auditoría que ya existe.
 */

export const QUIEN_COBRA = ['cajero', 'gerente', 'administrador', 'dueno'] as const;

export const entradaCajonPorCobro = z.object({
  /** Lo que se cobró («12»), para leerlo en la auditoría. Sólo texto: no decide nada. */
  referencia: z.string().trim().min(1).max(40).optional(),
});

export interface ResultadoCajonPorCobro {
  readonly registrado: true;
  readonly cuando: string;
}

export const cajonPorCobro = definirComando<
  Transaccion,
  typeof entradaCajonPorCobro,
  ResultadoCajonPorCobro
>({
  nombre: 'caja.cajon_por_cobro',
  entidad: 'sesion_caja',
  escribe: true,
  roles: [...QUIEN_COBRA],
  paquetes: PAQUETES_MOSTRADOR,
  entrada: entradaCajonPorCobro,
  ejecutar(ctx, entrada) {
    ctx.auditar({
      entidadId: null,
      payload: {
        motivo: 'cobro',
        ...(entrada.referencia === undefined ? {} : { referencia: entrada.referencia }),
      },
    });
    return Promise.resolve({ registrado: true, cuando: ctx.ahora.toISOString() });
  },
});
