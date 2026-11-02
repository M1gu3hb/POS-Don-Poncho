import { enviarElCarritoDeLaMesa } from '@morphiqpos/app/restaurante';

import { manejadorDeComando } from '~/servidor/ruta';

/** El mesero confirma el carrito del portal y lo manda a cocina a su nombre (DP-12.2). */
export const POST = manejadorDeComando(enviarElCarritoDeLaMesa);

export const runtime = 'nodejs';
