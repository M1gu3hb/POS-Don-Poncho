import { propinasDelRango } from '@morphiqpos/app/propinas';

import { manejadorDeComando } from '~/servidor/ruta';

/**
 * A23 · Las propinas de un rango de fechas, por mesero, sumadas en el servidor (centavos enteros, sin
 * el tope de filas del puente), con el detalle topado y su aviso. Registros › Propinas. Sólo lectura:
 * es POST porque lleva un cuerpo, como `pendientes`.
 */
export const POST = manejadorDeComando(propinasDelRango);

export const runtime = 'nodejs';
