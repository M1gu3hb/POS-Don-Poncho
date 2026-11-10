import { validarEntorno } from '@morphiqpos/contracts';
import { devolver, permitir } from '@morphiqpos/app/http';
import { autorizarConPin, topeDelAutorizador } from '@morphiqpos/app/identidad';
import { z } from 'zod';

import { conSesion } from '~/servidor/http';

/**
 * EL PIN DEL SUPERVISOR EN ESTA TERMINAL (F-205, D-28 de la 2.4).
 *
 * La cajera, con su sesión, manda el empleo del supervisor y el PIN que él tecleó; si es
 * bueno y su puesto autoriza, vuelve una autorización firmada de dos minutos que el
 * descuento presenta al aplicarse. La comprobación es la de `autorizarConPin`, con el
 * mismo bloqueo por intentos que la entrada.
 *
 * Y su propio LÍMITE POR ORIGEN (`LIMITES.supervisor`, DP-14.6): probar el PIN del gerente desde
 * la caja es un barrido igual que probarlo en la pantalla de acceso, pero cuenta en SU cubo: los
 * fallos de aquí no gastan la cuota de entrar de toda la IP del restaurante. Como en la entrada, el PIN CORRECTO devuelve su intento
 * (QA2-001, DP-13.5): todo el local sale por la misma IP, y las autorizaciones buenas de una
 * noche llena dejaban a todos sin poder entrar.
 *
 * DP-13.2 (D-5) · Con `ordenId`, la autorización va atada a ESA cuenta, y con `para` a lo que se
 * autoriza (un descuento o una cancelación): la que el gerente dio para la mesa 3 no sirve en la 6.
 *
 * Las respuestas no distinguen «no existe» de «PIN incorrecto»: las dos son el mismo 403.
 * NUNCA un 401: para el cliente un 401 es «tu sesión venció», y un PIN mal tecleado del
 * gerente cerraría la sesión de la cajera con la venta armada. El bloqueo es un 429, como
 * en la entrada.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Entrada = z.object({
  empleoId: z.uuid(),
  pin: z.string().min(1).max(16),
  ordenId: z.uuid().optional(),
  para: z.enum(['descuento', 'cancelacion', 'retiro']).optional(),
  /** DP-14.2 · El descuento exacto que se autoriza, en centavos: la firma lo lleva. */
  montoCentavos: z.number().int().min(1).max(100_000_000).optional(),
});

const ESTADO_POR_MOTIVO = {
  credenciales: 403,
  bloqueada: 429,
  no_autoriza: 403,
  uno_mismo: 403,
} as const;

const MENSAJE_POR_MOTIVO = {
  credenciales: 'El PIN no es correcto.',
  bloqueada: 'Ese PIN se bloqueó por intentos. Espera un momento.',
  no_autoriza: 'Esa persona no puede autorizarlo: hace falta un gerente o el dueño.',
  uno_mismo: 'Nadie se autoriza a sí mismo.',
} as const;

export async function POST(peticion: Request): Promise<Response> {
  const entorno = validarEntorno(process.env);
  const permiso = await permitir('supervisor', peticion.headers, entorno.PIN_PEPPER);
  if (!permiso.ok) {
    return Response.json(
      {
        ok: false,
        error: {
          codigo: 'LIMITE_DE_TASA',
          mensaje: 'Demasiados intentos desde esta red. Espera unos minutos.',
        },
      },
      { status: 429, headers: { 'cache-control': 'no-store' } },
    );
  }

  return conSesion(peticion, async (sesion) => {
    const cuerpo: unknown = await peticion.json().catch(() => null);
    const validada = Entrada.safeParse(cuerpo);
    if (!validada.success) {
      return Response.json(
        {
          ok: false,
          error: { codigo: 'ENTRADA_INVALIDA', mensaje: 'Falta quién autoriza o su PIN.' },
        },
        { status: 400, headers: { 'cache-control': 'no-store' } },
      );
    }
    const resultado = await autorizarConPin({
      organizacionId: sesion.organizacionId,
      solicitaEmpleoId: sesion.empleoId,
      empleoId: validada.data.empleoId,
      pin: validada.data.pin,
      ...(validada.data.ordenId === undefined ? {} : { cuenta: validada.data.ordenId }),
      ...(validada.data.para === undefined ? {} : { para: validada.data.para }),
      ...(validada.data.montoCentavos === undefined
        ? {}
        : { montoCentavos: validada.data.montoCentavos }),
      pimienta: entorno.PIN_PEPPER,
      secreto: entorno.SESSION_SECRET,
    });
    if (!resultado.ok) {
      return Response.json(
        {
          ok: false,
          error: {
            codigo: resultado.motivo === 'bloqueada' ? 'LIMITE_DE_TASA' : 'SIN_PERMISO',
            mensaje: MENSAJE_POR_MOTIVO[resultado.motivo],
            ...(resultado.esperaSegundos === undefined
              ? {}
              : // DP-14.6 · En `datos`, que es donde la pantalla lee la carga del fallo.
                { datos: { esperaSegundos: resultado.esperaSegundos } }),
          },
        },
        { status: ESTADO_POR_MOTIVO[resultado.motivo], headers: { 'cache-control': 'no-store' } },
      );
    }
    await devolver('supervisor', peticion.headers, entorno.PIN_PEPPER);
    // Ronda 2 (medio 5) · Hasta cuánto llega ese PIN: la pantalla lo dice y no deja pasar de ahí.
    // Sólo se AGREGAN campos: el contrato de antes (autorizacion, rol, vence) no cambia.
    const tope = await topeDelAutorizador(sesion.organizacionId, resultado.rol);
    return {
      autorizacion: resultado.autorizacion,
      rol: resultado.rol,
      vence: resultado.vence,
      topeCentavos: tope.topeCentavos,
      topeBp: tope.topeBp,
    };
  });
}
