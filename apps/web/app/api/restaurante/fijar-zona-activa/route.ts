import { fijarZonaActiva } from '@morphiqpos/app/restaurante';

import { manejadorDeComando } from '~/servidor/ruta';

/**
 * DP-15.1 · Desactivar o reactivar una zona del salón. No se deja con mesas ocupadas, con cuenta
 * abierta o unidas; con las mesas libres, las apaga con la zona y al reactivar vuelven las mismas.
 */
export const POST = manejadorDeComando(fijarZonaActiva);

export const runtime = 'nodejs';
