/**
 * LA RUTA COMODÍN DE LA API (DP-14.6): lo que no existe contesta 404.
 *
 * Un POST a una ruta de `/api` que no existe caía en la página de «no encontrada» de la
 * aplicación y contestaba 200 con HTML: quien llamaba creía que su comando había salido bien. Las
 * rutas reales son más específicas y ganan siempre; esto sólo atrapa lo que no es de nadie.
 * Sin sesión, sin base y sin leer el cuerpo: no hace nada que se pueda abusar.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function noExiste(): Response {
  return Response.json(
    { ok: false, error: { codigo: 'RUTA_NO_ENCONTRADA', mensaje: 'Esa ruta no existe.' } },
    { status: 404, headers: { 'cache-control': 'no-store' } },
  );
}

export const GET = noExiste;
export const POST = noExiste;
export const PUT = noExiste;
export const PATCH = noExiste;
export const DELETE = noExiste;
export const OPTIONS = noExiste;
