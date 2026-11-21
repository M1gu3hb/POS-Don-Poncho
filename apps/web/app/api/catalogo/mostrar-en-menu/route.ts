import { mostrarProductoEnElMenu } from '@morphiqpos/app/catalogo';

import { manejadorDeComando } from '~/servidor/ruta';

/** DP-24 · muestra u oculta un producto en el menú digital. */
export const POST = manejadorDeComando(mostrarProductoEnElMenu);

export const runtime = 'nodejs';
