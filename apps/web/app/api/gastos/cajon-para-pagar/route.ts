import { cajonParaPagar } from '@morphiqpos/app/compras';

import { manejadorDeComando } from '~/servidor/ruta';

/**
 * DP-21 · Bloque 11 · De qué caja saldría el efectivo de un gasto o una compra, y cuánto hay en
 * ella: para decirlo y avisar ANTES de guardar. Sólo lectura.
 */
export const POST = manejadorDeComando(cajonParaPagar);

export const runtime = 'nodejs';
