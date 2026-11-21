import { moverPlatillos } from '@morphiqpos/app/restaurante';

import { manejadorDeComando } from '~/servidor/ruta';

/** DP-24 · mueve varios platillos de una columna de la cocina (el bloque de una mesa). */
export const POST = manejadorDeComando(moverPlatillos);

export const runtime = 'nodejs';
