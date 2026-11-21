import { agregarALaUnionComando } from '@morphiqpos/app/restaurante';

import { manejadorDeComando } from '~/servidor/ruta';

export const POST = manejadorDeComando(agregarALaUnionComando);

export const runtime = 'nodejs';
