import { paraLlevarDelDia } from '@morphiqpos/app/restaurante';

import { manejadorDeComando } from '~/servidor/ruta';

/** DP-16 · los pedidos para llevar del día y cómo van en la cocina. No escribe nada. */
export const POST = manejadorDeComando(paraLlevarDelDia);

export const runtime = 'nodejs';
