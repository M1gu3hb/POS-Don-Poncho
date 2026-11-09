import { ventasDelDiaDelCorte } from '@morphiqpos/app/caja';

import { manejadorDeComando } from '~/servidor/ruta';

/**
 * DP-15 (QA, J-H6) · Las ventas de todas las cajas del día, para el Cierre del día del corte
 * heredado (Registros → Ver PDF y la descarga al cerrar). `null` si el corte no cierra el día.
 * No escribe nada.
 */
export const POST = manejadorDeComando(ventasDelDiaDelCorte);

export const runtime = 'nodejs';
