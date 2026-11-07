import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * DP-13.2 · EL SONIDO NO PUEDE QUEDAR MUDO: lo que hace el proveedor, leído de su código.
 *
 * El proveedor se monta una vez por pestaña y escucha los gestos que desbloquean el audio: antes
 * sólo `click` y `keydown`, y un toque que no terminaba en clic (una tableta de cocina, un dedo que
 * arrastra) no desbloqueaba nada. Y monta el aviso «Sonido apagado · toca para activar». El
 * proyecto de unidad no pinta JSX: el contrato lee el texto, y se valida mutando el código real.
 */

const RAIZ = process.cwd().endsWith('web') ? process.cwd() : join(process.cwd(), 'apps', 'web');
const leer = (ruta: string): string => readFileSync(join(RAIZ, ruta), 'utf8');

const PROVEEDOR = 'src/sonidos/ProveedorDeSonidos.tsx';
const AVISO = 'src/sonidos/AvisoDeSonidoBloqueado.tsx';

describe('el proveedor desbloquea con cualquier gesto', () => {
  it.each(['pointerdown', 'pointerup', 'touchstart', 'touchend', 'keydown', 'click'])(
    'escucha «%s» en la fase de captura, y lo suelta al desmontarse',
    (evento) => {
      const codigo = leer(PROVEEDOR);
      expect(codigo).toMatch(new RegExp(`addEventListener\\('${evento}', \\w+, \\{ capture: true`));
      expect(codigo).toMatch(
        new RegExp(`removeEventListener\\('${evento}', \\w+, \\{ capture: true`),
      );
    },
  );

  it('monta el aviso del sonido bloqueado', () => {
    expect(leer(PROVEEDOR)).toMatch(/<AvisoDeSonidoBloqueado \/>/);
  });
});

describe('el aviso', () => {
  it('dice «Sonido apagado · toca para activar» sólo mientras el gestor lo diga', () => {
    const codigo = leer(AVISO);
    expect(codigo).toMatch(/Sonido apagado · toca para activar/);
    expect(codigo).toMatch(/useSyncExternalStore\(suscribirAlBloqueo, sonidoBloqueado/);
    expect(codigo).toMatch(/if \(!bloqueado\) return null;/);
  });

  it('DP-14.6-8 · no se queda con el toque: lo de abajo sigue a la mano (el proveedor desbloquea con cualquier toque)', () => {
    // Se queda hasta que algo suene, y arriba: si fuera un botón, taparía para siempre el botón del
    // encabezado que le tocara debajo en un aparato donde el audio no llega a correr.
    const codigo = leer(AVISO);
    expect(codigo).toMatch(/role="status"/);
    expect(codigo).not.toMatch(/pointer-events-auto/);
    expect(codigo).not.toMatch(/<Button\b/);
    expect(codigo).not.toMatch(/onClick=/);
  });
});
