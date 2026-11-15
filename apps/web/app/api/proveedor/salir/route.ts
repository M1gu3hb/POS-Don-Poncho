import { validarEntorno } from '@morphiqpos/contracts';
import { cookiesSeguras } from '@morphiqpos/app/http';

import { conSesion } from '~/servidor/http';
import { cookieDelProveedor } from '~/servidor/proveedor';

/** DP-20 · Salir del laboratorio: caduca el permiso del proveedor en este aparato. */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(peticion: Request): Promise<Response> {
  const entorno = validarEntorno(process.env);
  return conSesion(peticion, () =>
    Promise.resolve(
      Response.json(
        { ok: true, datos: { dentro: false } },
        {
          headers: {
            'cache-control': 'no-store',
            'set-cookie': cookieDelProveedor({
              permiso: '',
              maxEdadSegundos: 0,
              seguro: cookiesSeguras(entorno),
            }),
          },
        },
      ),
    ),
  );
}
