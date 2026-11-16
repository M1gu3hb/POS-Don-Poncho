import { fijarCandadoDeMando } from '@morphiqpos/app/configuracion';

import { manejadorDeComando } from '~/servidor/ruta';

/**
 * DP-21 · «Entrar con PIN» (Configuración → Personas y seguridad): a los cuántos minutos sin
 * tocar la pantalla se cierra la sesión del dueño, el administrador y el gerente (de 5 a 30).
 * Sólo el dueño o el administrador, con su antes y su después en la auditoría.
 */
export const POST = manejadorDeComando(fijarCandadoDeMando);

export const runtime = 'nodejs';
