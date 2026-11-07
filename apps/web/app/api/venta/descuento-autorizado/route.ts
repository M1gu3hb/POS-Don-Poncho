import { descuentoAutorizadoComando } from '@morphiqpos/app/venta';

import { manejadorDeComando } from '~/servidor/ruta';

/**
 * DP-14 · ronda 2, medio 4 · El descuento de una cuenta, con quién lo autorizó y por qué: el cobro de
 * la Caja lo pinta junto al subtotal en bruto. Sólo lee.
 */
export const POST = manejadorDeComando(descuentoAutorizadoComando);

export const runtime = 'nodejs';
