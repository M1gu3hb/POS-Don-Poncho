import { auditoriaReciente } from '@morphiqpos/app/reportes';

import { manejadorDeComando } from '~/servidor/ruta';

/**
 * DP-15 · Lo más reciente de la auditoría del negocio, con quién lo hizo, para la pestaña
 * «Auditoría» de Registros. Sólo lee; dueño y administrador.
 */
export const POST = manejadorDeComando(auditoriaReciente);

export const runtime = 'nodejs';
