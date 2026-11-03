import { describe, expect, it } from 'vitest';

import { estadoDe } from './http.ts';
import { LIMITES_PORTAL } from './limite.ts';

/** DP-13.3 · Qué estado HTTP lleva cada regla nueva del portal, y los límites que frenan emitir ids. */

const rechazo = (regla: string) => ({
  ok: false as const,
  error: { codigo: 'REGLA_DE_NEGOCIO' as const, mensaje: 'x', datos: { regla } },
  correlationId: 'c',
});

describe('el estado HTTP de las reglas nuevas', () => {
  it('la cuenta ya pedida es un 409 (un estado a explicar, no un fallo del servidor)', () => {
    expect(estadoDe(rechazo('QR_CUENTA_PEDIDA'))).toBe(409);
  });

  it('un teléfono que no se reconoce es un 409: la pantalla se vuelve a conectar sola', () => {
    expect(estadoDe(rechazo('QR_TELEFONO_NO_RECONOCIDO'))).toBe(409);
  });

  it('las demás reglas siguen como estaban', () => {
    expect(estadoDe(rechazo('QR_DEMASIADAS_PETICIONES'))).toBe(429);
    expect(estadoDe(rechazo('QR_PIDE_QUE_TE_ATIENDAN'))).toBe(409);
    expect(estadoDe(rechazo('UNA_REGLA_SIN_ESTADO_PROPIO'))).toBe(422);
  });
});

describe('los límites de emitir un teléfono', () => {
  it('por mesa es más estrecho que por IP: el WiFi del local es una sola IP para todas las mesas', () => {
    expect(LIMITES_PORTAL.telefono_nuevo_mesa.intentos).toBeLessThan(
      LIMITES_PORTAL.telefono_nuevo_ip.intentos,
    );
  });

  it('una mesa de diez gasta diez sin toparse; un enjambre de cientos desde una sola mesa, sí', () => {
    expect(LIMITES_PORTAL.telefono_nuevo_mesa.intentos).toBeGreaterThanOrEqual(20);
    expect(LIMITES_PORTAL.telefono_nuevo_mesa.intentos).toBeLessThanOrEqual(100);
  });
});
