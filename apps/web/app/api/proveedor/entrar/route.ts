import { validarEntorno } from '@morphiqpos/contracts';
import { cookiesSeguras, devolver, permitir } from '@morphiqpos/app/http';
import {
  comprobarClaveDelProveedor,
  dejarRastroDelProveedor,
  firmarPermisoDelProveedor,
  VARIABLE_DEL_HASH_DEL_PROVEEDOR,
  VIGENCIA_DEL_PERMISO_SEGUNDOS,
} from '@morphiqpos/app/identidad';
import { correlationIdDe } from '@morphiqpos/app/observabilidad';
import { z } from 'zod';

import { conSesion } from '~/servidor/http';
import { cookieDelProveedor } from '~/servidor/proveedor';

/**
 * ENTRAR A «HARDWARE Y PRUEBAS DE IMPRESIÓN» (DP-20 · refuerzo §2).
 *
 * Sólo el proveedor (Morphiq) entra, con su contraseña. Se compara AQUÍ contra el hash del
 * despliegue; la contraseña no existe en el código ni viaja de vuelta. Cinco fallos desde el
 * mismo origen y hay que esperar 15 minutos (`LIMITES.proveedor`); la buena devuelve su intento.
 * Cada entrada y cada fallo quedan en la auditoría. Si acierta, el aparato recibe un permiso
 * firmado de 30 minutos en una cookie `httpOnly`.
 *
 * Nunca un 401: para el cliente es «tu sesión venció» y cerraría la sesión de quien está en caja.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Entrada = z.object({ clave: z.string().min(1).max(200) });

const SIN_CACHE = { 'cache-control': 'no-store' } as const;

function negar(estado: 400 | 403 | 429, codigo: string, mensaje: string, datos?: object): Response {
  return Response.json(
    { ok: false, error: { codigo, mensaje, ...(datos === undefined ? {} : { datos }) } },
    { status: estado, headers: SIN_CACHE },
  );
}

export async function POST(peticion: Request): Promise<Response> {
  const entorno = validarEntorno(process.env);
  return conSesion(peticion, async (sesion) => {
    const cuerpo: unknown = await peticion.json().catch(() => null);
    const validada = Entrada.safeParse(cuerpo);
    if (!validada.success) return negar(400, 'ENTRADA_INVALIDA', 'Falta la contraseña.');

    const permiso = await permitir('proveedor', peticion.headers, entorno.PIN_PEPPER);
    if (!permiso.ok) {
      return negar(429, 'LIMITE_DE_TASA', 'Demasiados intentos. Espera 15 minutos.', {
        esperaSegundos: permiso.esperaSegundos,
      });
    }

    const quien = {
      organizacionId: sesion.organizacionId,
      identidadId: sesion.identidadId,
      terminalId: sesion.terminalId,
      empleoId: sesion.empleoId,
      rol: sesion.rol,
      correlationId: correlationIdDe(
        peticion.headers.get('x-correlation-id') ??
          peticion.headers.get('x-morphiqpos-correlacion'),
      ),
    };
    const comprobada = await comprobarClaveDelProveedor(
      validada.data.clave,
      process.env[VARIABLE_DEL_HASH_DEL_PROVEEDOR],
    );
    if (comprobada !== 'correcta') {
      await dejarRastroDelProveedor(quien, false);
      return negar(
        403,
        'SIN_PERMISO',
        comprobada === 'sin_configurar'
          ? 'Este laboratorio todavía no tiene contraseña. Avisa a tu proveedor MORPHIQ.'
          : 'La contraseña no es correcta.',
      );
    }

    await devolver('proveedor', peticion.headers, entorno.PIN_PEPPER);
    await dejarRastroDelProveedor(quien, true);
    const firmado = firmarPermisoDelProveedor(
      sesion.organizacionId,
      sesion.identidadId,
      entorno.SESSION_SECRET,
    );
    return Response.json(
      { ok: true, datos: { dentro: true, vence: firmado.vence.toISOString() } },
      {
        headers: {
          ...SIN_CACHE,
          'set-cookie': cookieDelProveedor({
            permiso: firmado.permiso,
            maxEdadSegundos: VIGENCIA_DEL_PERMISO_SEGUNDOS,
            seguro: cookiesSeguras(entorno),
          }),
        },
      },
    );
  });
}
