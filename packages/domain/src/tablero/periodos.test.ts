import { describe, expect, it } from 'vitest';

import { planDelPeriodo, sumarDias, tablaDeColores } from './periodos.ts';

/** DP-21 · Bloque 13 · los periodos del tablero: lunes a domingo, hoy por hora, el mes por día, el año por mes. */
describe('sumarDias', () => {
  it('cuenta días de calendario, cruzando meses, años y bisiestos', () => {
    expect(sumarDias('2026-11-16', -7)).toBe('2026-11-09');
    expect(sumarDias('2026-03-01', -1)).toBe('2026-02-28');
    expect(sumarDias('2028-03-01', -1)).toBe('2028-02-29');
    expect(sumarDias('2026-12-31', 1)).toBe('2027-01-01');
  });
});

describe('«¿Cómo va tu semana?» (por omisión)', () => {
  // 2026-11-18 es miércoles.
  const plan = planDelPeriodo('semana', '2026-11-18');

  it('son siete barras, de lunes a domingo, aunque falten días por llegar', () => {
    expect(plan.agrupar).toBe('dia');
    expect(plan.cubetas.map((c) => c.clave)).toEqual([
      '2026-11-16',
      '2026-11-17',
      '2026-11-18',
      '2026-11-19',
      '2026-11-20',
      '2026-11-21',
      '2026-11-22',
    ]);
    expect(plan.cubetas.map((c) => c.etiqueta)).toEqual([
      'lun',
      'mar',
      'mié',
      'jue',
      'vie',
      'sáb',
      'dom',
    ]);
    expect([plan.desde, plan.hasta]).toEqual(['2026-11-16', '2026-11-22']);
  });

  it('cada día se compara con el MISMO día de la semana pasada', () => {
    expect(plan.cubetas.map((c) => c.claveReferencia)).toEqual([
      '2026-11-09',
      '2026-11-10',
      '2026-11-11',
      '2026-11-12',
      '2026-11-13',
      '2026-11-14',
      '2026-11-15',
    ]);
    expect(plan.referencia).toEqual({ desde: '2026-11-09', hasta: '2026-11-15' });
  });

  it('un lunes y un domingo caen en su propia semana', () => {
    expect(planDelPeriodo('semana', '2026-11-16').desde).toBe('2026-11-16');
    expect(planDelPeriodo('semana', '2026-11-22').desde).toBe('2026-11-16');
    expect(planDelPeriodo('semana', '2026-11-23').desde).toBe('2026-11-23');
  });
});

describe('Hoy, por hora', () => {
  const plan = planDelPeriodo('hoy', '2026-11-18');
  it('24 horas contra las mismas horas del mismo día de la semana pasada', () => {
    expect(plan.agrupar).toBe('hora');
    expect(plan.cubetas).toHaveLength(24);
    expect(plan.cubetas[0]).toMatchObject({ clave: '00', etiqueta: '0h', claveReferencia: '00' });
    expect(plan.cubetas[23]?.clave).toBe('23');
    expect([plan.desde, plan.hasta]).toEqual(['2026-11-18', '2026-11-18']);
    expect(plan.referencia).toEqual({ desde: '2026-11-11', hasta: '2026-11-11' });
  });
});

describe('Este mes, por día', () => {
  it('un día por barra, contra el mes pasado en el mismo número de día', () => {
    const plan = planDelPeriodo('mes', '2026-03-10');
    expect(plan.cubetas).toHaveLength(31);
    expect(plan.cubetas[0]).toMatchObject({ clave: '2026-03-01', claveReferencia: '2026-02-01' });
    // El 29, 30 y 31 de marzo no existen en febrero de 2026: sin referencia.
    expect(plan.cubetas[28]?.claveReferencia).toBeNull();
    expect(plan.cubetas[27]?.claveReferencia).toBe('2026-02-28');
    expect([plan.desde, plan.hasta]).toEqual(['2026-03-01', '2026-03-31']);
    expect(plan.referencia).toEqual({ desde: '2026-02-01', hasta: '2026-02-28' });
  });

  it('enero se compara con diciembre del año anterior', () => {
    const plan = planDelPeriodo('mes', '2027-01-05');
    expect(plan.referencia).toEqual({ desde: '2026-12-01', hasta: '2026-12-31' });
    expect(plan.cubetas[0]?.claveReferencia).toBe('2026-12-01');
  });
});

describe('Este año, por mes', () => {
  it('doce meses, sin referencia', () => {
    const plan = planDelPeriodo('anio', '2026-11-18');
    expect(plan.agrupar).toBe('mes');
    expect(plan.cubetas.map((c) => c.clave)).toEqual([
      '2026-01',
      '2026-02',
      '2026-03',
      '2026-04',
      '2026-05',
      '2026-06',
      '2026-07',
      '2026-08',
      '2026-09',
      '2026-10',
      '2026-11',
      '2026-12',
    ]);
    expect(plan.cubetas.every((c) => c.claveReferencia === null)).toBe(true);
    expect(plan.referencia).toBeNull();
    expect([plan.desde, plan.hasta]).toEqual(['2026-01-01', '2026-12-31']);
  });
});

describe('tablaDeColores', () => {
  it('cada serie usa un token del tema, nunca un color suelto ni color-mix', () => {
    for (const clase of Object.values(tablaDeColores)) {
      expect(clase).toMatch(/^bg-[a-z-]+$/);
      expect(clase).not.toContain('color-mix');
    }
  });
});
