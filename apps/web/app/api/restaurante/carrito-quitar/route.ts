import { quitarDelCarritoDeLaMesa } from '@morphiqpos/app/restaurante';

import { manejadorDeComando } from '~/servidor/ruta';

/** El mesero quita cualquier línea del carrito del portal de la mesa (DP-12.2). */
export const POST = manejadorDeComando(quitarDelCarritoDeLaMesa);

export const runtime = 'nodejs';
