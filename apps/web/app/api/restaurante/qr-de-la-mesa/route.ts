import { qrDeLaMesaParaElPersonal } from '@morphiqpos/app/restaurante';
import { z } from 'zod';

import { conSesion } from '~/servidor/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * `POST /api/restaurante/qr-de-la-mesa` `{ mesaId }` — «Ver QR de la mesa» (DP-12.2). POST para que
 * el token no viaje en la URL.
 */
const ENTRADA = z.object({ mesaId: z.uuid() }).strict();

export function POST(peticion: Request): Promise<Response> {
  return conSesion(
    peticion,
    async (sesion) => {
      const entrada = ENTRADA.safeParse(await peticion.json());
      if (!entrada.success) {
        return Response.json(
          { ok: false, error: { codigo: 'ENTRADA_INVALIDA', mensaje: 'Falta la mesa.' } },
          { status: 400, headers: { 'cache-control': 'no-store' } },
        );
      }
      return qrDeLaMesaParaElPersonal(sesion, entrada.data.mesaId);
    },
    { roles: ['mesero', 'gerente', 'administrador', 'dueno'] },
  );
}
