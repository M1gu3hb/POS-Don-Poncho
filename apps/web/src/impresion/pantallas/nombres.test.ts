import { describe, expect, it } from 'vitest';

import { CORTES } from '../termico/escpos.ts';
import { CONEXIONES, LENGUAJES } from '../termico/perfil.ts';
import {
  ayudaDelCorte,
  mismoDestino,
  NOMBRES_DE_CONEXIONES,
  NOMBRES_DE_CORTES,
  OPCIONES_DE_LENGUAJE,
  TODAVIA_NO_DISPONIBLE,
} from './nombres.ts';

describe('DP-20 · los nombres claros del laboratorio', () => {
  it('cada corte tiene su nombre, con la orden entre paréntesis', () => {
    expect(NOMBRES_DE_CORTES['parcial-con-avance']).toBe('Parcial con avance (GS V 66)');
    expect(NOMBRES_DE_CORTES.completo).toBe('Completo (GS V 0)');
    expect(NOMBRES_DE_CORTES.ninguno).toBe('Sin cortador');
    expect(Object.keys(NOMBRES_DE_CORTES).sort()).toEqual([...CORTES].sort());
  });

  it('«sin cortador» dice que avanza y se corta a mano', () => {
    expect(ayudaDelCorte('ninguno')).toBe('La impresora avanza y se corta a mano.');
    for (const corte of CORTES) expect(ayudaDelCorte(corte)).not.toBe('');
  });

  it('cada conexión tiene su nombre', () => {
    for (const conexion of CONEXIONES) expect(NOMBRES_DE_CONEXIONES[conexion]).not.toBe('');
  });

  it('todos los lenguajes se ofrecen; el texto ESC/POS desactivado como plan B', () => {
    expect(OPCIONES_DE_LENGUAJE.map((o) => o.valor).sort()).toEqual([...LENGUAJES].sort());
    const texto = OPCIONES_DE_LENGUAJE.find((o) => o.valor === 'escpos-texto');
    expect(texto).toMatchObject({ disponible: false, nota: 'Plan B · todavía no disponible' });
    expect(OPCIONES_DE_LENGUAJE.filter((o) => o.disponible).map((o) => o.valor)).toEqual([
      'escpos-imagen',
      'escpos-columnas',
      'driver',
    ]);
  });

  it('la lista de lo que no llegó nombra lo del encargo, cada cosa con su razón', () => {
    const titulos = TODAVIA_NO_DISPONIBLE.map((p) => p.titulo).join(' | ');
    for (const parte of ['CP437', 'Star', 'QR', 'Sunmi', 'iMin']) expect(titulos).toContain(parte);
    for (const pendiente of TODAVIA_NO_DISPONIBLE)
      expect(pendiente.motivo.length).toBeGreaterThan(10);
  });

  it('dos destinos son la misma impresora si coinciden en conexión y lugar', () => {
    const a = { conexion: 'usb', vendorId: 1, productId: 2 } as const;
    expect(mismoDestino(a, { conexion: 'usb', vendorId: 1, productId: 2 })).toBe(true);
    expect(mismoDestino(a, { conexion: 'usb', vendorId: 1, productId: 3 })).toBe(false);
    expect(mismoDestino(null, a)).toBe(false);
  });
});
