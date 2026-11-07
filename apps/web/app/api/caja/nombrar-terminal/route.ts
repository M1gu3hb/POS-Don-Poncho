import { nombrarTerminal } from '@morphiqpos/app/caja';

import { manejadorDeComando } from '~/servidor/ruta';

/** DP-14 · ronda 2 · El dueño o el administrador nombra una terminal; queda en la auditoría. */
export const POST = manejadorDeComando(nombrarTerminal);

export const runtime = 'nodejs';
