import { validarEntorno } from '@morphiqpos/contracts';
import { VARIABLE_DEL_HASH_DEL_PROVEEDOR, vigenciaDelPermiso } from '@morphiqpos/app/identidad';

import { conSesion } from '~/servidor/http';
import { permisoDeLaCookie } from '~/servidor/proveedor';

/**
 * DP-20 · ¿Este aparato tiene vigente el permiso del proveedor? La cookie es `httpOnly`: la
 * página no la puede leer, así que lo pregunta. Dice también si el despliegue tiene contraseña.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(peticion: Request): Promise<Response> {
  const entorno = validarEntorno(process.env);
  return conSesion(peticion, (sesion) => {
    const vence = vigenciaDelPermiso(
      permisoDeLaCookie(peticion.headers.get('cookie')),
      sesion.organizacionId,
      entorno.SESSION_SECRET,
    );
    const hash = process.env[VARIABLE_DEL_HASH_DEL_PROVEEDOR]?.trim() ?? '';
    return Promise.resolve({
      dentro: vence !== null,
      vence: vence === null ? null : vence.toISOString(),
      configurado: hash.startsWith('$argon2id$'),
    });
  });
}
