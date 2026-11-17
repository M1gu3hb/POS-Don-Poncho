import {
  puenteDeLaApp,
  type ArchivosDeCortes,
  type MorphiqApp,
} from '../../impresion/puente/contrato.ts';

/**
 * ¿ESTA PÁGINA PUEDE GUARDAR LOS CORTES EN LA CARPETA? (DP-D153)
 *
 * Sólo dentro de la app de Windows 1.0.2 o más nueva: ella ANUNCIA la capacidad (`capacidades` con
 * `'archivos'`) y trae `archivos`. En un navegador, en la app 1.0.1 o en Android no hay nada de eso y
 * la página sigue como hoy. La capacidad anunciada manda: un `archivos` suelto no basta.
 */
export function archivosDeLaApp(app: MorphiqApp | null | undefined): ArchivosDeCortes | null {
  if (app === null || app === undefined) return null;
  // Lo que dice la app viene de fuera: se mira como desconocido, no como lo que el contrato promete.
  const capacidades: unknown = app.capacidades;
  const archivos = app.archivos as Partial<ArchivosDeCortes> | null | undefined;
  if (!Array.isArray(capacidades) || !capacidades.includes('archivos')) return null;
  if (typeof archivos !== 'object' || archivos === null) return null;
  if (typeof archivos.guardar !== 'function' || typeof archivos.abrirCarpeta !== 'function') {
    return null;
  }
  return archivos as ArchivosDeCortes;
}

export function archivosDeLaVentana(
  ventana: { MorphiqApp?: unknown } | undefined,
): ArchivosDeCortes | null {
  return archivosDeLaApp(puenteDeLaApp(ventana));
}

/** Lo que dice el puente cuando rechaza una llamada (un objeto plano `{ message }`) o un `Error`. */
export function mensajeDeUnRechazo(rechazo: unknown, respaldo: string): string {
  if (typeof rechazo === 'object' && rechazo !== null) {
    const { message } = rechazo as { message?: unknown };
    if (typeof message === 'string' && message !== '') return message;
  }
  return respaldo;
}

export type SalidaDeAbrir =
  { readonly ok: true; readonly ruta: string } | { readonly ok: false; readonly mensaje: string };

/** Abre la carpeta de cortes en el Explorador. Sin ruta: la app abre ESA y ninguna otra. Nunca lanza. */
export async function abrirLaCarpetaDeCortes(archivos: ArchivosDeCortes): Promise<SalidaDeAbrir> {
  try {
    const r = await archivos.abrirCarpeta();
    return r.ok ? { ok: true, ruta: r.ruta } : { ok: false, mensaje: r.mensaje };
  } catch (rechazo) {
    return {
      ok: false,
      mensaje: mensajeDeUnRechazo(rechazo, 'No se pudo abrir la carpeta de cortes.'),
    };
  }
}
