import 'server-only';

import { conTransaccion, repoSesion } from '@morphiqpos/data';

import { verificarSesion } from './token.ts';

/** Revoca en el servidor la cookie que la ruta está a punto de caducar. */
export async function cerrarSesion(
  token: string | undefined,
  secreto: string,
  ahora: Date = new Date(),
): Promise<void> {
  const verificada = verificarSesion(token, secreto);
  if (!verificada.ok) return;

  // En `read write` explícito, como toda escritura de la app (DP-D92).
  await conTransaccion((tx) => repoSesion.revocarSesion(tx, verificada.carga.sid, ahora));
}
