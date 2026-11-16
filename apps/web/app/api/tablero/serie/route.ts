import { serieDelTableroComando } from '@morphiqpos/app/tablero';

import { manejadorDeComando } from '~/servidor/ruta';

/**
 * DP-21 · Bloque 13 · «¿Cómo va tu semana?»: ventas, cuentas, ticket promedio, gastos y utilidad por
 * hora, día o mes del NEGOCIO, agregados en el servidor y en centavos enteros. Sólo lectura.
 */
export const POST = manejadorDeComando(serieDelTableroComando);

export const runtime = 'nodejs';
