import { insumosBajos } from '@morphiqpos/app/inventario';

import { manejadorDeComando } from '~/servidor/ruta';

/**
 * DP-22 · El aviso de insumo bajo del Tablero: cuántos insumos están en su mínimo o por debajo (todos,
 * contados en el servidor) y los primeros nombres, del más urgente al menos. Sólo lectura.
 */
export const POST = manejadorDeComando(insumosBajos);

export const runtime = 'nodejs';
