import { ordenarProductosDeLaCategoria } from '@morphiqpos/app/catalogo';

import { manejadorDeComando } from '~/servidor/ruta';

/** DP-24 · ordena los productos dentro de una categoría. */
export const POST = manejadorDeComando(ordenarProductosDeLaCategoria);

export const runtime = 'nodejs';
