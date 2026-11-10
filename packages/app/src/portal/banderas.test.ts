import { describe, expect, it } from 'vitest';

import { banderasDe } from './banderas.ts';

/**
 * DP-16 · EL MODO DEL MENÚ DEL PORTAL: el menú digital es el estilo nuevo del sistema.
 *
 * Un negocio que nunca eligió modo ve el menú digital; el que eligió uno lo conserva (Don Poncho
 * sigue en «Páginas subidas» hasta que lo cambie). Lo que no es un modo conocido cae al digital.
 */
describe('banderasDe · modoMenu', () => {
  it('sin elegir, el menú digital', () => {
    expect(banderasDe({}).modoMenu).toBe('digital');
  });

  it.each(['digital', 'productos_pos', 'menu_subido', 'mixto'] as const)(
    'respeta el modo elegido: %s',
    (modo) => {
      expect(banderasDe({ portal_qr_modo_menu: modo }).modoMenu).toBe(modo);
    },
  );

  it('un modo desconocido cae al digital', () => {
    expect(banderasDe({ portal_qr_modo_menu: 'raro' }).modoMenu).toBe('digital');
  });
});
