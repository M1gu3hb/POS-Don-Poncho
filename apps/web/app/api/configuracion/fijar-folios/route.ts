import { fijarFolios } from '@morphiqpos/app/configuracion';

import { manejadorDeComando } from '~/servidor/ruta';

/**
 * DP-21 · Bloque 6 · «Prefijo del folio» y «Primer folio» (Configuración → Ticket y folios).
 * Sólo el dueño, con su antes y su después en la auditoría. El primer folio sólo se cambia con los
 * folios en cero y mientras el negocio no opere de verdad.
 */
export const POST = manejadorDeComando(fijarFolios);

export const runtime = 'nodejs';
