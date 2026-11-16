import { fijarImpuesto } from '@morphiqpos/app/configuracion';

import { manejadorDeComando } from '~/servidor/ruta';

/**
 * DP-21 · «IVA» (Configuración → Ventas y cobro): sin IVA, 8 % o 16 %, y si los precios ya lo
 * incluyen. Sólo el dueño o el administrador, con su antes y su después en la auditoría.
 */
export const POST = manejadorDeComando(fijarImpuesto);

export const runtime = 'nodejs';
