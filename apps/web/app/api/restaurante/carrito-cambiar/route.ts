import { cambiarEnElCarrito } from '@morphiqpos/app/restaurante';

import { manejadorDeComando } from '~/servidor/ruta';

/** El mesero cambia la cantidad de una línea del carrito del portal (DP-12.2). */
export const POST = manejadorDeComando(cambiarEnElCarrito);

export const runtime = 'nodejs';
