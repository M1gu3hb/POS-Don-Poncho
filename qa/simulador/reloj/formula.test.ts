import { describe, expect, it } from 'vitest';

import { conElRelojDeQa } from './en-la-base.ts';
import { guionDelNavegador, horaSimulada, parametrosValidos } from './formula.ts';

const LUNES_8 = Date.parse('2026-11-16T08:00:00-06:00');

describe('el reloj de QA', () => {
  it('avanza desde la hora simulada a la velocidad del factor', () => {
    const p = { baseReal: 1_000_000, baseSim: LUNES_8, factor: 6 };
    expect(horaSimulada(p, 1_000_000)).toBe(LUNES_8);
    // Diez minutos reales a ×6 son una hora simulada.
    expect(horaSimulada(p, 1_000_000 + 600_000)).toBe(LUNES_8 + 3_600_000);
  });

  it('rechaza parámetros a medio escribir o fuera de rango', () => {
    expect(parametrosValidos({ baseReal: 1, baseSim: 2, factor: 6 })).toEqual({
      baseReal: 1,
      baseSim: 2,
      factor: 6,
    });
    expect(parametrosValidos(null)).toBeNull();
    expect(parametrosValidos({ baseReal: 1, baseSim: 2 })).toBeNull();
    expect(parametrosValidos({ baseReal: 1, baseSim: 2, factor: 0 })).toBeNull();
    expect(parametrosValidos({ baseReal: 1, baseSim: 2, factor: 61 })).toBeNull();
    expect(parametrosValidos({ baseReal: '1', baseSim: 2, factor: 1 })).toBeNull();
  });

  it('en el navegador, Date sin argumentos y Date.now dan la simulada; con argumentos, igual', () => {
    const real = Date.now();
    const ambito: { Date: DateConstructor } = { Date };
    // Se evalúa el guion contra un `globalThis` de mentira para no tocar el de la prueba.
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, @typescript-eslint/no-unsafe-call -- evaluar el guion que se inyecta en el navegador es justo lo que se prueba
    new Function('globalThis', guionDelNavegador({ baseReal: real, baseSim: LUNES_8, factor: 1 }))(
      ambito,
    );
    const D = ambito.Date;
    expect(Math.abs(D.now() - LUNES_8)).toBeLessThan(1000);
    expect(Math.abs(new D().getTime() - LUNES_8)).toBeLessThan(1000);
    expect(new D(0).getTime()).toBe(0);
    expect(new D() instanceof Date).toBe(true);
    expect(D.UTC(2026, 0, 1)).toBe(Date.UTC(2026, 0, 1));
  });

  it('en la base, cada forma de pedir la hora apunta al reloj de QA (y una vez basta)', () => {
    expect(conElRelojDeQa('now()')).toBe('qa_reloj.now()');
    expect(conElRelojDeQa("(now() + '00:10:00'::interval)")).toBe(
      "(qa_reloj.now() + '00:10:00'::interval)",
    );
    expect(conElRelojDeQa('CURRENT_TIMESTAMP')).toBe('qa_reloj.now()');
    expect(conElRelojDeQa('CURRENT_DATE')).toBe('(qa_reloj.now())::date');
    expect(conElRelojDeQa('NEW.updated_at = now(); x := clock_timestamp();')).toBe(
      'NEW.updated_at = qa_reloj.now(); x := qa_reloj.now();',
    );
    expect(conElRelojDeQa(conElRelojDeQa('now()'))).toBe('qa_reloj.now()');
    expect(conElRelojDeQa("'sin hora'")).toBe("'sin hora'");
  });
});
