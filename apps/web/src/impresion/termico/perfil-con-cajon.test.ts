import { describe, expect, it } from 'vitest';

import {
  cajonPorOmision,
  exportarPerfil,
  importarPerfil,
  leerPerfil,
  perfilPorOmision,
  type PerfilDeImpresion,
} from './perfil.ts';
import { perfilParaLaApp } from './perfil-para-la-app.ts';

/**
 * DP-21 · Bloque 7 · EL INTERRUPTOR «ESTE APARATO TIENE CAJÓN DE DINERO».
 *
 * Va en el perfil del aparato como un campo explícito (`tieneCajon`). Por omisión, apagado. Un
 * perfil guardado ANTES de que existiera el campo conserva su cajón: la regla se aplica al LEER.
 */

const IMPRESORA = { conexion: 'red', host: '192.168.1.50', puerto: 9100 } as const;
const base = (): PerfilDeImpresion => perfilPorOmision(80, IMPRESORA);

/** Lo que guardaba la app antes del Bloque 7: sin el campo `tieneCajon`. */
function guardadoAntes(conCajon: boolean): Record<string, unknown> {
  const sinElCampo = Object.entries(base()).filter(([campo]) => campo !== 'tieneCajon');
  return { ...Object.fromEntries(sinElCampo), cajon: conCajon ? cajonPorOmision() : null };
}

describe('el interruptor del cajón en el perfil', () => {
  it('un perfil nuevo lo trae apagado', () => {
    const perfil = base();
    expect(perfil.tieneCajon).toBe(false);
    expect(perfil.cajon).toBeNull();
  });

  it('un perfil guardado antes, CON cajón, lo conserva: queda encendido', () => {
    const leido = leerPerfil(guardadoAntes(true));
    expect(leido?.tieneCajon).toBe(true);
    expect(leido?.cajon).toEqual(cajonPorOmision());
  });

  it('un perfil guardado antes, SIN cajón, queda apagado', () => {
    const leido = leerPerfil(guardadoAntes(false));
    expect(leido?.tieneCajon).toBe(false);
    expect(leido?.cajon).toBeNull();
  });

  it('lo explícito manda: apagado con valores de cajón sueltos queda apagado y sin cajón', () => {
    const leido = leerPerfil({ ...guardadoAntes(true), tieneCajon: false });
    expect(leido?.tieneCajon).toBe(false);
    expect(leido?.cajon).toBeNull();
  });

  it('encendido sin cómo abrirlo (sin pulso) no es un perfil válido', () => {
    expect(leerPerfil({ ...guardadoAntes(false), tieneCajon: true })).toBeNull();
  });

  it('un valor que no es sí o no no se acepta', () => {
    expect(leerPerfil({ ...guardadoAntes(true), tieneCajon: 'sí' })).toBeNull();
  });

  it('el archivo exportado antes del Bloque 7 se importa conservando su cajón', () => {
    const viejo = JSON.stringify({
      tipo: 'morphiq-perfil-de-impresion',
      perfil: guardadoAntes(true),
    });
    const importado = importarPerfil(viejo);
    expect(importado.ok && importado.perfil.tieneCajon).toBe(true);
  });

  it('exportar e importar conserva el interruptor, encendido o apagado', () => {
    const encendido: PerfilDeImpresion = {
      ...base(),
      tieneCajon: true,
      cajon: { ...cajonPorOmision(), pin: 5 },
    };
    expect(importarPerfil(exportarPerfil(encendido))).toEqual({ ok: true, perfil: encendido });
    expect(importarPerfil(exportarPerfil(base()))).toEqual({ ok: true, perfil: base() });
  });

  it('a la app le llega sin pulso cuando el aparato no tiene cajón', () => {
    const guardado = perfilParaLaApp(base()) as { cajon: unknown; tieneCajon: boolean };
    expect(guardado.tieneCajon).toBe(false);
    expect(guardado.cajon).toBeNull();
    // Aunque a un perfil mal armado le sobre un pulso, apagado no se lo pasa a la app.
    const sobrante = perfilParaLaApp({
      ...base(),
      tieneCajon: false,
      cajon: cajonPorOmision(),
    }) as {
      cajon: unknown;
    };
    expect(sobrante.cajon).toBeNull();
    const con = perfilParaLaApp({ ...base(), tieneCajon: true, cajon: cajonPorOmision() }) as {
      cajon: { base64: string } | null;
    };
    expect(con.cajon?.base64).toEqual(expect.any(String));
  });
});
