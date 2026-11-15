import { fijarCopiasDeImpresion } from '@morphiqpos/app/caja';

import { manejadorDeComando } from '~/servidor/ruta';

/**
 * DP-20 · «Copias del ticket de venta», de la precuenta y del corte (Configuración → Operación):
 * de 1 a 3. Sólo el dueño o el administrador, con su entrada en la auditoría.
 */
export const POST = manejadorDeComando(fijarCopiasDeImpresion);

export const runtime = 'nodejs';
