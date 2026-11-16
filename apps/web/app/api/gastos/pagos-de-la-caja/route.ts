import { pagosDeLaCaja } from '@morphiqpos/app/compras';

import { manejadorDeComando } from '~/servidor/ruta';

/**
 * DP-21 · Bloque 11 · De qué caja salió cada gasto o compra en efectivo: «Pagado en efectivo de
 * Caja principal», para Compras y gastos. Sólo lectura.
 */
export const POST = manejadorDeComando(pagosDeLaCaja);

export const runtime = 'nodejs';
