import { fijarCajasSimultaneas } from '@morphiqpos/app/caja';

import { manejadorDeComando } from '~/servidor/ruta';

/**
 * DP-14.2 · «Cajas abiertas a la vez» (Configuración → Caja): 1 o 2. Sólo el dueño o el
 * administrador, con su entrada en la auditoría.
 */
export const POST = manejadorDeComando(fijarCajasSimultaneas);

export const runtime = 'nodejs';
