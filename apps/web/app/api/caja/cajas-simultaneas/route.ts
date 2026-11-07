import { cajasSimultaneas } from '@morphiqpos/app/caja';

import { manejadorDeComando } from '~/servidor/ruta';

/** DP-14.2 · Cuántas cajas puede haber abiertas a la vez en la sucursal, y cuántas lo están. */
export const POST = manejadorDeComando(cajasSimultaneas);

export const runtime = 'nodejs';
