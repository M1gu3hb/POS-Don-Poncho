import { vaciarElCarrito } from '@morphiqpos/app/restaurante';

import { manejadorDeComando } from '~/servidor/ruta';

/** El mesero borra el pedido entero de la mesa: los comensales se fueron (DP-12.2). */
export const POST = manejadorDeComando(vaciarElCarrito);

export const runtime = 'nodejs';
