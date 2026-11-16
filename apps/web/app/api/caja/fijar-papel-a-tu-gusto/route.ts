import { fijarPapelATuGusto } from '@morphiqpos/app/caja';

import { manejadorDeComando } from '~/servidor/ruta';

/**
 * DP-21 · Bloque 12 · «El ticket y la precuenta a tu gusto» (Configuración → Ticket y folios): qué
 * renglones salen en cada papel. Sólo el dueño o el administrador, con su entrada en la auditoría.
 */
export const POST = manejadorDeComando(fijarPapelATuGusto);

export const runtime = 'nodejs';
