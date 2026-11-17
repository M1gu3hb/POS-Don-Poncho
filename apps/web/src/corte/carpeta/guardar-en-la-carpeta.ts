import type { ArchivosDeCortes } from '../../impresion/puente/contrato.ts';
import { aBase64 } from '../../impresion/termico/trabajo.ts';

import { mensajeDeUnRechazo } from './archivos-de-la-app.ts';

/**
 * GUARDAR EL PDF DEL CORTE EN LA CARPETA (DP-D153).
 *
 * Nunca lanza: o es «guardado» o es un aviso con el motivo. Y no espera para siempre: pasado el plazo
 * dice que tardó (guardar el mismo corte otra vez no duplica, así que reintentar es seguro).
 */
export const TIEMPO_MAXIMO_DEL_GUARDADO_MS = 30_000;

export interface CorteAGuardar {
  /** Ya en la forma que acepta la app (`folioParaElArchivo`). */
  readonly folio: string;
  /** `AAAA-MM-DD` (`fechaParaElArchivo`). */
  readonly fecha: string;
  readonly pdf: Blob;
}

export type SalidaDelGuardado =
  | {
      readonly ok: true;
      readonly estado: 'guardado' | 'ya-estaba' | 'reemplazado';
      readonly ruta: string;
    }
  | { readonly ok: false; readonly mensaje: string };

const MENSAJE_SI_FALLA = 'No se pudo guardar el PDF en la carpeta de cortes.';
const MENSAJE_SI_TARDA = 'El guardado tardó demasiado. Vuelve a intentarlo.';

export async function guardarCorteEnLaCarpeta(
  archivos: ArchivosDeCortes,
  corte: CorteAGuardar,
  { tiempoMaximoMs = TIEMPO_MAXIMO_DEL_GUARDADO_MS }: { readonly tiempoMaximoMs?: number } = {},
): Promise<SalidaDelGuardado> {
  let reloj: ReturnType<typeof setTimeout> | undefined;
  try {
    const base64 = aBase64(new Uint8Array(await corte.pdf.arrayBuffer()));
    const plazo = new Promise<SalidaDelGuardado>((resolver) => {
      reloj = setTimeout(() => {
        resolver({ ok: false, mensaje: MENSAJE_SI_TARDA });
      }, tiempoMaximoMs);
    });
    const guardado = (async (): Promise<SalidaDelGuardado> => {
      const r = await archivos.guardar({ folio: corte.folio, fecha: corte.fecha, base64 });
      return r.ok
        ? { ok: true, estado: r.estado, ruta: r.ruta }
        : { ok: false, mensaje: r.mensaje };
    })().catch((rechazo: unknown): SalidaDelGuardado => ({
      ok: false,
      mensaje: mensajeDeUnRechazo(rechazo, MENSAJE_SI_FALLA),
    }));
    return await Promise.race([guardado, plazo]);
  } catch (rechazo) {
    return { ok: false, mensaje: mensajeDeUnRechazo(rechazo, MENSAJE_SI_FALLA) };
  } finally {
    clearTimeout(reloj);
  }
}
