import { describe, expect, it } from 'vitest';

import {
  APERTURA_MIN,
  CIERRE_MIN,
  ESTANCIA_MINIMA_MIN,
  estanciaAlSentarse,
  generarHorario,
  horaDicha,
  minutoDelDia,
  PERFIL_NORMAL,
  quienesSeVan,
  ULTIMA_MESA_MIN,
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

  // Los siete días de la semana, sembrados como los siembra `correr-dia` (una sola semilla tiene
  // demasiado ruido con 130 llegadas: la 18 sola daba 35 % en el pico y otras 57 %).
  const semana = Array.from({ length: 7 }, (_, i) =>
    generarHorario(crearAzar(`18-dia-${String(i + 1)}`).hijo('horario'), PERFIL_NORMAL),
  );
  const parte = (desde: number, hasta: number): number =>
    semana.flat().filter((l) => l.horaSim >= desde && l.horaSim < hasta).length /
    semana.flat().length;

  it('concentra las llegadas en el pico de 13:30 a 16:30', () => {
    expect(parte(13 * 60 + 30, 16 * 60 + 30)).toBeGreaterThan(0.4);
  });

  it('reparte la mañana: casi la tercera parte llega antes de la una y nadie después de las 18:30', () => {
    expect(parte(0, 13 * 60)).toBeGreaterThan(0.3);
    expect(semana.flat().every((l) => l.horaSim < 18 * 60 + 30)).toBe(true);
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

describe('el cierre del día', () => {
  const llegada = (horaSim: number) => ({
    id: `L${String(horaSim)}`,
    horaSim,
    personas: 2,
    usaQr: false,
    telefonos: 0,
    minutosEnLaMesa: 90,
    rondas: 1,
    celebracion: false,
  });

  it('se van los que llevan más de 45 minutos esperando mesa; los demás siguen en la fila', () => {
    const fila = [llegada(600), llegada(640), llegada(700)];
    expect(quienesSeVan(fila, 646).map((l) => l.id)).toEqual(['L600']);
    expect(quienesSeVan(fila, 645)).toEqual([]);
  });

  it('a las 18:45 se va todo el que siga esperando, pero no quien aún no llega', () => {
    const fila = [llegada(ULTIMA_MESA_MIN - 10), llegada(ULTIMA_MESA_MIN + 5)];
    expect(quienesSeVan(fila, ULTIMA_MESA_MIN).map((l) => l.id)).toEqual([
      `L${String(ULTIMA_MESA_MIN - 10)}`,
    ]);
  });

  it('la estancia no pasa de las 19:00, salvo los 35 minutos mínimos de quien se sienta tarde', () => {
    expect(estanciaAlSentarse({ minutosEnLaMesa: 90 }, 12 * 60)).toBe(90);
    expect(estanciaAlSentarse({ minutosEnLaMesa: 90 }, CIERRE_MIN - 60)).toBe(60);
    expect(estanciaAlSentarse({ minutosEnLaMesa: 90 }, CIERRE_MIN - 10)).toBe(ESTANCIA_MINIMA_MIN);
    expect(estanciaAlSentarse({ minutosEnLaMesa: 40 }, CIERRE_MIN - 60)).toBe(40);
  });
});
