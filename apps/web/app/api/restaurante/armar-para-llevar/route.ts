import { armarParaLlevar } from '@morphiqpos/app/restaurante';

import { manejadorDeComando } from '~/servidor/ruta';

/** DP-16 · arma el pedido para llevar en el borrador de la caja (no sale a cocina hasta cobrar). */
export const POST = manejadorDeComando(armarParaLlevar);

export const runtime = 'nodejs';
