import { describe, expect, it } from 'vitest';

import { huellaDelDispositivo } from './carrito.ts';
import { emitirTelefono, huellaDelTelefono, telefonoFirmado } from './telefono.ts';

/** DP-13.3 · El id del teléfono lo emite y lo firma el servidor. */

const PIMIENTA = 'pimienta-de-la-prueba-del-telefono-0123456789';

describe('emitirTelefono', () => {
  it('nace con la forma t1-<24 hex>-<32 hex> y la verifica la misma pimienta', () => {
    const id = emitirTelefono(PIMIENTA);
    expect(id).toMatch(/^t1-[0-9a-f]{24}-[0-9a-f]{32}$/);
    expect(id.length).toBeLessThanOrEqual(64);
    expect(telefonoFirmado(PIMIENTA, id)).toBe(true);
  });

  it('dos ids distintos no se parecen y los dos son válidos', () => {
    const [a, b] = [emitirTelefono(PIMIENTA), emitirTelefono(PIMIENTA)];
    expect(a).not.toBe(b);
    expect(telefonoFirmado(PIMIENTA, a) && telefonoFirmado(PIMIENTA, b)).toBe(true);
  });

  it('con el mismo nonce sale el mismo id (para las pruebas)', () => {
    const nonce = 'a'.repeat(24);
    expect(emitirTelefono(PIMIENTA, nonce)).toBe(emitirTelefono(PIMIENTA, nonce));
  });
});

describe('telefonoFirmado', () => {
  const bueno = emitirTelefono(PIMIENTA);

  it('rechaza un id inventado por el navegador, con la forma que sea', () => {
    for (const inventado of [
      'telefonoA_0123456789abcdef',
      'a'.repeat(32),
      't1-' + 'a'.repeat(24) + '-' + 'b'.repeat(32),
      '',
    ]) {
      expect(telefonoFirmado(PIMIENTA, inventado)).toBe(false);
    }
  });

  it('rechaza uno firmado con otra pimienta', () => {
    expect(telefonoFirmado('otra-pimienta-0123456789', bueno)).toBe(false);
  });

  it('rechaza el que cambió un solo carácter, del nonce o de la firma', () => {
    const cambiado = (i: number) =>
      bueno.slice(0, i) + (bueno[i] === 'a' ? 'b' : 'a') + bueno.slice(i + 1);
    expect(telefonoFirmado(PIMIENTA, cambiado(5))).toBe(false);
    expect(telefonoFirmado(PIMIENTA, cambiado(bueno.length - 1))).toBe(false);
  });

  it('rechaza lo que no es un texto', () => {
    for (const raro of [undefined, null, 42, {}, []]) {
      expect(telefonoFirmado(PIMIENTA, raro)).toBe(false);
    }
  });

  it('rechaza el id con algo pegado antes o después', () => {
    expect(telefonoFirmado(PIMIENTA, ` ${bueno}`)).toBe(false);
    expect(telefonoFirmado(PIMIENTA, `${bueno}0`)).toBe(false);
  });
});

describe('huellaDelTelefono', () => {
  it('de un id firmado da la huella de siempre (HMAC con la pimienta), no el id', () => {
    const id = emitirTelefono(PIMIENTA);
    const huella = huellaDelTelefono(PIMIENTA, id);
    expect(huella).toBe(huellaDelDispositivo(PIMIENTA, id));
    expect(huella).toMatch(/^[0-9a-f]{64}$/);
    expect(huella).not.toContain(id);
  });

  it('de un id sin firma válida lanza QR_TELEFONO_NO_RECONOCIDO', () => {
    expect(() => huellaDelTelefono(PIMIENTA, 'telefonoA_0123456789abcdef')).toThrow(
      expect.objectContaining({ codigo: 'QR_TELEFONO_NO_RECONOCIDO' }),
    );
  });
});
