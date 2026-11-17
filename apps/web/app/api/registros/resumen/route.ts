import { resumenDelPeriodo } from '@morphiqpos/app/registros';

import { manejadorDeComando } from '~/servidor/ruta';

/**
 * H3 · El resumen de Registros (ventas, costo, utilidad, propinas, compras, gastos y neto) del periodo
 * elegido, agregado en el servidor y en centavos enteros, sin el tope de filas del puente. Sólo lectura.
 */
export const POST = manejadorDeComando(resumenDelPeriodo);

export const runtime = 'nodejs';
