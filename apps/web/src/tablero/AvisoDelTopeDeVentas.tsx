'use client';

import { Aviso } from '@morphiqpos/ui/sistema';

import { avisoDelTopeDeVentas } from './dia-del-negocio.ts';

/**
 * DP-15.1 · Si la lectura de «ventas de hoy» llegó justo al tope, lo que hay detrás no se sumó:
 * se dice, en lugar de enseñar totales mudos.
 */
export function AvisoDelTopeDeVentas({ recibidas }: { readonly recibidas: number }) {
  const texto = avisoDelTopeDeVentas(recibidas);
  if (texto === null) return null;
  return <Aviso tono="atencion" titulo={texto} />;
}
