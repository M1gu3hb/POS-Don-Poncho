/**
 * La cookie del permiso del proveedor (DP-20 · refuerzo §2).
 *
 * Separada de la de sesión y con otra vida: la sesión del cajero dura la jornada; el permiso para
 * «Hardware y pruebas de impresión» dura 30 minutos y es de ESE aparato. `HttpOnly` (la página
 * no la lee) y `SameSite=Strict` (sólo viaja en peticiones de la propia app).
 */
export const NOMBRE_COOKIE_PROVEEDOR = 'morphiqpos_proveedor';

export interface OpcionesCookieProveedor {
  readonly permiso: string;
  readonly maxEdadSegundos: number;
  readonly seguro: boolean;
}

export function cookieDelProveedor({
  permiso,
  maxEdadSegundos,
  seguro,
}: OpcionesCookieProveedor): string {
  const partes = [
    `${NOMBRE_COOKIE_PROVEEDOR}=${encodeURIComponent(permiso)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${String(maxEdadSegundos)}`,
  ];
  if (seguro) partes.push('Secure');
  return partes.join('; ');
}

/** El permiso que trae la petición, o `undefined`. */
export function permisoDeLaCookie(cabecera: string | null): string | undefined {
  if (cabecera === null) return undefined;
  for (const parte of cabecera.split(';')) {
    const igual = parte.indexOf('=');
    if (igual > 0 && parte.slice(0, igual).trim() === NOMBRE_COOKIE_PROVEEDOR) {
      try {
        return decodeURIComponent(parte.slice(igual + 1).trim());
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}
