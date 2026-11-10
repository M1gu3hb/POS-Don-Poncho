import { opcionesDeLosPlatillos } from '@morphiqpos/app/restaurante';

import { conSesion } from '~/servidor/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * `POST /api/restaurante/opciones-de-los-platillos` — QA1-4 (DP-13.5) · los grupos de opciones de
 * cada platillo de la carta, con cuáles son obligatorios: el mesero los pide antes de mandar a
 * cocina y el editor de Productos los muestra. POST aunque sólo lee, como el puente. Dentro de su
 * sesión; el negocio lo decide el servidor.
 */
export function POST(peticion: Request): Promise<Response> {
  return conSesion(peticion, (sesion) => opcionesDeLosPlatillos(sesion), {
    roles: ['mesero', 'cajero', 'gerente', 'administrador', 'dueno'],
  });
}
