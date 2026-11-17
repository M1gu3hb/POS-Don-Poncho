import { loMasVendido } from '@morphiqpos/app/registros';

import { manejadorDeComando } from '~/servidor/ruta';

/**
 * DP-22 · «Lo más vendido» del periodo elegido: por platillo (piezas o kilos e importe, con lo devuelto
 * restando) y por mesero (cuentas, venta y propina), agregado en el servidor y en centavos enteros, sin
 * tope de filas. Sólo lectura.
 */
export const POST = manejadorDeComando(loMasVendido);

export const runtime = 'nodejs';
