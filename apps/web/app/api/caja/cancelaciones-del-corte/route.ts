import { cancelacionesDelCorteComando } from '@morphiqpos/app/caja';

import { manejadorDeComando } from '~/servidor/ruta';

/**
 * Las cancelaciones de la ventana de una sesión de caja, con quién canceló y si ya estaba
 * preparado (DP-12.4): la lectura del corte heredado de la Caja. No escribe nada.
 */
export const POST = manejadorDeComando(cancelacionesDelCorteComando);

export const runtime = 'nodejs';
