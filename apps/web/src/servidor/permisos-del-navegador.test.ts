import { describe, expect, it } from 'vitest';

import {
  CON_CAMARA,
  RUTAS_CON_CAMARA,
  SIN_CAMARA,
  cabecerasDePermisos,
  politicaDePermisosPara,
} from '../../permisos-del-navegador.mjs';

/**
 * DP-13.2 · LA CÁMARA SÓLO DONDE SE ESCANEA.
 *
 * `camera=()` en todo bloqueaba «Escanear QR» del mesero: el navegador ni siquiera pregunta. Se
 * abre a `camera=(self)` en las dos pantallas que escanean —el mesero y el cobro con escáner— y
 * en ninguna más: el portal público del comensal sigue sin cámara.
 */

describe('la cámara, por ruta', () => {
  it('las pantallas que escanean la piden a su propio origen, y nada más', () => {
    expect(RUTAS_CON_CAMARA).toEqual(['/mesero', '/pos']);
    for (const ruta of RUTAS_CON_CAMARA) {
      expect(politicaDePermisosPara(ruta)).toBe(CON_CAMARA);
    }
    expect(CON_CAMARA).toContain('camera=(self)');
    expect(CON_CAMARA).toContain('microphone=()');
    expect(CON_CAMARA).toContain('geolocation=()');
  });

  it('todo lo demás sigue sin cámara: el portal del comensal, la entrada, la caja', () => {
    for (const ruta of [
      '/',
      '/qr/abc123',
      '/login-pos',
      '/caja',
      '/cocina',
      '/meseros',
      '/pos/x',
    ]) {
      expect(politicaDePermisosPara(ruta)).toBe(SIN_CAMARA);
    }
    expect(SIN_CAMARA).toContain('camera=()');
    expect(SIN_CAMARA).not.toContain('camera=(self)');
  });

  it('las cabeceras de Next ponen la de cámara DESPUÉS de la general, que es la que gana', () => {
    const [general, ...conCamara] = cabecerasDePermisos([
      { key: 'X-Frame-Options', value: 'DENY' },
    ]);
    expect(general?.source).toBe('/:path*');
    expect(general?.headers).toContainEqual({ key: 'Permissions-Policy', value: SIN_CAMARA });
    expect(conCamara.map((c) => c.source)).toEqual(['/mesero', '/pos']);
    for (const c of conCamara) {
      expect(c.headers).toEqual([{ key: 'Permissions-Policy', value: CON_CAMARA }]);
    }
  });
});
