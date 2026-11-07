import { descuentosDelCorteComando } from '@morphiqpos/app/caja';

import { manejadorDeComando } from '~/servidor/ruta';

/**
 * DP-14.2 · Los descuentos de la ventana de una sesión de caja, cada uno con quién lo autorizó y
 * por qué: la lectura del corte heredado de la Caja (y del Cierre del día). No escribe nada.
 */
export const POST = manejadorDeComando(descuentosDelCorteComando);

export const runtime = 'nodejs';
