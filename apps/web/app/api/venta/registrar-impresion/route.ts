import { registrarImpresion } from '@morphiqpos/app/venta';

import { manejadorDeComando } from '~/servidor/ruta';

/**
 * DP-20 · Cada ticket que sale queda registrado. La primera vez es la original; desde la segunda
 * el servidor contesta «reimpresión» con su fecha y hora, y el papel lo dice.
 */
export const POST = manejadorDeComando(registrarImpresion);

export const runtime = 'nodejs';
