import { avisosDeListo } from '@morphiqpos/app/restaurante';

import { manejadorDeComando } from '~/servidor/ruta';

/** DP-24 · lo que ya está listo, sólo para el mesero de esa mesa. */
export const POST = manejadorDeComando(avisosDeListo);

export const runtime = 'nodejs';
