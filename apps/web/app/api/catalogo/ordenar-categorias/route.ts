import { ordenarCategoriasDelMenu } from '@morphiqpos/app/catalogo';

import { manejadorDeComando } from '~/servidor/ruta';

/** DP-24 · ordena las secciones (categorías) del menú; con el orden que se vio, para no pisar a otra persona. */
export const POST = manejadorDeComando(ordenarCategoriasDelMenu);

export const runtime = 'nodejs';
