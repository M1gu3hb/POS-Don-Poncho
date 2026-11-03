import { RUTAS_CON_CAMARA } from '../../permisos-del-navegador.mjs';

/**
 * LA CÁMARA ES DEL DOCUMENTO, NO DE LA PANTALLA (DP-13.2, decisión DP-D54).
 *
 * `Permissions-Policy` se fija cuando el navegador CARGA el documento, y Next cambia de pantalla
 * sin cargar otro. Quien entra a `/mesero` o `/pos` desde la caja, el tablero o la entrada por
 * PIN sigue en el documento de ESA ruta, con `camera=()`: el navegador niega la cámara sin
 * preguntar y «Escanear» cae al respaldo aunque la pantalla sí escanea.
 *
 * Por eso, antes de abrir el escáner se mira en qué ruta se cargó el documento. Si fue en una
 * sin cámara, se carga OTRA VEZ la misma pantalla —ahora con su cabecera— con una marca en la
 * dirección, y al llegar la pantalla abre el escáner sola y borra la marca. El carrito del cobro
 * vive en el servidor (el borrador de la terminal) y el mapa del mesero se vuelve a leer: cargar
 * de nuevo no pierde nada.
 */

export const MARCA_DE_ESCANEAR = 'escanear';

/**
 * ¿El documento cargado en `urlDeCarga` trae la cámara abierta? Sin el dato (un navegador sin
 * `performance`) se responde que sí: mejor intentar la cámara que recargar a ciegas en un ciclo.
 */
export function documentoConCamara(urlDeCarga: string | undefined): boolean {
  if (urlDeCarga === undefined || !URL.canParse(urlDeCarga)) return true;
  return RUTAS_CON_CAMARA.includes(new URL(urlDeCarga).pathname);
}

/** La misma pantalla, con la marca que le dice que abra el escáner al llegar. */
export function urlParaEscanear(href: string): string {
  const url = new URL(href);
  url.searchParams.set(MARCA_DE_ESCANEAR, '1');
  return url.toString();
}

/** La dirección sin la marca si la trae, para dejarla limpia; `null` si no la trae. */
export function sinLaMarca(href: string): string | null {
  const url = new URL(href);
  if (!url.searchParams.has(MARCA_DE_ESCANEAR)) return null;
  url.searchParams.delete(MARCA_DE_ESCANEAR);
  return url.toString();
}

/** En qué dirección cargó el navegador ESTE documento (no la que muestra ahora). */
export function urlDeCargaDelDocumento(): string | undefined {
  if (typeof performance === 'undefined') return undefined;
  const [carga] = performance.getEntriesByType('navigation');
  return carga?.name;
}
