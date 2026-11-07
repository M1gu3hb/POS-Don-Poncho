import { permitirDescuentos } from '@morphiqpos/app/venta';

import { manejadorDeComando } from '~/servidor/ruta';

/**
 * DP-14.2 · «Permitir descuentos» (Configuración → Descuentos). Sólo el dueño o el
 * administrador, con su entrada en la auditoría; apagados, el servidor rechaza todo descuento.
 */
export const POST = manejadorDeComando(permitirDescuentos);

export const runtime = 'nodejs';
