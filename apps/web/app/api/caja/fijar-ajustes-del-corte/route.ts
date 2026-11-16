import { fijarAjustesDelCorte } from '@morphiqpos/app/caja';

import { manejadorDeComando } from '~/servidor/ruta';

/**
 * DP-21 · Bloque 20 · Si el cajero ve costos en su corte y la comisión de la terminal. Sólo el dueño o
 * el administrador, con su entrada en la auditoría.
 */
export const POST = manejadorDeComando(fijarAjustesDelCorte);

export const runtime = 'nodejs';
