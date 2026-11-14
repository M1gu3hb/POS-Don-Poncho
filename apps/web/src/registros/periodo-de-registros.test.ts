import { describe, expect, it } from 'vitest';

import {
  avisoDelTopeDeRegistros,
  fechaEnElPeriodo,
  leerPeriodoCompleto,
  rangoDelPeriodo,
  unirPorId,
  type PeticionDeRango,
} from './periodo-de-registros.ts';

/** Una «base» de filas con instante `t` (ms) que responde como el puente: tope y rango inclusivo. */
function baseDeInstantes(
  total: number,
  inicio: number,
  paso: number,
  tope: number,
  extras: readonly { id: string; t: number }[] = [],
) {
  const filas = [
    ...Array.from({ length: total }, (_, i) => ({ id: `v${String(i)}`, t: inicio + i * paso })),
    ...extras,
  ];
  const peticiones: PeticionDeRango[] = [];
  const leer = (p: PeticionDeRango) => {
    peticiones.push(p);
    const desde = new Date(p.desde).getTime();
    const hasta = new Date(p.hasta).getTime();
    // Como el puente con `-created_date`: lo más reciente primero, y el tope corta lo más viejo.
    const dentro = filas.filter((f) => f.t >= desde && f.t <= hasta).sort((a, b) => b.t - a.t);
    return Promise.resolve(dentro.slice(0, tope));
  };
  return { filas, peticiones, leer };
}

describe('DP-18 · A21 · leerPeriodoCompleto', () => {
  const rango = {
    from: new Date('2026-11-01T00:00:00.000Z'),
    to: new Date('2026-11-07T23:59:59.999Z'),
  };

  it('trae TODAS las filas del periodo aunque pasen del tope por petición', async () => {
    const base = baseDeInstantes(2500, rango.from.getTime(), 240_000, 1000);
    const r = await leerPeriodoCompleto({
      campo: 'created_date',
      tipo: 'fecha',
      rango,
      leer: base.leer,
    });
    expect(r.truncada).toBe(false);
    expect(r.filas).toHaveLength(2500);
    expect(new Set(r.filas.map((f) => f.id)).size).toBe(2500);
    expect(base.peticiones.length).toBeGreaterThan(1);
  });

  it('con menos filas que el tope basta UNA petición, con el periodo y el campo en ella', async () => {
    const base = baseDeInstantes(10, rango.from.getTime(), 60_000, 1000);
    const r = await leerPeriodoCompleto({
      campo: 'fecha_cierre',
      tipo: 'fecha',
      rango,
      leer: base.leer,
    });
    expect(r.filas).toHaveLength(10);
    expect(base.peticiones).toEqual([
      { campo: 'fecha_cierre', desde: rango.from.toISOString(), hasta: rango.to.toISOString() },
    ]);
  });

  it('avisa (truncada) cuando se alcanza el techo de seguridad', async () => {
    const base = baseDeInstantes(2500, rango.from.getTime(), 240_000, 1000);
    const r = await leerPeriodoCompleto({
      campo: 'created_date',
      tipo: 'fecha',
      rango,
      leer: base.leer,
      techo: 1500,
    });
    expect(r.truncada).toBe(true);
    expect(r.filas.length).toBeLessThan(2500);
    // Lo que se conserva es lo MÁS RECIENTE (el aviso dice «más recientes»): v2499 está, v0 no.
    const ids = new Set(r.filas.map((f) => f.id));
    expect(ids.has('v2499')).toBe(true);
    expect(ids.has('v2000')).toBe(true);
    expect(ids.has('v0')).toBe(false);
  });

  it('avisa si mil filas caen en una ventana que ya no se puede partir', async () => {
    const base = baseDeInstantes(1500, rango.from.getTime(), 1, 1000); // 1 500 en 1,5 s
    const r = await leerPeriodoCompleto({
      campo: 'created_date',
      tipo: 'fecha',
      rango,
      leer: base.leer,
    });
    expect(r.truncada).toBe(true);
  });

  it('no pierde una fila entre las dos mitades: instantes con fracciones de milisegundo', async () => {
    const desde = rango.from.getTime();
    const hasta = rango.to.getTime();
    const mitad = Math.floor((desde + hasta) / 2);
    // 1 500 filas parten la ventana; una cae en `mitad + 0,4 ms` (timestamptz guarda microsegundos).
    // Las 1 500 filas son TODAS más nuevas que `mitad`: la fila de `mitad + 0,4 ms` es la más vieja
    // y sólo la alcanza la lectura de la mitad reciente si ésta arranca en `mitad` (no en `mitad + 1`).
    const base = baseDeInstantes(1500, mitad + 60_000, 1000, 1000, [
      { id: 'entre-mitades', t: mitad + 0.4 },
    ]);
    const r = await leerPeriodoCompleto({
      campo: 'created_date',
      tipo: 'fecha',
      rango,
      leer: base.leer,
    });
    expect(r.truncada).toBe(false);
    expect(r.filas.map((f) => f.id)).toContain('entre-mitades');
    expect(r.filas).toHaveLength(1501);
  });

  it('una fila sin id no se duplica al releer las mitades', async () => {
    const sinId = { t: rango.from.getTime() + 5 * 60_000, nota: 'sin id' } as {
      id?: string;
      t: number;
      nota: string;
    };
    const base = baseDeInstantes(1200, rango.from.getTime(), 400_000, 1000);
    const leer = async (p: PeticionDeRango) => {
      const filas = await base.leer(p);
      const d = new Date(p.desde).getTime();
      const h = new Date(p.hasta).getTime();
      return sinId.t >= d && sinId.t <= h ? [...filas, sinId] : filas;
    };
    const r = await leerPeriodoCompleto({ campo: 'created_date', tipo: 'fecha', rango, leer });
    expect(r.filas.filter((f) => 'nota' in f)).toHaveLength(1);
  });

  it('en campos de DÍA parte por días y pide fechas sin hora', async () => {
    const dias = Array.from({ length: 7 }, (_, i) => `2026-11-0${String(i + 1)}`);
    const filas = dias.flatMap((d) =>
      Array.from({ length: 400 }, (_, j) => ({ id: `${d}-${String(j)}`, fecha: d })),
    );
    const peticiones: PeticionDeRango[] = [];
    const leer = (p: PeticionDeRango) => {
      peticiones.push(p);
      return Promise.resolve(
        filas.filter((f) => f.fecha >= p.desde && f.fecha <= p.hasta).slice(0, 1000),
      );
    };
    const r = await leerPeriodoCompleto({
      campo: 'fecha',
      tipo: 'dia',
      rango: { from: new Date(2026, 10, 1), to: new Date(2026, 10, 7, 23, 59) },
      leer,
    });
    expect(r.truncada).toBe(false);
    expect(r.filas).toHaveLength(2800);
    expect(peticiones.every((p) => /^\d{4}-\d{2}-\d{2}$/.test(p.desde))).toBe(true);
  });
});

