import { nombrarCajas } from '@morphiqpos/app/caja';

import { manejadorDeComando } from '~/servidor/ruta';

/**
 * DP-21 · «El nombre de cada caja» (Configuración → Caja): un nombre por lugar de caja («Caja
 * principal», «Caja barra»). Sólo el dueño o el administrador, con su antes y su después.
 */
export const POST = manejadorDeComando(nombrarCajas);

export const runtime = 'nodejs';
