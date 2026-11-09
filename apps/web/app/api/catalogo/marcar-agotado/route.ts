import { marcarAgotado } from '@morphiqpos/app/catalogo';

import { manejadorDeComando } from '~/servidor/ruta';

/**
 * DP-15 · Marcar un platillo «agotado del día» (o volver a ofrecerlo). La cocina, la gerente, el
 * administrador y el dueño; vuelve solo al empezar el día siguiente del negocio.
 */
export const POST = manejadorDeComando(marcarAgotado);

export const runtime = 'nodejs';
