import { fijarQuienEligeLaPropina } from '@morphiqpos/app/propinas';

import { manejadorDeComando } from '~/servidor/ruta';

/**
 * DP-21 · «¿Quién puede elegir la propina?» (Configuración → Ventas y cobro → Propinas): los
 * comensales, el mesero y la Caja. Sólo el dueño o el administrador, con su auditoría.
 */
export const POST = manejadorDeComando(fijarQuienEligeLaPropina);

export const runtime = 'nodejs';
