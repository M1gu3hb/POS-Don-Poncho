import { moverProductosACategoria } from '@morphiqpos/app/catalogo';

import { manejadorDeComando } from '~/servidor/ruta';

/** DP-24 · mueve productos de categoría sin cambiarles la estación de preparación. */
export const POST = manejadorDeComando(moverProductosACategoria);

export const runtime = 'nodejs';
