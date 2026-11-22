import { pinesVisibles } from '@morphiqpos/app/identidad';

import { manejadorDeComando } from '~/servidor/ruta';

/**
 * DP-25 · Parte 7 · Si el dueño puede ver PIN (hay llave) y de quiénes hay copia. Sólo el dueño; no
 * lleva ningún PIN ni ninguna copia, sólo quiénes.
 */
export const POST = manejadorDeComando(pinesVisibles);

export const runtime = 'nodejs';
