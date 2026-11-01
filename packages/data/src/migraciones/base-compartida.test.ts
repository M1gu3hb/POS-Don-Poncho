import { describe, expect, it } from 'vitest';

import { esLaBaseCompartida, faltantesQueCuentan } from './base-compartida.ts';

/** PAR-1 · Don Poncho no migra la base compartida, y ahí la 188 se queda sin aplicar. */
const COMPARTIDA = 'wyqmzhliurwyxuyxznpb';
const PROPIA = 'abcdefghijklmnopqrst';

describe('¿el destino es la base compartida?', () => {
  it('por el proyecto vinculado del CLI', () => {
    expect(esLaBaseCompartida({ projectRef: COMPARTIDA })).toBe(true);
    expect(esLaBaseCompartida({ projectRef: PROPIA })).toBe(false);
  });

  it('por la cadena de conexión: pooler, directa o cualquier mención', () => {
    expect(
      esLaBaseCompartida({
        url: `postgres://morphiqpos_app.${COMPARTIDA}:x@aws-0-us-east-2.pooler.supabase.com:6543/postgres`,
      }),
    ).toBe(true);
    expect(
      esLaBaseCompartida({
        url: `postgres://postgres:x@db.${COMPARTIDA}.supabase.co:5432/postgres`,
      }),
    ).toBe(true);
    expect(
      esLaBaseCompartida({ url: 'postgres://morphiqpos@127.0.0.1:5433/morphiqpos_pruebas' }),
    ).toBe(false);
    expect(
      esLaBaseCompartida({ url: `postgres://postgres:x@db.${PROPIA}.supabase.co:5432/postgres` }),
    ).toBe(false);
    expect(esLaBaseCompartida({})).toBe(false);
  });
});

describe('las migraciones sin aplicar que cuentan', () => {
  it('en la compartida, la 188 (de la base propia) no cuenta; las demás sí', () => {
    expect(faltantesQueCuentan(COMPARTIDA, [188])).toEqual([]);
    expect(faltantesQueCuentan(COMPARTIDA, [187, 188])).toEqual([187]);
  });

  it('en la base propia, la 188 cuenta como cualquier otra', () => {
    expect(faltantesQueCuentan(PROPIA, [188])).toEqual([188]);
  });
});
