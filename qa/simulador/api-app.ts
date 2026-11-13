/**
 * LAS LLAMADAS A LA API DE LA APP con la sesión de una página, como las hace el propio navegador
 * (`/api/datos/consultar`, `/api/datos/escribir`, `/api/caja/…`). Sirven para LEER lo que la pantalla
 * mostraría y, sólo cuando la pantalla tiene un defecto que impide el paso, para seguir adelante
 * (y entonces se registra el incidente). Nunca tocan la base directamente.
 */
import type { Page } from '@playwright/test';

export interface RespuestaApi {
  readonly estado: number;
  readonly ok: boolean;
  readonly datos: Record<string, unknown>;
  readonly mensaje: string;
}

function cabeceras(): Record<string, string> {
  return {
    'content-type': 'application/json',
    'x-morphiqpos-request': '1',
    'idempotency-key': crypto.randomUUID(),
  };
}

/** POST a una ruta de la app con la sesión de `pagina`. No lanza por un 4xx: lo devuelve. */
export async function llamar(
  pagina: Page,
  ruta: string,
  datos: Record<string, unknown> = {},
): Promise<RespuestaApi> {
  const r = await pagina.request.post(ruta, { headers: cabeceras(), data: datos });
  const texto = await r.text();
  let cuerpo: { ok?: boolean; datos?: unknown; error?: { mensaje?: string } } = {};
  try {
    cuerpo = JSON.parse(texto) as typeof cuerpo;
  } catch (error: unknown) {
    return {
      estado: r.status(),
      ok: false,
      datos: {},
      mensaje: `respuesta que no es JSON (${String(error)}): ${texto.slice(0, 200)}`,
    };
  }
  const d = cuerpo.datos;
  return {
    estado: r.status(),
    ok: r.status() === 200 && cuerpo.ok !== false,
    datos:
      typeof d === 'object' && d !== null && !Array.isArray(d)
        ? (d as Record<string, unknown>)
        : {},
    mensaje: cuerpo.error?.mensaje ?? '',
  };
}

/** Lee una entidad del puente (`/api/datos/consultar`, operación `list`). */
export async function consultar<T extends Record<string, unknown>>(
  pagina: Page,
  entidad: string,
  extra: Record<string, unknown> = {},
): Promise<readonly T[]> {
  const r = await pagina.request.post('/api/datos/consultar', {
    headers: cabeceras(),
    data: { entidad, operacion: 'list', limite: 500, ...extra },
  });
  if (r.status() !== 200)
    throw new Error(
      `consultar ${entidad}: ${String(r.status())} ${(await r.text()).slice(0, 200)}`,
    );
  const cuerpo = (await r.json()) as { datos?: unknown };
  return Array.isArray(cuerpo.datos) ? (cuerpo.datos as T[]) : [];
}
