import { gruposDeOpciones } from '@morphiqpos/app/catalogo';

import { manejadorDeComando } from '~/servidor/ruta';

/** DP-16 · la biblioteca de grupos de opciones del negocio. No escribe nada. */
export const POST = manejadorDeComando(gruposDeOpciones);

export const runtime = 'nodejs';
