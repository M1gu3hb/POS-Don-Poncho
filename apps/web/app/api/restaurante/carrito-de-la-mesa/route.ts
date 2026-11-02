import { leerElCarritoParaElMesero } from '@morphiqpos/app/restaurante';
import { z } from 'zod';

import { conSesion } from '~/servidor/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * `POST /api/restaurante/carrito-de-la-mesa` — DP-12.2 · el carrito del portal de una mesa, para el
 * mesero: `{ mesaId }` (la que tiene abierta) o `{ qr }` (el token que acaba de escanear).
 *
 * POST aunque sólo lee, como el puente: el token del QR es la credencial de la mesa y en la URL
 * acabaría en los registros del proxy. Dentro de su sesión; el negocio y la sucursal los decide el
 * servidor. Se sondea: no se audita (los cambios sí, son comandos).
 */
const BUSQUEDA = z.union([
  z.object({ mesaId: z.uuid() }).strict(),
  z.object({ qr: z.string().regex(/^[A-Za-z0-9_-]{6,120}$/) }).strict(),
]);

export function POST(peticion: Request): Promise<Response> {
  return conSesion(
    peticion,
    async (sesion) => {
      const busqueda = BUSQUEDA.safeParse(await peticion.json());
      if (!busqueda.success) {
        return Response.json(
          { ok: false, error: { codigo: 'ENTRADA_INVALIDA', mensaje: 'Falta la mesa o su QR.' } },
          { status: 400, headers: { 'cache-control': 'no-store' } },
        );
      }
      return leerElCarritoParaElMesero(sesion, busqueda.data);
    },
    { roles: ['mesero', 'gerente', 'administrador', 'dueno'] },
  );
}
