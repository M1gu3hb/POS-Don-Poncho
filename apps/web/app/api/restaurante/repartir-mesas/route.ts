import { repartirMesas } from '@morphiqpos/app/restaurante';

import { manejadorDeComando } from '~/servidor/ruta';

/** DP-14 · asignar varias mesas a un mesero (o dejarlas sin asignar) en una sola transacción. */
export const POST = manejadorDeComando(repartirMesas);

export const runtime = 'nodejs';
