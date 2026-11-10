import { guardarGrupoDeOpciones } from '@morphiqpos/app/catalogo';

import { manejadorDeComando } from '~/servidor/ruta';

/** DP-16 · guarda un grupo de opciones de la biblioteca (nombre, una o varias, obligatorio, mínimo y máximo, precio ± de cada opción). */
export const POST = manejadorDeComando(guardarGrupoDeOpciones);

export const runtime = 'nodejs';
