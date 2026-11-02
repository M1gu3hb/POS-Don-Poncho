import { describe, expect, it } from 'vitest';

import {
  ACCION_DE_LA_LIMPIEZA,
  ENTRE_LIMPIEZAS_MS,
  tocaLimpiar,
} from './limpieza-de-solicitudes.ts';
import { entradaLimpiarSolicitudes, limpiarSolicitudes } from './solicitudes.ts';

/**
 * DP-12.6 · LA LIMPIEZA AUTOMÁTICA DE SOLICITUDES CORRE A LO MUCHO UNA VEZ POR HORA y por negocio.
 *
 * La decisión es esta función; saber CUÁNDO fue la última vez lo hace la base
 * (`limpieza-de-solicitudes.integracion.test.ts`).
 */

const AHORA = new Date('2026-11-01T18:00:00.000Z');
const haceMs = (ms: number): Date => new Date(AHORA.getTime() - ms);

describe('¿le toca limpiar a este negocio?', () => {
  it('si nunca se ha limpiado, sí', () => {
    expect(tocaLimpiar(null, AHORA)).toBe(true);
  });

  it('una hora es exactamente 3 600 000 ms', () => {
    expect(ENTRE_LIMPIEZAS_MS).toBe(3_600_000);
  });

  it('hace un minuto, no', () => {
    expect(tocaLimpiar(haceMs(60_000), AHORA)).toBe(false);
  });

  it('a un milisegundo de cumplir la hora, no', () => {
    expect(tocaLimpiar(haceMs(ENTRE_LIMPIEZAS_MS - 1), AHORA)).toBe(false);
  });

  it('justo al cumplir la hora, sí', () => {
    expect(tocaLimpiar(haceMs(ENTRE_LIMPIEZAS_MS), AHORA)).toBe(true);
  });

  it('pasada la hora, sí', () => {
    expect(tocaLimpiar(haceMs(ENTRE_LIMPIEZAS_MS + 1), AHORA)).toBe(true);
    expect(tocaLimpiar(haceMs(24 * ENTRE_LIMPIEZAS_MS), AHORA)).toBe(true);
  });

  it('una última limpieza «en el futuro» (relojes desfasados) tampoco deja limpiar', () => {
    expect(tocaLimpiar(new Date(AHORA.getTime() + 60_000), AHORA)).toBe(false);
  });
});

describe('la limpieza automática y el botón del dueño', () => {
  it('la acción que se busca en la auditoría ES el nombre del comando', () => {
    // Si el comando se renombrara, «la última vez» buscaría una acción que nadie escribe y la
    // automática correría en cada visita.
    expect(limpiarSolicitudes.nombre).toBe(ACCION_DE_LA_LIMPIEZA);
  });

  it('sin `automatica` es el botón del dueño: siempre limpia', () => {
    expect(entradaLimpiarSolicitudes.parse({})).toEqual({ automatica: false });
  });

  it('`automatica: true` es la que decide el servidor', () => {
    expect(entradaLimpiarSolicitudes.parse({ automatica: true })).toEqual({ automatica: true });
  });

  it('`automatica` sólo admite un booleano', () => {
    expect(entradaLimpiarSolicitudes.safeParse({ automatica: 'si' }).success).toBe(false);
  });

  it('no amplía quién puede: los mismos roles de la sala, sin la caja', () => {
    expect(limpiarSolicitudes.roles).toEqual(['mesero', 'gerente', 'administrador', 'dueno']);
  });
});
