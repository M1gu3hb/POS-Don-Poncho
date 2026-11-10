import { asignarGruposAlProducto } from '@morphiqpos/app/catalogo';

import { manejadorDeComando } from '~/servidor/ruta';

/** DP-16 · los grupos de opciones de un producto, en su orden. */
export const POST = manejadorDeComando(asignarGruposAlProducto);

export const runtime = 'nodejs';
