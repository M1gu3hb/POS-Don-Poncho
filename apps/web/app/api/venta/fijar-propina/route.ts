import { fijarPropina } from '@morphiqpos/app/propinas';

import { manejadorDeComando } from '~/servidor/ruta';

/**
 * DP-21 · `cuenta.fijar_propina`: la Caja elige la propina y queda en el servidor en ese
 * momento, con la versión de la cuenta que leyó. Si la cuenta cambió o la propina ya la decidió
 * otra pantalla, contesta 409 con la vigente.
 */
export const POST = manejadorDeComando(fijarPropina);

export const runtime = 'nodejs';
