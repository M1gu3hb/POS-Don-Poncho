import { agregarEnCaja } from '@morphiqpos/app/restaurante';

import { manejadorDeComando } from '~/servidor/ruta';

/** DP-24 · la Caja agrega productos a la cuenta que está cobrando (salen a cocina; «para llevar», marcado). */
export const POST = manejadorDeComando(agregarEnCaja);

export const runtime = 'nodejs';
