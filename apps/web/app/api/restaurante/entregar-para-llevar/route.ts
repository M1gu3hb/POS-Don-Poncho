import { entregarParaLlevar } from '@morphiqpos/app/restaurante';

import { manejadorDeComando } from '~/servidor/ruta';

/** DP-16 · «Entregado»: la caja le dio al cliente su pedido para llevar. */
export const POST = manejadorDeComando(entregarParaLlevar);

export const runtime = 'nodejs';
