/**
 * QUÉ PUEDE PEDIR CADA PANTALLA AL NAVEGADOR: cámara, micrófono, ubicación (DP-13.2).
 *
 * Por omisión, nada: un POS no necesita micrófono ni ubicación, y la cámara sólo la usan las
 * pantallas que ESCANEAN. Con `camera=()` en todo, «Escanear QR» del mesero no podía funcionar:
 * el navegador niega la cámara sin preguntar. Se abre a `camera=(self)` —sólo este origen, nunca
 * un marco ajeno— en el mesero y en el cobro con escáner; el portal público del comensal y todo
 * lo demás sigue sin cámara.
 *
 * Una sola fuente: la leen `next.config.mjs`, la puerta en vivo (`scripts/verificar-cabeceras.mjs`)
 * y su prueba (`src/servidor/permisos-del-navegador.test.ts`).
 */

export const SIN_CAMARA = 'camera=(), microphone=(), geolocation=(), interest-cohort=()';
export const CON_CAMARA = 'camera=(self), microphone=(), geolocation=(), interest-cohort=()';

/** Las pantallas que escanean: el mesero («Escanear QR») y el cobro (código de barras). */
export const RUTAS_CON_CAMARA = Object.freeze(['/mesero', '/pos']);

/** La política de una ruta exacta, como la sirve Next. */
export function politicaDePermisosPara(ruta) {
  return RUTAS_CON_CAMARA.includes(ruta) ? CON_CAMARA : SIN_CAMARA;
}

/**
 * Las entradas de `headers()` de Next: la general con todas las de seguridad y, DESPUÉS, la de
 * cada ruta que escanea. Cuando dos entradas ponen la misma cabecera a una ruta, gana la última.
 */
export function cabecerasDePermisos(cabecerasDeSeguridad) {
  return [
    {
      source: '/:path*',
      headers: [...cabecerasDeSeguridad, { key: 'Permissions-Policy', value: SIN_CAMARA }],
    },
    ...RUTAS_CON_CAMARA.map((ruta) => ({
      source: ruta,
      headers: [{ key: 'Permissions-Policy', value: CON_CAMARA }],
    })),
  ];
}
