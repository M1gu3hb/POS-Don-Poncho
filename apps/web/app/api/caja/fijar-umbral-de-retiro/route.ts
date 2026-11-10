import { fijarUmbralDeRetiro } from '@morphiqpos/app/caja';

import { manejadorDeComando } from '~/servidor/ruta';

/**
 * DP-16 · «Pedir PIN de gerente en retiros mayores a $X» (Configuración → Caja). Sólo el dueño o
 * el administrador, con su entrada en la auditoría. Vacío (`null`) = no se pide.
 */
export const POST = manejadorDeComando(fijarUmbralDeRetiro);

export const runtime = 'nodejs';
