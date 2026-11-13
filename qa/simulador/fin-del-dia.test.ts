import { describe, expect, it } from 'vitest';

import { diaTerminado, minutosDesdeLaMedianoche } from './fin-del-dia.ts';

const CIERRE = 19 * 60;
const TOPE = 20 * 60 + 30;
const base = { cierre: CIERRE, tope: TOPE, pendientes: 0, parar: false };

describe('el fin del día simulado', () => {
  it('no termina antes de las 19:00 aunque no haya nadie', () => {
    expect(diaTerminado({ ...base, minuto: 18 * 60 })).toBe(false);
  });

  it('pasadas las 19:00 termina cuando ya no queda nada pendiente', () => {
    expect(diaTerminado({ ...base, minuto: CIERRE + 5, pendientes: 2 })).toBe(false);
    expect(diaTerminado({ ...base, minuto: CIERRE + 5 })).toBe(true);
  });

  it('a las 20:30 termina aunque queden mesas', () => {
    expect(diaTerminado({ ...base, minuto: TOPE, pendientes: 4 })).toBe(true);
  });

  it('pasada la medianoche sigue terminado: los minutos no vuelven a cero', () => {
    const fecha = '2026-11-20';
    const pasadaLaMedianoche = new Date('2026-11-21T00:15:00-06:00');
    const minuto = minutosDesdeLaMedianoche(fecha, pasadaLaMedianoche);
    expect(minuto).toBe(24 * 60 + 15);
    expect(diaTerminado({ ...base, minuto, pendientes: 3 })).toBe(true);
  });

  it('cuenta desde la medianoche de CDMX de la fecha', () => {
    expect(minutosDesdeLaMedianoche('2026-11-20', new Date('2026-11-20T08:00:00-06:00'))).toBe(480);
  });

  it('la orden de parar termina el día a cualquier hora', () => {
    expect(diaTerminado({ ...base, minuto: 600, pendientes: 9, parar: true })).toBe(true);
  });
});
