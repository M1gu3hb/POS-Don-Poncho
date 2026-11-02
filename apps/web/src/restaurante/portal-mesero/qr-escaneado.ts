/**
 * EL QR QUE ESCANEA EL MESERO (DP-12.2): de lo que lee la cámara, el token de la mesa.
 *
 * El QR de una mesa es `<origen>/qr/<token>` (`heredado/utils/qrUtils.js`); el token, la forma de
 * `portal/ambito.ts`. Se acepta también el token suelto (la entrada manual del lector) si no es sólo
 * de dígitos. Lo demás
 * —una URL de otro sitio, un código de barras de un producto— no es una mesa: `null`. El servidor
 * vuelve a comprobar que el token sea de una mesa de este negocio y de esta sucursal.
 */

const TOKEN = /^[A-Za-z0-9_-]{6,120}$/;
const RUTA = /^\/qr\/([A-Za-z0-9_-]{6,120})\/?$/;

export function tokenDelQrEscaneado(texto: string): string | null {
  const limpio = texto.trim();
  // Sólo dígitos es un código de barras (un EAN de producto), no el token de una mesa.
  if (TOKEN.test(limpio)) return /^\d+$/.test(limpio) ? null : limpio;
  let url: URL;
  try {
    url = new URL(limpio);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  return RUTA.exec(url.pathname)?.[1] ?? null;
}
