import { cajonPorCobro } from '@morphiqpos/app/caja';

import { manejadorDeComando } from '~/servidor/ruta';

/**
 * DP-20 · El cajón que se abre solo al cobrar en efectivo queda en la auditoría: quién, cuándo y
 * con qué cobro. La pantalla lo pide ANTES de mandar el pulso a la impresora del aparato. La
 * apertura sin venta es `/api/caja/cajon` (F-984).
 */
export const POST = manejadorDeComando(cajonPorCobro);

export const runtime = 'nodejs';
