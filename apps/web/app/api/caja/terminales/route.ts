import { terminalesDeLaSucursal } from '@morphiqpos/app/caja';

import { manejadorDeComando } from '~/servidor/ruta';

/** DP-14 · ronda 2 · Las terminales de la sucursal y cuál tiene caja (Configuración → Caja). */
export const POST = manejadorDeComando(terminalesDeLaSucursal);

export const runtime = 'nodejs';
