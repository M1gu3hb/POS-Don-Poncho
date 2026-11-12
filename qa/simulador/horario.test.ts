import { describe, expect, it } from 'vitest';

import {
  APERTURA_MIN,
  CIERRE_MIN,
  generarHorario,
  horaDicha,
  minutoDelDia,
  PERFIL_NORMAL,
} from './horario.ts';
import { crearAzar } from './semilla.ts';

describe('el horario de llegadas', () => {
  it('es el mismo con la misma semilla y distinto con otra', () => {
    const a = generarHorario(crearAzar(18), PERFIL_NORMAL);
    const b = generarHorario(crearAzar(18), PERFIL_NORMAL);
    const c = generarHorario(crearAzar(19), PERFIL_NORMAL);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it('trae al menos 120 cuentas de mesa y 60 pedidos del portal', () => {
    const h = generarHorario(crearAzar(18), PERFIL_NORMAL);
    expect(h.length).toBeGreaterThanOrEqual(120);
    expect(h.filter((l) => l.usaQr).length).toBeGreaterThanOrEqual(60);
  });

  it('respeta los rangos: 1–6 personas, 2–4 teléfonos con QR, 1–3 rondas y llegadas dentro del horario', () => {
    for (const l of generarHorario(crearAzar(7), PERFIL_NORMAL)) {
      expect(l.personas).toBeGreaterThanOrEqual(1);
      expect(l.personas).toBeLessThanOrEqual(6);
      expect(l.rondas).toBeGreaterThanOrEqual(1);
      expect(l.rondas).toBeLessThanOrEqual(3);
      expect(l.horaSim).toBeGreaterThanOrEqual(APERTURA_MIN);
      expect(l.horaSim).toBeLessThan(CIERRE_MIN);
      if (l.usaQr) {
        expect(l.telefonos).toBeGreaterThanOrEqual(2);
        expect(l.telefonos).toBeLessThanOrEqual(4);
      } else expect(l.telefonos).toBe(0);
    }
  });

  it('concentra las llegadas en el pico de 13:30 a 16:30', () => {
    const h = generarHorario(crearAzar(18), PERFIL_NORMAL);
    const enElPico = h.filter((l) => l.horaSim >= 13 * 60 + 30 && l.horaSim < 16 * 60 + 30).length;
    expect(enElPico / h.length).toBeGreaterThan(0.4);
  });

  it('sale ordenado por hora y con ids únicos', () => {
    const h = generarHorario(crearAzar(3), PERFIL_NORMAL);
    expect(h.map((l) => l.horaSim)).toEqual([...h.map((l) => l.horaSim)].sort((a, b) => a - b));
    expect(new Set(h.map((l) => l.id)).size).toBe(h.length);
  });
});

describe('la hora del día', () => {
  it('lee los minutos desde la medianoche en la zona de CDMX', () => {
    expect(minutoDelDia(new Date('2026-11-16T08:30:00-06:00'))).toBe(8 * 60 + 30);
    expect(horaDicha(14 * 60 + 5)).toBe('14:05');
  });
});
