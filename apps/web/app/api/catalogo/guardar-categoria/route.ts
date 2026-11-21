import { guardarCategoriaDelMenu } from '@morphiqpos/app/catalogo';

import { manejadorDeComando } from '~/servidor/ruta';

/** DP-24 · renombra una categoría y le pone su color de la paleta. */
export const POST = manejadorDeComando(guardarCategoriaDelMenu);

export const runtime = 'nodejs';
