import { cancelacionesRegistradasComando } from '@morphiqpos/app/caja';

import { manejadorDeComando } from '~/servidor/ruta';

/**
 * Las cuentas canceladas y los platillos anulados de los últimos días, para Registros
 * (DP-12.4). No escribe nada.
 */
export const POST = manejadorDeComando(cancelacionesRegistradasComando);

export const runtime = 'nodejs';
