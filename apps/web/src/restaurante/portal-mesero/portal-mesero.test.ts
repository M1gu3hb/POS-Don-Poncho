import { describe, expect, it } from 'vitest';

import {
  lugarDelGlobo,
  MS_PARA_MANTENER,
  seDeslizo,
  seMantuvo,
  TOLERANCIA_PX,
} from './pulsacion-larga';
import { tokenDelQrEscaneado } from './qr-escaneado';

describe('el QR que escanea el mesero (DP-12.2)', () => {
  it('saca el token de la URL del QR de la mesa, con o sin diagonal final', () => {
    expect(tokenDelQrEscaneado('https://pos-don-poncho.vercel.app/qr/AbC_123-xyz')).toBe(
      'AbC_123-xyz',
    );
    expect(tokenDelQrEscaneado(' http://192.168.1.20:3000/qr/AbC_123-xyz/ ')).toBe('AbC_123-xyz');
  });

  it('acepta el token suelto de la entrada manual', () => {
    expect(tokenDelQrEscaneado('AbC_123-xyz')).toBe('AbC_123-xyz');
  });

  it('lo que no es el QR de una mesa no es una mesa', () => {
    for (const texto of [
      '',
      '7501055363057 ',
      'https://ejemplo.com/menu',
      'https://ejemplo.com/qr/',
      'https://ejemplo.com/qr/abc/extra',
      'javascript:alert(1)',
      'ftp://x/qr/AbC_123-xyz',
      'abc',
    ]) {
      expect(tokenDelQrEscaneado(texto)).toBeNull();
    }
  });
});

describe('mantener presionada una mesa (DP-12.2)', () => {
  const pulsacion = { mesaId: 'm1', x: 100, y: 100, inicio: 1_000 };

  it('cuenta como mantener al cumplir el tiempo, no antes', () => {
    expect(seMantuvo(pulsacion, 1_000 + MS_PARA_MANTENER - 1)).toBe(false);
    expect(seMantuvo(pulsacion, 1_000 + MS_PARA_MANTENER)).toBe(true);
  });

  it('desplazarse no es mantener: más de la tolerancia cancela', () => {
    expect(seDeslizo(pulsacion, 100 + TOLERANCIA_PX, 100)).toBe(false);
    expect(seDeslizo(pulsacion, 100 + TOLERANCIA_PX, 100 + 1)).toBe(true);
  });

  it('el globo va arriba del dedo y nunca se sale de la pantalla', () => {
    const pantalla = { ancho: 412, alto: 839 };
    const globo = { ancho: 200, alto: 100 };
    expect(lugarDelGlobo(206, 400, pantalla, globo)).toEqual({ left: 106, top: 284 });
    expect(lugarDelGlobo(5, 400, pantalla, globo).left).toBe(8);
    expect(lugarDelGlobo(410, 400, pantalla, globo).left).toBe(204);
    expect(lugarDelGlobo(206, 50, pantalla, globo).top).toBe(66);
  });
});
