import { descartarParaLlevar } from '@morphiqpos/app/restaurante';

import { manejadorDeComando } from '~/servidor/ruta';

/** DP-16 · el cobro del pedido para llevar se canceló: el borrador queda vacío. */
export const POST = manejadorDeComando(descartarParaLlevar);

export const runtime = 'nodejs';
