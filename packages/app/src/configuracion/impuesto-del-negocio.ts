import type { ReglaImpuesto } from '@morphiqpos/domain/venta';
import { z } from 'zod';

/**
 * EL IVA DEL NEGOCIO (DP-21 · Bloque 1): `configuracion.valores.impuesto`.
 *
 * Un solo lector para una sola clave. Antes había dos nombres para lo mismo: la pantalla de
 * Configuración guardaba `iva_porcentaje` y la cotización leía `impuesto.puntosBase`. El campo
 * de la pantalla no estaba conectado a nada, así que cada cuenta se cobraba con la tasa por
 * omisión (16 % incluido) aunque el dueño hubiera puesto «0».
 *
 * `iva_porcentaje` se retiró: no se lee ni se escribe en ningún lado. Lo que una pantalla
 * necesite saber del IVA lo deriva de aquí.
 *
 * Este archivo no toca la base ni depende del servidor: lo usan la cotización
 * (`venta/cotizar.ts`), el puente que sirve a las pantallas (`puente/configuracion.ts`) y el
 * comando que lo guarda (`configuracion/impuesto.ts`).
 */

export const CLAVE_DEL_IMPUESTO = 'impuesto';

/** Las tasas de IVA que existen en México y que el dominio sabe calcular: 0, 8 % y 16 %. */
export const TASAS_DE_IVA = [0, 800, 1600] as const;
export type TasaDeIva = (typeof TASAS_DE_IVA)[number];

export interface ImpuestoDelNegocio {
  /** La tasa en puntos base: 1600 = 16 %. Entero, para que no exista un 16.000000001. */
  readonly puntosBase: number;
  /** `true`: el precio de la carta ya lleva el IVA y sólo se informa. `false`: se suma encima. */
  readonly incluidoEnPrecio: boolean;
}

/**
 * Con lo que nace un negocio y con lo que cobra el que nunca lo tocó: 16 % incluido en el
 * precio, el IVA general de México con precios de mostrador. No cambió con DP-21.
 */
export const IMPUESTO_DE_UN_NEGOCIO_NUEVO: ImpuestoDelNegocio = {
  puntosBase: 1600,
  incluidoEnPrecio: true,
};

/**
 * Lo que se puede GUARDAR: una de las tres tasas y si va incluida. Estricto: un campo de más
 * (un total, un importe) no entra al documento.
 */
export const esquemaDelImpuesto = z.strictObject({
  puntosBase: z.union([z.literal(0), z.literal(800), z.literal(1600)]),
  incluidoEnPrecio: z.boolean(),
});

/**
 * Lo que se acepta al LEER. Más ancho que lo que se guarda, a propósito: un negocio que traía
 * otra tasa de antes (hasta 35 %, el tope de siempre) sigue cobrando con la suya hasta que su
 * dueño la cambie en la pantalla.
 */
const impuestoGuardado = z.object({
  puntosBase: z.number().int().min(0).max(3500).optional(),
  incluidoEnPrecio: z.boolean().optional(),
});

function esDocumento(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

/**
 * El impuesto que dice el documento de configuración. Lo que falte se completa con lo de un
 * negocio nuevo, y un impuesto dañado NO tumba la venta: se cobra con el general y el negocio
 * sigue operando (dejar de vender por un JSON malformado sería peor).
 *
 * Ojo con el cero: «Sin IVA» es un dato, no la ausencia de uno. Por eso se completa con `??`.
 */
export function impuestoEn(valores: unknown): ImpuestoDelNegocio {
  if (!esDocumento(valores)) return IMPUESTO_DE_UN_NEGOCIO_NUEVO;
  const leido = impuestoGuardado.safeParse(valores[CLAVE_DEL_IMPUESTO]);
  if (!leido.success) return IMPUESTO_DE_UN_NEGOCIO_NUEVO;
  return {
    puntosBase: leido.data.puntosBase ?? IMPUESTO_DE_UN_NEGOCIO_NUEVO.puntosBase,
    incluidoEnPrecio: leido.data.incluidoEnPrecio ?? IMPUESTO_DE_UN_NEGOCIO_NUEVO.incluidoEnPrecio,
  };
}

/** Lo mismo, con los nombres que usa el dominio para calcular los totales. */
export function reglaDeImpuestoEn(valores: unknown): ReglaImpuesto {
  const { puntosBase, incluidoEnPrecio } = impuestoEn(valores);
  return { tasaPuntosBase: puntosBase, incluidoEnPrecio };
}