describe('DP-18 · A21 · el aviso del tope', () => {
  it('no dice nada si todo el periodo está en pantalla', () => {
    expect(avisoDelTopeDeRegistros('ventas', 120, false)).toBeNull();
  });

  it('dice cuántas se muestran y qué hacer cuando quedó algo sin traer', () => {
    const texto = avisoDelTopeDeRegistros('ventas', 1000, true) ?? '';
    expect(texto).toContain('Se muestran las');
    expect(texto).toContain('ventas más recientes');
    expect(texto).toContain('periodo más corto');
  });
});

describe('DP-18 · rango del periodo y unión por id', () => {
  it('el rango personalizado se lee en hora LOCAL: del 10 al 10 es un solo día', () => {
    const r = rangoDelPeriodo('custom', '2026-11-10', '2026-11-10');
    expect(r.from.getDate()).toBe(10);
    expect(r.to.getDate()).toBe(10);
    expect(r.from.getHours()).toBe(0);
    expect(r.to.getHours()).toBe(23);
  });

  it('«Últimos 7 días» abarca hoy y los 6 anteriores', () => {
    const r = rangoDelPeriodo('7d', '', '', new Date(2026, 10, 14, 15, 0));
    expect(r.from.getDate()).toBe(8);
    expect(r.to.getDate()).toBe(14);
  });

  it('unirPorId no duplica una venta creada y cobrada en el periodo', () => {
    expect(unirPorId([{ id: 'a' }, { id: 'b' }], [{ id: 'b' }, { id: 'c' }])).toHaveLength(3);
  });
});

describe('DP-18 · fechaEnElPeriodo: los días no son medianoche UTC', () => {
  const hoy = new Date(2026, 10, 14, 15, 30); // 14 nov, hora local del aparato

  it('«Hoy»: una compra o gasto de HOY (día sin hora) suma', () => {
    const r = rangoDelPeriodo('today', '', '', hoy);
    expect(fechaEnElPeriodo('2026-11-14', r)).toBe(true);
    expect(fechaEnElPeriodo('2026-11-13', r)).toBe(false);
    expect(fechaEnElPeriodo('2026-11-15', r)).toBe(false);
  });

  it('«Últimos 7 días» y «Este mes» no pierden su primer día', () => {
    const siete = rangoDelPeriodo('7d', '', '', hoy);
    expect(fechaEnElPeriodo('2026-11-08', siete)).toBe(true);
    expect(fechaEnElPeriodo('2026-11-07', siete)).toBe(false);
    const mes = rangoDelPeriodo('mes', '', '', hoy);
    expect(fechaEnElPeriodo('2026-11-01', mes)).toBe(true);
    expect(fechaEnElPeriodo('2026-10-31', mes)).toBe(false);
  });

  it('«Personalizado» incluye el primer y el último día', () => {
    const r = rangoDelPeriodo('custom', '2026-11-10', '2026-11-12');
    expect(fechaEnElPeriodo('2026-11-10', r)).toBe(true);
    expect(fechaEnElPeriodo('2026-11-12', r)).toBe(true);
    expect(fechaEnElPeriodo('2026-11-13', r)).toBe(false);
  });

  it('un instante con hora se compara como instante; lo vacío no cuenta', () => {
    const r = rangoDelPeriodo('today', '', '', hoy);
    expect(fechaEnElPeriodo(new Date(2026, 10, 14, 9, 0).toISOString(), r)).toBe(true);
    expect(fechaEnElPeriodo(new Date(2026, 10, 13, 23, 0).toISOString(), r)).toBe(false);
    expect(fechaEnElPeriodo(undefined, r)).toBe(false);
    expect(fechaEnElPeriodo('', r)).toBe(false);
  });
});
