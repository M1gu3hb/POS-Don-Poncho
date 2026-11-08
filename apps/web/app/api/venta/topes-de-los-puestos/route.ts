import { topesDeLosPuestos } from '@morphiqpos/app/venta';

import { manejadorDeComando } from '~/servidor/ruta';

/**
 * DP-14 · ronda 2 (menor) · Lo que de verdad autoriza cada puesto con su PIN, para Configuración →
 * Descuentos (dueño y administrador). Sólo lee.
 */
export const POST = manejadorDeComando(topesDeLosPuestos);

export const runtime = 'nodejs';
