import { unirCategoriasDelMenu } from '@morphiqpos/app/catalogo';

import { manejadorDeComando } from '~/servidor/ruta';

/** DP-24 · une una categoría con otra (la que sobra se apaga) sin cambiar la estación de nadie. */
export const POST = manejadorDeComando(unirCategoriasDelMenu);

export const runtime = 'nodejs';
